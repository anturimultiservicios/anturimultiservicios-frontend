import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { entorno } from '../../../environments/entorno';
import { DatosLocalesServicio } from './datos-locales.servicio';

// 2026-10-09 (plan "sin internet", paso 3): cambios hechos sin internet.
// Cada cambio (afiliado nuevo, edición, solicitud, pago) se guarda cifrado en
// el equipo, la pantalla sigue como si se hubiera guardado, y cuando vuelve
// el internet se suben solos, en orden. El servidor reconoce cada cambio por
// su id (x-operacion-id) y nunca lo guarda dos veces. Si una ficha cambió en
// el sistema mientras tanto, ese cambio queda "para revisar" en vez de pisar
// el otro.
export interface CambioPendiente {
  id: string;
  metodo: 'POST' | 'PATCH' | 'PUT';
  ruta: string;            // relativa a la API, ej. /afiliados/12
  cuerpo: any;
  creadoEn: string;
  baseFecha: string | null; // de cuándo era la copia con la que se trabajó
  descripcion: string;
  idTemporal?: number;      // afiliado creado sin internet (id negativo)
  error?: string;
}

export interface EstadoCola {
  pendientes: number;
  subiendo: boolean;
  conProblema: CambioPendiente[];
  recienSubidos: number;
}

// Lo que se puede hacer sin internet (POST/PATCH). El resto necesita conexión.
const RUTAS = [
  { metodo: 'POST', patron: /^\/afiliados$/, que: 'Afiliado nuevo' },
  { metodo: 'PATCH', patron: /^\/afiliados\/-?\d+$/, que: 'Cambio en ficha de afiliado' },
  { metodo: 'PATCH', patron: /^\/empresas\/\d+$/, que: 'Cambio en ficha de empresa' },
  { metodo: 'POST', patron: /^\/solicitudes-cambio$/, que: 'Solicitud de cambio' },
  { metodo: 'POST', patron: /^\/pagos\/completo$/, que: 'Pago' },
  { metodo: 'POST', patron: /^\/pagos\/empresa$/, que: 'Pago de cuenta de empresa' },
  { metodo: 'PATCH', patron: /^\/recordatorios-llamada\/\d+\/nota$/, que: 'Nota de llamada' },
  { metodo: 'PUT', patron: /^\/notificaciones\/\d+\/leida$/, que: 'Notificación leída' },
  { metodo: 'PUT', patron: /^\/notificaciones\/marcar-todas$/, que: 'Notificaciones leídas' },
];

const API = entorno.urlApi.replace(/\/$/, '');

@Injectable({ providedIn: 'root' })
export class ColaCambiosServicio {
  readonly estado$ = new BehaviorSubject<EstadoCola>({ pendientes: 0, subiendo: false, conProblema: [], recienSubidos: 0 });
  private iniciado = false;
  private procesando = false;

  constructor(private http: HttpClient, private datos: DatosLocalesServicio, private zona: NgZone) {}

  // ¿Este pedido se puede guardar para subir después?
  admite(metodo: string, url: string): boolean {
    if (!url.startsWith(API)) return false;
    const ruta = this.ruta(url);
    return RUTAS.some((r) => r.metodo === metodo && r.patron.test(ruta));
  }

  async iniciar(): Promise<void> {
    if (this.iniciado) return;
    this.iniciado = true;
    await this.refrescarEstado();
    this.zona.runOutsideAngular(() => {
      window.addEventListener('online', () => setTimeout(() => this.procesar(), 1500));
      setInterval(() => this.procesar(), 60_000);
    });
    this.procesar();
  }

  // Guarda el cambio y devuelve la respuesta que la pantalla espera.
  async encolar(metodo: string, url: string, cuerpo: any): Promise<any> {
    if (!this.datos.llaveLista) {
      throw new Error('Para guardar sin internet, primero abra los datos guardados con su contraseña (aviso de arriba).');
    }
    const ruta = this.ruta(url);
    const regla = RUTAS.find((r) => r.metodo === metodo && r.patron.test(ruta))!;
    const copia = this.datos.datos;
    const cambio: CambioPendiente = {
      id: this.nuevoId(),
      metodo: metodo as 'POST' | 'PATCH' | 'PUT',
      ruta,
      cuerpo: cuerpo ?? {},
      creadoEn: new Date().toISOString(),
      baseFecha: copia?.generado ?? null,
      descripcion: `${regla.que}${this.nombreDe(ruta, cuerpo)}`,
    };
    const respuesta = this.aplicarEnCopia(cambio);
    const cola = await this.datos.leerCola<CambioPendiente>();
    cola.push(cambio);
    await this.datos.guardarCola(cola);
    await this.datos.persistir();
    await this.refrescarEstado();
    return respuesta;
  }

