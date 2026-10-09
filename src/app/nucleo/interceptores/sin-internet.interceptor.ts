import { HttpErrorResponse, HttpInterceptorFn, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, from, map, of, tap, throwError } from 'rxjs';
import { fechaLimitePila } from '../motor/fechas-pila';
import { ColaCambiosServicio } from '../servicios/cola-cambios.servicio';
import { MotorCalculo } from '../motor/motor-calculo';
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

function estadoCuenta(pagos: { fechaPeriodo: string; mesesCubiertos: number | null; concepto?: string }[]) {
  const actual = indiceMes(new Date());
  let hasta = -1;
  // un "No aporta" (solo el trámite) no pone al día el mes
  for (const p of pagos.filter((x) => x.concepto !== 'NO_APORTA')) hasta = Math.max(hasta, indiceMes(new Date(p.fechaPeriodo)) + Math.max(1, p.mesesCubiertos ?? 1) - 1);
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

// 2026-10-09: calendario sin internet - misma lógica que PagosServicio.calendario()
// del servidor (fecha límite PILA por los dos últimos dígitos del documento;
// verde = tiene un pago que cubre ese mes). Incluye los pagos hechos sin internet.
function calendario(c: CopiaLocal, desdeTxt: string | null, hastaTxt: string | null) {
  const local = (t: string | null) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t ?? '');
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
  };
  const desde = local(desdeTxt);
  const hasta = local(hastaTxt);
  hasta.setHours(23, 59, 59, 999);
  const cobertura = new Map<number, [number, number][]>();
  for (const p of c.pagos) {
    if (!p.afiliadoId || p.concepto === 'NO_APORTA') continue;
    const ini = indiceMes(new Date(p.fechaPeriodo));
    if (!cobertura.has(p.afiliadoId)) cobertura.set(p.afiliadoId, []);
    cobertura.get(p.afiliadoId)!.push([ini, ini + Math.max(1, p.mesesCubiertos ?? 1)]);
  }
  const pagoElMes = (id: number, mes: number) => (cobertura.get(id) ?? []).some(([d, h]) => mes >= d && mes < h);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const porDia = new Map<string, any[]>();
  const activos = c.afiliados.filter((a) => a.estado === 'ACTIVO' && a.cedula);
  for (let m = indiceMes(desde); m <= indiceMes(hasta); m++) {
    const anio = Math.floor(m / 12), mes = m % 12;
    for (const a of activos) {
      const fecha = fechaLimitePila(a.cedula, anio, mes);
      if (fecha < desde || fecha > hasta) continue;
      const pagado = pagoElMes(a.id, m);
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
      if (!porDia.has(clave)) porDia.set(clave, []);
      porDia.get(clave)!.push({
        estado: pagado ? 'PAGADO' : 'SIN_PAGAR',
        vencido: !pagado && fecha < hoy,
        valorMes: a.totalPago != null ? Number(a.totalPago) : null,
        afiliado: { id: a.id, nombres: a.nombres, apellidos: a.apellidos, cedula: a.cedula, telefono: a.telefono, correo: a.correo, tipoDocumento: a.persona?.tipoDocumento ?? 'CC' },
      });
    }
  }
  return Array.from(porDia.entries())
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([fecha, lista]) => ({
      fecha,
      afiliados: lista.sort((x, y) => (x.estado === y.estado
        ? `${x.afiliado.nombres} ${x.afiliado.apellidos}`.localeCompare(`${y.afiliado.nombres} ${y.afiliado.apellidos}`)
        : x.estado === 'SIN_PAGAR' ? -1 : 1)),
    }));
}

