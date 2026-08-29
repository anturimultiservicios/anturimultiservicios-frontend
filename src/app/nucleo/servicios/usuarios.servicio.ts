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

  // motivo obligatorio (29/08): cambiar permisos es una acción sensible
  // que ya exige y audita un motivo real del lado del backend.
  actualizarPermisos(id: number, permisos: any, motivo: string): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/permisos`, { ...permisos, motivo });
  }

  // HALLAZGO (29/08): antes mandaban `{ activo }` a PATCH /usuarios/:id
  // (la misma ruta de actualizar()) - el backend lo rechazaba siempre,
  // porque ActualizarUsuarioDto excluye `activo` a propósito (protección
  // contra mass-assignment, mismo criterio que rol/contraseña). Ahora
  // existe el endpoint dedicado que el propio backend ya daba por hecho.
  // motivo obligatorio: activar/desactivar es una acción sensible que ya
  // exige y audita un motivo real del lado del backend.
  desactivar(id: number, motivo: string): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/estado`, { activo: false, motivo });
  }

  activar(id: number, motivo: string): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/estado`, { activo: true, motivo });
  }

  // Cambio de rol (29/08): backend ya lo auditaba, ahora exige motivo real.
  // SUPER_ADMIN-only, nunca sobre uno mismo - ambas cosas ya las exige el
  // backend, acá solo se cablea la llamada.
  cambiarRol(id: number, nuevoRol: 'SUPER_ADMIN' | 'ADMIN' | 'SECRETARIA', motivo: string): Observable<UsuarioSistema> {
    return this.http.patch<UsuarioSistema>(`${this.URL}/${id}/rol`, { nuevoRol, motivo });
  }

  // Reset administrativo (29/08): nunca fija ni revela una contraseña -
  // dispara el flujo de recuperación por correo ya existente.
  forzarReset(id: number): Observable<any> {
    return this.http.post(`${this.URL}/${id}/forzar-reset`, {});
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
