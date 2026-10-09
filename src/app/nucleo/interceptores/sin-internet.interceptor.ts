import { HttpErrorResponse, HttpInterceptorFn, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { entorno } from '../../../environments/entorno';
import { DatosLocalesServicio, CopiaLocal } from '../servicios/datos-locales.servicio';

// 2026-10-09 (plan "sin internet", paso 2): si se fue el internet, las
// consultas (GET) que la copia local puede responder se contestan desde ahí
// - buscar afiliados y empresas, abrir fichas, ver personal y cuánto debe
// cada cuenta. Las pantallas no cambian: reciben la misma forma de datos.
// Lo que la copia no tiene (documentos, historial...) llega vacío, y
// guardar cambios sigue necesitando internet (paso 3).

const API = entorno.urlApi.replace(/\/$/, '');
const sinTildes = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const contiene = (campo: unknown, termino: string) => sinTildes(campo).includes(termino);
const digitos = (s: unknown) => String(s ?? '').replace(/\D/g, '');
const indiceMes = (d: Date) => d.getFullYear() * 12 + d.getMonth();

function estadoCuenta(pagos: { fechaPeriodo: string; mesesCubiertos: number | null }[]) {
  const actual = indiceMes(new Date());
  let hasta = -1;
  for (const p of pagos) hasta = Math.max(hasta, indiceMes(new Date(p.fechaPeriodo)) + Math.max(1, p.mesesCubiertos ?? 1) - 1);
  if (hasta >= actual) return { mesesAdeudados: 0, pagadoEsteMes: true };
  const desde = hasta < 0 ? actual : hasta + 1;
  return { mesesAdeudados: Math.max(1, actual - desde + 1), pagadoEsteMes: false };
}

function cuenta(c: CopiaLocal, e: any) {
  const est = estadoCuenta(c.pagos.filter((p) => p.empresaId === e.id));
  const cuota = Number(e.totalPago ?? e.valor ?? 0);
  return {
    empresaId: e.id, razonSocial: e.razonSocial, nit: e.nit, activa: e.activa, cuota,
    descripcion: e.claseAportante ?? null, usuarioPortal: e.asopagos ?? null,
    mesesAdeudados: est.mesesAdeudados, pagadoEsteMes: est.pagadoEsteMes, montoAdeudado: cuota * est.mesesAdeudados,
  };
}

function personalDe(c: CopiaLocal, empresaId: number) {
  const afPorId = new Map(c.afiliados.map((a) => [a.id, a]));
  return c.personal.filter((p) => p.empresaId === empresaId).map((p) => {
    const cuentaPropia = c.empresas.find((e) => e.id !== empresaId && digitos(e.nit) === digitos(p.documento));
    return { ...p, afiliado: p.afiliadoId ? afPorId.get(p.afiliadoId) ?? null : null, cuentaEmpresaId: cuentaPropia?.id ?? null, _cuenta: cuentaPropia };
  });
}

// Devuelve el cuerpo de la respuesta, o undefined si la copia no sabe responder.
function responder(req: HttpRequest<unknown>, c: CopiaLocal): unknown {
  const ruta = req.url.slice(API.length).split('?')[0].replace(/\/$/, '');
  const q: HttpParams = req.params;
  let m: RegExpMatchArray | null;

  if (ruta === '/afiliados') {
    const termino = sinTildes(q.get('busqueda') ?? '').trim();
    const estado = q.get('estado');
    const empresaId = Number(q.get('empresaId') || 0);
    const pagina = Math.max(1, Number(q.get('pagina') || 1));
    const porPagina = Math.max(1, Number(q.get('porPagina') || 50));
    let lista = c.afiliados.filter((a) =>
      (!estado || a.estado === estado) &&
      (!empresaId || a.sucursal?.empresaId === empresaId) &&
      (!termino || contiene(a.nombres, termino) || contiene(a.apellidos, termino) || contiene(a.cedula, termino) || contiene(`${a.nombres} ${a.apellidos}`, termino)));
    lista = [...lista].sort((x, y) => sinTildes(x.apellidos).localeCompare(sinTildes(y.apellidos)));
    const total = lista.length;
    return { datos: lista.slice((pagina - 1) * porPagina, pagina * porPagina), total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina), sinInternet: true };
  }
  if ((m = ruta.match(/^\/afiliados\/(\d+)$/))) {
    const a = c.afiliados.find((x) => x.id === Number(m![1]));
    return a ? { ...a, documentos: [], historial: [], sinInternet: true } : undefined;
  }
  if ((m = ruta.match(/^\/afiliados\/(\d+)\/duplicados$/))) return [];
  if ((m = ruta.match(/^\/pagos\/afiliado\/(\d+)$/))) return c.pagos.filter((p) => p.afiliadoId === Number(m![1]));
  if ((m = ruta.match(/^\/documentos\/afiliado\/(\d+)$/))) return [];
  if (ruta === '/documentos/tipos-requeridos') return [];
  if ((m = ruta.match(/^\/eventos-incapacidad\/afiliado\/(\d+)$/))) return [];
  if (ruta === '/solicitudes-cambio') return [];
  if (ruta === '/solicitudes-cambio/pendientes/cantidad') return 0;
  if ((m = ruta.match(/^\/credenciales-pila\/titular\/\w+\/(\d+)$/))) return [];

  if (ruta === '/empresas') {
    const termino = sinTildes(q.get('busqueda') ?? '').trim();
    const soloActivas = q.get('activas') === 'true';
    return c.empresas.filter((e) =>
      (!soloActivas || e.activa) &&
      (!termino || contiene(e.razonSocial, termino) || contiene(e.nit, termino)));
  }
  if ((m = ruta.match(/^\/empresas\/(\d+)$/))) {
    const e = c.empresas.find((x) => x.id === Number(m![1]));
    return e ? { ...e, sinInternet: true } : undefined;
  }
  if ((m = ruta.match(/^\/empresas\/(\d+)\/personal$/))) {
    return personalDe(c, Number(m[1])).map(({ _cuenta, afiliadoId, empresaId, ...p }) => p);
  }
  if ((m = ruta.match(/^\/sucursales\/empresa\/(\d+)$/))) {
    return c.empresas.find((x) => x.id === Number(m![1]))?.sucursales ?? [];
  }
  if ((m = ruta.match(/^\/pagos\/empresa\/(\d+)\/cobro$/))) {
    const id = Number(m[1]);
    const e = c.empresas.find((x) => x.id === id);
    if (!e) return undefined;
    const personal = personalDe(c, id).map((p) => ({
      relacionId: p.relacionId, estadoRelacion: p.estadoRelacion, cargo: p.cargo, nombre: p.nombre,
      documento: p.documento, tipoDocumento: p.tipoDocumento, afiliado: p.afiliado, cuenta: p._cuenta ? cuenta(c, p._cuenta) : null,
    }));
    const pagaCon = c.personal
      .filter((p) => p.empresaId !== id && p.estadoRelacion === 'ACTIVA' && digitos(p.documento) === digitos(e.nit))
      .map((p) => c.empresas.find((x) => x.id === p.empresaId))
      .filter(Boolean)
      .map((x: any) => ({ id: x.id, razonSocial: x.razonSocial, nit: x.nit }));
    return {
      cuenta: cuenta(c, e),
      otrasCuentas: c.empresas.filter((x) => x.id !== id && digitos(x.nit) === digitos(e.nit)).map((x) => cuenta(c, x)),
      personal,
      pagaCon,
    };
  }
  return undefined;
}

function desdeCopia(req: HttpRequest<unknown>, datos: DatosLocalesServicio): Observable<HttpResponse<unknown>> | null {
  if (req.method !== 'GET' || !req.url.startsWith(API) || !datos.datos) return null;
  const cuerpo = responder(req, datos.datos);
  return cuerpo === undefined ? null : of(new HttpResponse({ status: 200, body: cuerpo, url: req.url }));
}

export const sinInternetInterceptor: HttpInterceptorFn = (req, next) => {
  const datos = inject(DatosLocalesServicio);
  // Sin internet: ni se intenta, se responde de una vez desde la copia.
  if (!navigator.onLine) {
    const local = desdeCopia(req, datos);
    if (local) return local;
  }
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // El servidor no responde (internet del edificio caído, etc.)
      if (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504) {
        const local = desdeCopia(req, datos);
        if (local) return local;
      }
      return throwError(() => error);
    }),
  );
};