// Pantallas cuya última respuesta (vista con internet) se guarda cifrada en
// el equipo para mostrarla sin internet. NO incluye claves de portales.
const RECORDAR = /^\/(afiliados\/estadisticas|afiliados\/papelera|empresas\/estadisticas|recordatorios-llamada\/pendientes|notificaciones(\/pendientes|\/sin-leer)?|solicitudes-cambio(\/\d+|\/pendientes\/cantidad)?|hallazgos-reconciliacion(\/[\w-]+)?|evidencias-hallazgo\/hallazgo\/\d+|documentos\/(afiliado\/\d+|tipos-requeridos)|eventos-incapacidad\/(afiliado\/\d+|\d+\/documentos)|parametros-legales(\/[\w-]+\/historial)?|alcance\/mi-alcance|pagos\/(resumen|resumen-mensual|afiliado\/\d+)|dispositivos\/mios|usuarios(\/me\/correo-recuperacion)?|config-sistema|liquidacion\/plantillas|horario-acceso\/(configuracion|excepciones)|sucursales\/empresa\/\d+|recaudo|biblioteca|biblioteca\/entidades|biblioteca\/hojas\/\d+)$/;

function rutaDe(url: string): string {
  return url.slice(API.length).split('?')[0].replace(/\/$/, '');
}