  // Sube los cambios en orden. Se detiene si se va el internet otra vez.
  async procesar(): Promise<void> {
    if (this.procesando || !navigator.onLine || !this.datos.llaveLista || !localStorage.getItem('anturi_token')) return;
    // se marca de una vez: el aviso de "volvió el internet" puede llegar dos
    // veces seguidas y no se debe subir nada dos veces
    this.procesando = true;
    let cola = await this.datos.leerCola<CambioPendiente>();
    const pendientes = cola.filter((c) => !c.error);
    if (!pendientes.length) { this.procesando = false; await this.refrescarEstado(); return; }
    this.emitir({ subiendo: true });
    let subidos = 0;
    const idsReales = new Map<number, number>(); // temporal -> real
    try {
      for (const cambio of pendientes) {
        this.reemplazarTemporales(cambio, idsReales);
        if (/\/-\d+/.test(cambio.ruta) || this.tieneTemporal(cambio.cuerpo)) {
          cambio.error = 'Depende de un afiliado nuevo que no se pudo subir.';
          await this.guardar(cola);
          continue;
        }
        try {
          const headers: Record<string, string> = { 'x-operacion-id': cambio.id, 'x-anturi-cola': '1' };
          if (cambio.metodo === 'PATCH' && cambio.baseFecha) headers['x-base-fecha'] = cambio.baseFecha;
          const res: any = await firstValueFrom(this.http.request(cambio.metodo, API + cambio.ruta, { body: cambio.cuerpo, headers: new HttpHeaders(headers) }));
          if (cambio.idTemporal && res?.id) idsReales.set(cambio.idTemporal, res.id);
          cola = cola.filter((c) => c.id !== cambio.id);
          subidos++;
          await this.guardar(cola);
        } catch (e) {
          const err = e as HttpErrorResponse;
          if (!err || err.status === 0 || err.status >= 500 || err.status === 401) break; // sin conexión / servidor caído / sesión: se reintenta luego
          const m = err.error?.message;
          cambio.error = (Array.isArray(m) ? m.join('. ') : m) || `No se pudo subir (error ${err.status}).`;
          await this.guardar(cola);
        }
      }
      // los cambios ya subidos que referencian un afiliado nuevo: actualizar ids en los que quedan
      for (const c of cola) this.reemplazarTemporales(c, idsReales);
      await this.guardar(cola);
    } finally {
      this.procesando = false;
      await this.refrescarEstado(subidos);
      if (subidos > 0) this.datos.sincronizar(); // trae la copia actualizada del servidor
    }
  }

  async descartar(id: string): Promise<void> {
    const cola = (await this.datos.leerCola<CambioPendiente>()).filter((c) => c.id !== id);
    await this.datos.guardarCola(cola);
    await this.refrescarEstado();
  }

  async reintentar(id: string): Promise<void> {
    const cola = await this.datos.leerCola<CambioPendiente>();
    const c = cola.find((x) => x.id === id);
    if (c) { delete c.error; c.baseFecha = null; } // reintento consciente: sin control de "cambió mientras tanto"
    await this.datos.guardarCola(cola);
    await this.refrescarEstado();
    this.procesar();
  }

  // ── Internos ───────────────────────────────────────────────────────────
  private ruta(url: string): string {
    return url.slice(API.length).split('?')[0].replace(/\/$/, '');
  }

  private nuevoId(): string {
    const b = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }

  private nuevoIdTemporal(): number {
    let n = -1;
    try { n = Number(localStorage.getItem('anturi_id_temporal') || '0') - 1; localStorage.setItem('anturi_id_temporal', String(n)); } catch { n = -Date.now(); }
    return n;
  }

