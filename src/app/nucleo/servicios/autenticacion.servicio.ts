import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { entorno } from '../../../environments/entorno';
import { UsuarioSistema } from '../modelos/usuario.modelo';

interface RespuestaAuth {
  acceso: string;
  refresco: string;
  usuario: UsuarioSistema;
}

// 2026-09-29: el backend (D3+D4) puede responder /ingresar con contraseña
// correcta pero SIN sesion real todavia, cuando hace falta un paso mas.
// `alcance` distingue cual - ver autenticacion.servicio.ts (backend) para
// el detalle real de cada rama. Sin esto el login asumia siempre la forma
// completa y se rompia en produccion apenas se exigio dispositivo.
export interface RespuestaLoginParcial {
  alcance: 'debe-cambiar-contrasena' | 'pre-auth' | 'solo-registro-dispositivo';
  tokenTemporal: string;
  opcionesDispositivo?: any;
  mensaje: string;
  usuario: Partial<UsuarioSistema>;
}

export type RespuestaLogin = RespuestaAuth | RespuestaLoginParcial;

export function esLoginCompleto(res: RespuestaLogin): res is RespuestaAuth {
  return (res as RespuestaAuth).acceso !== undefined;
}

@Injectable({ providedIn: 'root' })
export class AutenticacionServicio {
  private readonly URL = `${entorno.urlApi}/autenticacion`;
  private usuario$ = new BehaviorSubject<UsuarioSistema | null>(null);

  get usuarioActual$() {
    return this.usuario$.asObservable();
  }

  get usuarioActual(): UsuarioSistema | null {
    return this.usuario$.value;
  }

  get estaAutenticado(): boolean {
    return !!this.obtenerToken();
  }

  constructor(private http: HttpClient, private router: Router) {
    this.cargarUsuarioGuardado();
  }

  // 2026-09-29: ya NO guarda nada automaticamente - antes asumia que la
  // respuesta siempre traia {acceso,refresco,usuario} y con eso guardaba
  // "undefined" como token cuando el backend devolvia una de las ramas
  // parciales (debe-cambiar-contrasena/pre-auth/solo-registro-dispositivo).
  // El componente de login decide que hacer segun `esLoginCompleto()` y
  // llama guardarSesion() el solo cuando de verdad hay una sesion real.
  iniciarSesion(correo: string, contrasena: string): Observable<RespuestaLogin> {
    return this.http.post<RespuestaLogin>(`${this.URL}/ingresar`, { correo, contrasena });
  }

  guardarSesion(res: RespuestaAuth): void {
    localStorage.setItem('anturi_token', res.acceso);
    localStorage.setItem('anturi_refresco', res.refresco);
    localStorage.setItem('anturi_usuario', JSON.stringify(res.usuario));
    this.usuario$.next(res.usuario);
  }

  // Guarda el tokenTemporal (alcance acotado) como si fuera el token normal
  // - el interceptor lo manda igual en el header Authorization, y
  // AlcanceGuardia (backend) es quien realmente limita a que rutas puede
  // llegar. NUNCA se guarda usuario/refresco reales con esto - no es una
  // sesion de verdad todavia.
  guardarTokenTemporal(token: string): void {
    localStorage.setItem('anturi_token', token);
  }

  // Limpieza si el usuario cancela o falla el paso de dispositivo/cambio de
  // clave - para no dejar un tokenTemporal viejo dando vueltas.
  limpiarTokenTemporal(): void {
    localStorage.removeItem('anturi_token');
  }

  // Paso 2 del login (D3+D4): completa la verificacion WebAuthn de un
  // dispositivo ya autorizado (alcance='pre-auth'). Requiere el
  // tokenTemporal ya guardado via guardarTokenTemporal() - el interceptor
  // lo adjunta solo.
  verificarDispositivo(respuesta: any): Observable<RespuestaAuth> {
    return this.http.post<RespuestaAuth>(`${this.URL}/verificar-dispositivo`, { respuesta });
  }

  // Reemplaza la contrasena temporal (alcance='debe-cambiar-contrasena').
  // Requiere el tokenTemporal ya guardado. No devuelve sesion - hay que
  // iniciar sesion de nuevo con la contrasena nueva.
  establecerContrasenaInicial(contrasenaNueva: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.URL}/establecer-contrasena-inicial`, { contrasenaNueva });
  }

  cerrarSesion(): void {
    const token = this.obtenerToken();
    if (token) {
      this.http.post(`${this.URL}/cerrar-sesion`, {}).subscribe();
    }
    localStorage.removeItem('anturi_token');
    localStorage.removeItem('anturi_refresco');
    localStorage.removeItem('anturi_usuario');
    this.usuario$.next(null);
    this.router.navigate(['/ingresar']);
  }

  recuperarContrasena(correo: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(
      `${this.URL}/recuperar-contrasena`,
      { correo }
    );
  }

  restablecerContrasena(
    token: string,
    nuevaContrasena: string
  ): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(
      `${this.URL}/restablecer-contrasena`,
      { token, nuevaContrasena }
    );
  }

  obtenerToken(): string | null {
    return localStorage.getItem('anturi_token');
  }

  obtenerTokenRefresco(): string | null {
    return localStorage.getItem('anturi_refresco');
  }

  refrescarToken(): Observable<{ acceso: string }> {
    const refresco = this.obtenerTokenRefresco();
    return this.http
      .post<{ acceso: string }>(`${this.URL}/refrescar`, { tokenRefresco: refresco })
      .pipe(
        tap((res) => {
          localStorage.setItem('anturi_token', res.acceso);
        })
      );
  }

  tieneRol(roles: string[]): boolean {
    const usuario = this.usuarioActual;
    if (!usuario) return false;
    return roles.includes(usuario.rol);
  }

  private cargarUsuarioGuardado(): void {
    const guardado = localStorage.getItem('anturi_usuario');
    if (guardado) {
      try {
        this.usuario$.next(JSON.parse(guardado));
      } catch {
        localStorage.removeItem('anturi_usuario');
      }
    }
  }
}
