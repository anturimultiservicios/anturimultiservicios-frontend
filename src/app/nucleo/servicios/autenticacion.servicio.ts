import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, throwError } from 'rxjs';
import { entorno } from '../../../environments/entorno';
import { UsuarioSistema } from '../modelos/usuario.modelo';

interface RespuestaLoginCompleto {
  acceso: string;
  refresco: string;
  usuario: UsuarioSistema;
}

// D3+D4: lo que devuelve /ingresar cuando dispositivoObligatorio está
// activo y la contraseña fue correcta - todavía NO son credenciales de
// sesión, es un estado intermedio de alcance acotado (ver AlcanceGuardia
// en el backend, DISENO-LOGIN-WEBAUTHN-D3-2026.md). tokenTemporal nunca
// se guarda en localStorage - vive solo en memoria de este servicio,
// para que ningún guard de ruta (autenticacionGuardia lee obtenerToken())
// pueda confundir este estado con una sesión real.
interface RespuestaSegundoFactorRequerido {
  alcance: 'pre-auth' | 'solo-registro-dispositivo';
  tokenTemporal: string;
  opcionesDispositivo?: any;
  mensaje: string;
}

type RespuestaIniciarSesion = RespuestaLoginCompleto | RespuestaSegundoFactorRequerido;

function esLoginCompleto(res: RespuestaIniciarSesion): res is RespuestaLoginCompleto {
  // 'usuario' está presente en AMBAS formas de respuesta (el backend lo
  // manda también en el segundo factor, para poder personalizar esa
  // pantalla) - el único campo exclusivo del login completo es 'acceso'.
  return 'acceso' in res;
}

@Injectable({ providedIn: 'root' })
export class AutenticacionServicio {
  private readonly URL = `${entorno.urlApi}/autenticacion`;
  private usuario$ = new BehaviorSubject<UsuarioSistema | null>(null);

  // Estado del segundo factor - deliberadamente NUNCA en localStorage, solo
  // en memoria del servicio. Se pierde solo con un refresh de página (lo
  // cual es correcto: obliga a volver a ingresar la contraseña, no deja
  // un login a medias sobreviviendo un reinicio del navegador).
  private tokenTemporalPreAuth: string | null = null;

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

  // D3+D4: la respuesta tiene dos formas posibles (ver RespuestaIniciarSesion
  // arriba). Cuando es el segundo factor requerido, el tokenTemporal queda
  // guardado en memoria (this.tokenTemporalPreAuth) - NUNCA se escriben
  // tokens de sesión ni el usuario hasta que verificarDispositivo() termine
  // con éxito. Con dispositivoObligatorio=false esto sigue siendo
  // exactamente el camino de siempre (esLoginCompleto siempre da true).
  iniciarSesion(correo: string, contrasena: string): Observable<RespuestaIniciarSesion> {
    return this.http
      .post<RespuestaIniciarSesion>(`${this.URL}/ingresar`, { correo, contrasena })
      .pipe(
        tap((res) => {
          if (esLoginCompleto(res)) {
            this.guardarSesionCompleta(res);
          } else {
            this.tokenTemporalPreAuth = res.tokenTemporal;
          }
        })
      );
  }

  // Paso 2. Envía la aserción WebAuthn ya convertida (ver webauthn.util.ts)
  // con el tokenTemporal guardado en memoria como Bearer explícito - nunca
  // pasa por el interceptor normal (que usa obtenerToken()/localStorage),
  // para que este estado acotado no se confunda con una sesión real en
  // ningún otro punto de la app.
  verificarDispositivo(respuesta: any): Observable<RespuestaLoginCompleto> {
    if (!this.tokenTemporalPreAuth) {
      return throwError(() => new Error('No hay una verificación de dispositivo en curso.'));
    }
    return this.http
      .post<RespuestaLoginCompleto>(
        `${this.URL}/verificar-dispositivo`,
        { respuesta },
        { headers: { Authorization: `Bearer ${this.tokenTemporalPreAuth}` } }
      )
      .pipe(
        tap((res) => {
          this.guardarSesionCompleta(res);
          this.tokenTemporalPreAuth = null;
        })
      );
  }

  // Cancelar/volver atrás en el paso 2 - limpia el estado temporal sin
  // dejar ningún residuo, sin llamar al backend (el tokenTemporal
  // simplemente expira solo si nadie lo usa, no hace falta invalidarlo).
  cancelarVerificacionDispositivo(): void {
    this.tokenTemporalPreAuth = null;
  }

  private guardarSesionCompleta(res: RespuestaLoginCompleto): void {
    localStorage.setItem('anturi_token', res.acceso);
    localStorage.setItem('anturi_refresco', res.refresco);
    localStorage.setItem('anturi_usuario', JSON.stringify(res.usuario));
    this.usuario$.next(res.usuario);
  }

  cerrarSesion(): void {
    const token = this.obtenerToken();
    if (token) {
      this.http.post(`${this.URL}/cerrar-sesion`, {}).subscribe();
    }
    localStorage.removeItem('anturi_token');
    localStorage.removeItem('anturi_refresco');
    localStorage.removeItem('anturi_usuario');
    this.tokenTemporalPreAuth = null; // defensivo - no debería quedar nada acá al llegar a logout
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