// Si nunca se abrió esa pantalla con internet: lista vacía en vez de error.
function vacio(ruta: string): unknown {
  if (/^\/(documentos\/afiliado\/\d+|documentos\/tipos-requeridos|eventos-incapacidad\/afiliado\/-?\d+|solicitudes-cambio|notificaciones|notificaciones\/pendientes|recordatorios-llamada\/pendientes|hallazgos-reconciliacion)$/.test(ruta)) return [];
  if (ruta === '/solicitudes-cambio/pendientes/cantidad' || ruta === '/notificaciones/sin-leer') return 0;
  if (/^\/documentos\/afiliado\/-\d+$/.test(ruta)) return [];
  return undefined;
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
  if ((m = ruta.match(/^\/afiliados\/(-?\d+)$/))) {
    const a = c.afiliados.find((x) => x.id === Number(m![1]));
    return a ? { ...a, documentos: [], historial: [], sinInternet: true } : undefined;
  }
  if ((m = ruta.match(/^\/afiliados\/(-?\d+)\/duplicados$/))) return [];
  if ((m = ruta.match(/^\/pagos\/afiliado\/(-?\d+)$/))) return c.pagos.filter((p) => p.afiliadoId === Number(m![1]));
  if (ruta === '/pagos/calendario') return calendario(c, q.get('desde'), q.get('hasta'));
  // las claves de portales nunca se guardan en el equipo
  if ((m = ruta.match(/^\/credenciales-pila\/titular\/\w+\/(-?\d+)$/))) return [];

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

// ── Paso 3: calcular valores sin internet con el MISMO motor del servidor ──
function motorLocal(c: CopiaLocal): MotorCalculo {
  return new MotorCalculo(
    {
      obtenerVigente: async (codigo: string, fecha: Date) => {
        const filas = (c.parametros ?? [])
          .filter((p) => p.codigo === codigo && new Date(p.vigenteDesde) <= fecha && (!p.vigenteHasta || new Date(p.vigenteHasta) >= fecha))
          .sort((a, b) => new Date(b.vigenteDesde).getTime() - new Date(a.vigenteDesde).getTime());
        if (!filas.length) throw new Error(`No hay un valor vigente para el parámetro '${codigo}' (datos guardados)`);
        return { valor: filas[0].valor, vigenteDesde: new Date(filas[0].vigenteDesde), fuente: filas[0].fuente };
      },
    },
    {
      obtenerPlantilla: async (tipo: number) => {
        const p = (c.plantillas ?? []).find((x) => x.tipo === tipo && x.activa !== false);
        if (!p) throw new Error(`Tipo de plantilla ${tipo} no existe o está desactivada`);
        return p;
      },
    },
  );
}

function simularLocal(req: HttpRequest<any>, c: CopiaLocal): Observable<HttpResponse<unknown>> | null {
  const m = req.url.slice(API.length).match(/^\/motor-liquidacion\/simular\/(independiente|empleador|parcial)$/);
  if (req.method !== 'POST' || !m || !c.parametros?.length) return null;
  const d = req.body ?? {};
  const motor = motorLocal(c);
  const calculo = m[1] === 'independiente'
    ? motor.liquidarIndependiente({ tipoPlantilla: d.tipoPlantilla, ibc: d.ibc, diasMora: d.diasMora, diasCotizados: d.diasCotizados, valorAfiliacion: d.valorAfiliacion })
    : m[1] === 'empleador'
      ? motor.liquidarEmpleador({ modalidad: d.modalidad, ibc: d.ibc, claseRiesgoArl: d.claseRiesgoArl, diasMora: d.diasMora, diasCotizados: d.diasCotizados, valorAfiliacion: d.valorAfiliacion })
      : motor.liquidarParcial({ diasCotizados: d.diasCotizados, claseRiesgoArl: d.claseRiesgoArl, codigoCaja: d.codigoCaja, diasMora: d.diasMora, valorAfiliacion: d.valorAfiliacion });
  return from(calculo.then(
    (r) => new HttpResponse({ status: 200, body: r, url: req.url }),
    (e) => { throw new HttpErrorResponse({ status: 400, error: { message: e?.message ?? 'No se pudo calcular' }, url: req.url }); },
  ));
}

function desdeCopia(req: HttpRequest<unknown>, datos: DatosLocalesServicio): Observable<HttpResponse<unknown>> | null {
  if (!req.url.startsWith(API) || !datos.datos) return null;
  const simulado = simularLocal(req as HttpRequest<any>, datos.datos);
  if (simulado) return simulado;
  if (req.method !== 'GET') return null;
  if (req.url.slice(API.length).split('?')[0] === '/liquidacion/plantillas' && datos.datos.plantillas) {
    return of(new HttpResponse({ status: 200, body: datos.datos.plantillas, url: req.url }));
  }
  let cuerpo = responder(req, datos.datos);
  if (cuerpo === undefined) cuerpo = datos.respuestaGuardada(req.urlWithParams);
  if (cuerpo === undefined) cuerpo = vacio(rutaDe(req.url));
  return cuerpo === undefined ? null : of(new HttpResponse({ status: 200, body: cuerpo, url: req.url }));
}

// Cambio hecho sin internet: se guarda para subirlo después.
function guardarParaDespues(req: HttpRequest<unknown>, cola: ColaCambiosServicio): Observable<HttpResponse<unknown>> | null {
  if (!cola.admite(req.method, req.url)) return null;
  return from(cola.encolar(req.method, req.url, req.body)).pipe(
    map((body) => new HttpResponse({ status: 200, body, url: req.url })),
    catchError((e) => throwError(() => new HttpErrorResponse({ status: 0, error: { message: e?.message ?? 'Sin internet' }, url: req.url }))),
  );
}

export const sinInternetInterceptor: HttpInterceptorFn = (req, next) => {
  const datos = inject(DatosLocalesServicio);
  const cola = inject(ColaCambiosServicio);
  // Lo que sube la cola misma va directo al servidor (sin volver a guardarse).
  if (req.headers.has('x-anturi-cola')) {
    return next(req.clone({ headers: req.headers.delete('x-anturi-cola') }));
  }
  // Sin internet: ni se intenta - consulta desde la copia, cambio a la cola.
  if (!navigator.onLine) {
    const local = desdeCopia(req, datos) ?? guardarParaDespues(req, cola);
    if (local) return local;
  }
  // Con internet: se recuerda la última respuesta de las pantallas de RECORDAR.
  const recordar = req.method === 'GET' && req.url.startsWith(API) && RECORDAR.test(rutaDe(req.url));
  return next(req).pipe(
    tap((ev) => { if (recordar && ev instanceof HttpResponse && ev.status === 200) datos.guardarRespuesta(req.urlWithParams, ev.body); }),
    catchError((error: HttpErrorResponse) => {
      // El servidor no responde (internet del edificio caído, etc.)
      if (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504) {
        const local = desdeCopia(req, datos) ?? guardarParaDespues(req, cola);
        if (local) return local;
      }
      return throwError(() => error);
    }),
  );
};