  private nombreDe(ruta: string, cuerpo: any): string {
    const c = this.datos.datos;
    const m = ruta.match(/^\/afiliados\/(-?\d+)$/);
    const af = m ? c?.afiliados.find((a) => a.id === Number(m[1])) : null;
    if (af) return `: ${af.nombres} ${af.apellidos}`;
    if (cuerpo?.nombres) return `: ${cuerpo.nombres} ${cuerpo.apellidos ?? ''}`.trimEnd();
    if (cuerpo?.afiliadoId) {
      const a = c?.afiliados.find((x) => x.id === cuerpo.afiliadoId);
      if (a) return `: ${a.nombres} ${a.apellidos}`;
    }
    if (cuerpo?.empresaId) {
      const e = c?.empresas.find((x) => x.id === cuerpo.empresaId);
      if (e) return `: ${e.razonSocial}`;
    }
    const me = ruta.match(/^\/empresas\/(\d+)$/);
    const emp = me ? c?.empresas.find((x) => x.id === Number(me[1])) : null;
    return emp ? `: ${emp.razonSocial}` : '';
  }

  // Refleja el cambio en la copia local (para que al buscar ya se vea) y arma
  // la respuesta que esperaría la pantalla.
  private aplicarEnCopia(cambio: CambioPendiente): any {
    const c = this.datos.datos;
    const ahora = new Date().toISOString();
    const r = cambio.ruta;
    if (r === '/afiliados') {
      const id = this.nuevoIdTemporal();
      cambio.idTemporal = id;
      const nuevo = { estado: 'ACTIVO', seguros: [], persona: { tipoDocumento: cambio.cuerpo.tipoDocumento ?? 'CC' }, sucursal: null, ...cambio.cuerpo, id, sinSubir: true, creadoEn: ahora };
      c?.afiliados.push(nuevo);
      return nuevo;
    }
    let m = r.match(/^\/afiliados\/(-?\d+)$/);
    if (m) {
      const a = c?.afiliados.find((x) => x.id === Number(m![1]));
      if (a) Object.assign(a, cambio.cuerpo, { sinSubir: true });
      return { ...(a ?? {}), ...cambio.cuerpo };
    }
    m = r.match(/^\/empresas\/(\d+)$/);
    if (m) {
      const e = c?.empresas.find((x) => x.id === Number(m![1]));
      if (e) Object.assign(e, cambio.cuerpo, { sinSubir: true });
      return { ...(e ?? {}), ...cambio.cuerpo };
    }
    if (r === '/pagos/completo' || r === '/pagos/empresa') {
      c?.pagos.push({
        id: this.nuevoIdTemporal(),
        afiliadoId: cambio.cuerpo.afiliadoId ?? null,
        empresaId: cambio.cuerpo.empresaId ?? null,
        fechaPago: ahora,
        fechaPeriodo: ahora,
        mesesCubiertos: cambio.cuerpo.mesesCubiertos ?? 1,
        monto: cambio.cuerpo.monto,
        canal: cambio.cuerpo.canal,
        sinSubir: true,
      });
      return { id: -1, ...cambio.cuerpo, sinInternet: true };
    }
    if (r === '/solicitudes-cambio') {
      return { id: -1, estado: 'PENDIENTE', ...cambio.cuerpo, creadoEn: ahora, sinInternet: true };
    }
    return { ok: true, sinInternet: true };
  }

  private reemplazarTemporales(cambio: CambioPendiente, ids: Map<number, number>): void {
    if (!ids.size) return;
    cambio.ruta = cambio.ruta.replace(/\/(-\d+)(?=\/|$)/g, (t, n) => (ids.has(Number(n)) ? `/${ids.get(Number(n))}` : t));
    const recorrer = (o: any) => {
      if (!o || typeof o !== 'object') return;
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (typeof v === 'number' && v < 0 && ids.has(v) && /id$/i.test(k)) o[k] = ids.get(v);
        else if (typeof v === 'object') recorrer(v);
      }
    };
    recorrer(cambio.cuerpo);
  }

  private tieneTemporal(o: any): boolean {
    if (!o || typeof o !== 'object') return false;
    return Object.keys(o).some((k) => (typeof o[k] === 'number' && o[k] < 0 && /id$/i.test(k)) || (typeof o[k] === 'object' && this.tieneTemporal(o[k])));
  }

  private async guardar(cola: CambioPendiente[]): Promise<void> {
    await this.datos.guardarCola(cola).catch(() => undefined);
  }

  private emitir(parcial: Partial<EstadoCola>): void {
    this.zona.run(() => this.estado$.next({ ...this.estado$.value, ...parcial }));
  }

  private async refrescarEstado(recienSubidos = 0): Promise<void> {
    const cola = await this.datos.leerCola<CambioPendiente>();
    this.emitir({
      pendientes: cola.filter((c) => !c.error).length,
      conProblema: cola.filter((c) => !!c.error),
      subiendo: this.procesando,
      recienSubidos,
    });
  }
}
