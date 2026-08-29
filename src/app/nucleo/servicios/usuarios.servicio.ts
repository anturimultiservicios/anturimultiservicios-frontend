import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface UsuarioSistema {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  rol: 'SUPER_ADMIN' | 'ADMIN' | 'SECRETARIA';
  activo: boolean;
  fotoPerfil?: string;
  permisos?: any;
  creadoEn: string;
}

export interface CrearUsuarioDto {
  nombre: string;
  apellido: string;
  correo: string;
  contrasena: string;
  rol: 'ADMIN' | 'SECRETARIA';
}

@Injectable({ providedIn: 'root' })
export class UsuariosServicio {
  private readonly URL = `${entorno.urlApi}/usuarios`;

  constructor(private http: HttpClient) {}

  listar(): Observable<UsuarioSistema[]> {
    return this.http.get<UsuarioSistema[]>(this.URL);
  }

  obtener(id: number): Observable<UsuarioSistema> {
    return this.http.get<UsuarioSistema>(`${this.URL}/${id}`);
  }

  crear(dto: CrearUsuarioDto): Observable<UsuarioSistema> {
    return this.http.post<UsuarioSistema>(this.URL, dto);
  }

  actualizar(id: number, dto: Partial<UsuarioSistema & { contrasena?: string }>): Observable<UsuarioSistema> {
    return this.http.patch<UsuarioSistema>(`${this.URL}/${id}`, dto);
  }

  actualizarPermisos(id: number, permisos: any): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/permisos`, permisos);
  }

  // HALLAZGO (29/08): antes mandaban `{ activo }` a PATCH /usuarios/:id
  // (la misma ruta de actualizar()) - el backend lo rechazaba siempre,
  // porque ActualizarUsuarioDto excluye `activo` a propósito (protección
  // contra mass-assignment, mismo criterio que rol/contraseña). Ahora
  // existe el endpoint dedicado que el propio backend ya daba por hecho.
  desactivar(id: number): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/estado`, { activo: false });
  }

  activar(id: number): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/estado`, { activo: true });
  }

  actualizarPerfil(datos: { nombre?: string; apellido?: string; fotoPerfil?: string }): Observable<UsuarioSistema> {
    return this.http.patch<UsuarioSistema>(`${this.URL}/perfil/mi-perfil`, datos);
  }

  // HALLAZGO 2026-08-22: apuntaba a /usuarios/perfil/cambiar-contrasena, que
  // nunca existió en el backend, y enviaba el campo como `nuevaContrasena`
  // cuando el DTO real (CambiarPropiaContrasenaDto) espera `contrasenaNueva`.
  // Corregido para usar la ruta ya existente y probada (me/contrasena).
  cambiarContrasena(contrasenaActual: string, nuevaContrasena: string): Observable<any> {
    return this.http.patch(`${this.URL}/me/contrasena`, { contrasenaActual, contrasenaNueva: nuevaContrasena });
  }
}
