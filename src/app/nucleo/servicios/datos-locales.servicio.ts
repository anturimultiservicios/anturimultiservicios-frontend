import { Injectable, NgZone } from '@angular/core';
import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { entorno } from '../../../environments/entorno';

// 2026-10-09 (plan "sin internet", paso 2): copia en el equipo de lo que la
// persona puede ver (afiliados, empresas, personal, pagos del último año)
// para seguir buscando y consultando sin internet.
//
// Seguridad (decisión con Cristopher):
// - La copia se guarda CIFRADA (AES-256-GCM). La llave se protege con la
//   contraseña de la persona (PBKDF2): si se roban el equipo, sin la
//   contraseña los datos no se pueden leer.
// - Mientras la pestaña/navegador siga abierto, la llave queda en la sesión
//   del navegador (se borra al cerrarlo). Si se cierra sin internet, la
//   página pide la contraseña para abrir los datos guardados.
// - Sin claves de portales, sin documentos, sin historial.
// - Se borra al cerrar sesión, y sola si lleva más de 7 días sin actualizarse.
export interface CopiaLocal {
  generado: string;
  afiliados: any[];
  empresas: any[];
  personal: any[];
  pagos: any[];
}

type EstadoCopia = 'sin-copia' | 'bloqueada' | 'lista';

const BD = 'anturi-datos-locales';
const ALMACEN = 'copias';
const VIGENCIA_MS = 7 * 24 * 3600_000;
const CADA_MS = 10 * 60_000;
const ITERACIONES = 210_000;

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

@Injectable({ providedIn: 'root' })
export class DatosLocalesServicio {
  readonly estado$ = new BehaviorSubject<EstadoCopia>('sin-copia');
  readonly generado$ = new BehaviorSubject<Date | null>(null);
  private copia: CopiaLocal | null = null;
  private llave: CryptoKey | null = null;
  private iniciado = false;
  private sincronizando = false;
  // HttpClient "crudo" (sin interceptores): la copia no debe pasar por el
  // interceptor de sin-internet, que justamente la usa.
  private http: HttpClient;

  constructor(backend: HttpBackend, private zona: NgZone) {
    this.http = new HttpClient(backend);
  }

  get disponible(): boolean {
    return typeof indexedDB !== 'undefined' && !!(globalThis.crypto && crypto.subtle);
  }

  get datos(): CopiaLocal | null {
    return this.copia;
  }

  private get usuarioId(): number | null {
    try { return JSON.parse(localStorage.getItem('anturi_usuario') || 'null')?.id ?? null; } catch { return null; }
  }

  // ── Ciclo de vida ──────────────────────────────────────────────────────
  // Lo llaman los paneles al abrir: intenta abrir la copia guardada con la
  // llave de la sesión y, con internet, la actualiza cada 10 minutos.
  async iniciar(): Promise<void> {
    if (!this.disponible || this.iniciado || !this.usuarioId) return;
    this.iniciado = true;
    await this.recuperarLlaveDeSesion();
    await this.abrirCopiaGuardada();
    this.zona.runOutsideAngular(() => {
      setInterval(() => this.sincronizar(), CADA_MS);
      window.addEventListener('online', () => this.sincronizar());
    });
    this.sincronizar();
  }

  // Al iniciar sesión (con internet): la contraseña protege la llave.
  async prepararLlave(contrasena: string, usuarioId: number): Promise<void> {
    if (!this.disponible || !contrasena) return;
    try {
      const guardada = this.leerLlaveEnvuelta(usuarioId);
      let llave: CryptoKey | null = null;
      if (guardada) llave = await this.desenvolver(guardada, contrasena).catch(() => null);
      if (!llave) {
        // primera vez en este equipo, o cambió la contraseña: llave nueva
        llave = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        await this.borrarCopia(usuarioId);
        this.guardarLlaveEnvuelta(usuarioId, await this.envolver(llave, contrasena));
      }
      this.llave = llave;
      await this.guardarLlaveEnSesion(llave);
    } catch { /* sin cifrado disponible: simplemente no hay copia */ }
  }

  // Sin internet y con el navegador recién abierto: abrir con la contraseña.
  async desbloquear(contrasena: string): Promise<boolean> {
    const uid = this.usuarioId;
    const guardada = uid ? this.leerLlaveEnvuelta(uid) : null;
    if (!guardada) return false;
    const llave = await this.desenvolver(guardada, contrasena).catch(() => null);
    if (!llave) return false;
    this.llave = llave;
    await this.guardarLlaveEnSesion(llave);
    await this.abrirCopiaGuardada();
    return this.estado$.value === 'lista';
  }

  // Cerrar sesión: no queda nada en el equipo.
  async borrarTodo(): Promise<void> {
    const uid = this.usuarioId;
    this.copia = null;
    this.llave = null;
    this.estado$.next('sin-copia');
    this.generado$.next(null);
    try { sessionStorage.removeItem('anturi_llave_sesion'); } catch { /* */ }
    if (uid) {
      try { localStorage.removeItem(`anturi_llave_local_${uid}`); } catch { /* */ }
      await this.borrarCopia(uid);
    }
  }

