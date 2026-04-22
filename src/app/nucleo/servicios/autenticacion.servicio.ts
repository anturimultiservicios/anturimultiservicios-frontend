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

  iniciarSesion(correo: string, contrasena: string): Observable<RespuestaAuth> {
    return this.http
      .post<RespuestaAuth>(`${this.URL}/ingresar`, { correo, contrasena })
      .pipe(
        tap((res) => {
          localStorage.setItem('anturi_token', res.acceso);
          localStorage.setItem('anturi_refresco', res.refresco);
          localStorage.setItem('anturi_usuario', JSON.stringify(res.usuario));
          this.usuario$.next(res.usuario);
        })
      );
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