  async sincronizar(): Promise<void> {
    const uid = this.usuarioId;
    const token = localStorage.getItem('anturi_token');
    if (this.sincronizando || !uid || !token || !navigator.onLine || !this.llave) return;
    this.sincronizando = true;
    try {
      const copia = await firstValueFrom(this.http.get<CopiaLocal>(`${entorno.urlApi}/sincronizacion/copia`, {
        headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
      }));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.llave, new TextEncoder().encode(JSON.stringify(copia)));
      await this.guardarEnBd(uid, { iv: b64(iv), datos: cifrado, generado: copia.generado });
      this.zona.run(() => this.ponerCopia(copia));
    } catch {
      /* token vencido o sin conexión: se intenta en la próxima vuelta */
    } finally {
      this.sincronizando = false;
    }
  }

  // ── Internos ───────────────────────────────────────────────────────────
  private ponerCopia(copia: CopiaLocal): void {
    this.copia = copia;
    this.estado$.next('lista');
    this.generado$.next(new Date(copia.generado));
  }

  private async abrirCopiaGuardada(): Promise<void> {
    const uid = this.usuarioId;
    if (!uid) return;
    const fila = await this.leerDeBd(uid).catch(() => null);
    if (!fila) { this.estado$.next('sin-copia'); return; }
    if (Date.now() - new Date(fila.generado).getTime() > VIGENCIA_MS) {
      await this.borrarCopia(uid);
      this.estado$.next('sin-copia');
      return;
    }
    if (!this.llave) { this.estado$.next('bloqueada'); this.generado$.next(new Date(fila.generado)); return; }
    try {
      const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(fila.iv) }, this.llave, fila.datos);
      this.zona.run(() => this.ponerCopia(JSON.parse(new TextDecoder().decode(plano))));
    } catch {
      this.estado$.next('bloqueada');
    }
  }

  private async derivar(contrasena: string, sal: Uint8Array): Promise<CryptoKey> {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(contrasena), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: sal, iterations: ITERACIONES, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
    );
  }

  private async envolver(llave: CryptoKey, contrasena: string) {
    const sal = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const kek = await this.derivar(contrasena, sal);
    const cruda = await crypto.subtle.exportKey('raw', llave);
    const envuelta = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, cruda);
    return { sal: b64(sal), iv: b64(iv), llave: b64(envuelta) };
  }

  private async desenvolver(g: { sal: string; iv: string; llave: string }, contrasena: string): Promise<CryptoKey> {
    const kek = await this.derivar(contrasena, deB64(g.sal));
    const cruda = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(g.iv) }, kek, deB64(g.llave));
    return crypto.subtle.importKey('raw', cruda, 'AES-GCM', true, ['encrypt', 'decrypt']);
  }

  private leerLlaveEnvuelta(uid: number): { sal: string; iv: string; llave: string } | null {
    try { return JSON.parse(localStorage.getItem(`anturi_llave_local_${uid}`) || 'null'); } catch { return null; }
  }

  private guardarLlaveEnvuelta(uid: number, v: object): void {
    try { localStorage.setItem(`anturi_llave_local_${uid}`, JSON.stringify(v)); } catch { /* */ }
  }

  private async guardarLlaveEnSesion(llave: CryptoKey): Promise<void> {
    try { sessionStorage.setItem('anturi_llave_sesion', b64(await crypto.subtle.exportKey('raw', llave))); } catch { /* */ }
  }

  private async recuperarLlaveDeSesion(): Promise<void> {
    try {
      const s = sessionStorage.getItem('anturi_llave_sesion');
      if (s) this.llave = await crypto.subtle.importKey('raw', deB64(s), 'AES-GCM', true, ['encrypt', 'decrypt']);
    } catch { this.llave = null; }
  }

  private abrirBd(): Promise<IDBDatabase> {
    return new Promise((ok, mal) => {
      const r = indexedDB.open(BD, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
  }

  private async guardarEnBd(uid: number, valor: object): Promise<void> {
    const bd = await this.abrirBd();
    await new Promise<void>((ok, mal) => {
      const tx = bd.transaction(ALMACEN, 'readwrite');
      tx.objectStore(ALMACEN).put(valor, `u${uid}`);
      tx.oncomplete = () => ok();
      tx.onerror = () => mal(tx.error);
    });
    bd.close();
  }

  private async leerDeBd(uid: number): Promise<{ iv: string; datos: ArrayBuffer; generado: string } | null> {
    const bd = await this.abrirBd();
    const v = await new Promise<any>((ok, mal) => {
      const r = bd.transaction(ALMACEN, 'readonly').objectStore(ALMACEN).get(`u${uid}`);
      r.onsuccess = () => ok(r.result ?? null);
      r.onerror = () => mal(r.error);
    });
    bd.close();
    return v;
  }

  private async borrarCopia(uid: number): Promise<void> {
    try {
      const bd = await this.abrirBd();
      await new Promise<void>((ok) => {
        const tx = bd.transaction(ALMACEN, 'readwrite');
        tx.objectStore(ALMACEN).delete(`u${uid}`);
        tx.oncomplete = () => ok();
        tx.onerror = () => ok();
      });
      bd.close();
    } catch { /* */ }
  }
}
