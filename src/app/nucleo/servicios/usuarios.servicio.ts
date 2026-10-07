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

// 2026-10-06 (hallazgo real, FASE auditoría conectividad): el backend NO
// recibe `correo` completo al crear - recibe `nombreUsuario` (la parte
// antes de la arroba) y genera él mismo `nombreUsuario@anturimultiservicios.com`,
// resolviendo colisiones (ver CrearUsuarioDto/UsuariosServicio.crear() del
// backend). El frontend mandaba `correo` hasta hoy - con
// forbidNonWhitelisted:true eso rechazaba SIEMPRE la creación con 400.
export interface CrearUsuarioDto {
  nombre: string;
  apellido: string;
  nombreUsuario: string;
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

  // 2026-10-06 (hallazgo real): ActualizarUsuarioDto del backend es
  // DELIBERADAMENTE solo {nombre?, apellido?, correo?, fotoPerfil?} - sin
  // rol ni contrasena (tienen sus propios endpoints con su propia
  // autorización, ver cambiarRol()/forzarReset() abajo). Mandar esos 2
  // campos de más acá rechazaba SIEMPRE la edición con 400
  // (forbidNonWhitelisted:true). El tipo ya no los acepta.
  actualizar(id: number, dto: Partial<Pick<UsuarioSistema, 'nombre' | 'apellido' | 'correo' | 'fotoPerfil'>>): Observable<UsuarioSistema> {
    return this.http.patch<UsuarioSistema>(`${this.URL}/${id}`, dto);
  }

  // Único camino real para cambiar el rol de una cuenta - SUPER_ADMIN-only
  // en el backend, con motivo obligatorio (ver PATCH /usuarios/:id/rol).
  cambiarRol(id: number, nuevoRol: 'ADMIN' | 'SECRETARIA', motivo: string): Observable<UsuarioSistema> {
    return this.http.patch<UsuarioSistema>(`${this.URL}/${id}/rol`, { nuevoRol, motivo });
  }

  // Genera una contraseña temporal aleatoria para la cuenta (nunca se puede
  // "escribir" una contraseña nueva a mano para otra persona) - el backend
  // la devuelve UNA sola vez en la respuesta, para que el admin se la pase
  // a la persona.
  forzarReset(id: number): Observable<{ mensaje: string; contrasenaTemporal: string }> {
    return this.http.post<{ mensaje: string; contrasenaTemporal: string }>(`${this.URL}/${id}/forzar-reset`, {});
  }

  actualizarPermisos(id: number, permisos: any): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/permisos`, permisos);
  }

  // HALLAZGO (2026-09-13, auditoria activar/desactivar): antes mandaban
  // `{ activo }` a PATCH /usuarios/:id (la misma ruta de actualizar()) - el
  // backend lo rechazaba siempre, porque ActualizarUsuarioDto excluye
  // `activo` a proposito (forbidNonWhitelisted:true) y el endpoint dedicado
  // (:id/estado) ya existia y exige motivo. Corregido para usar la ruta
  // real, con motivo obligatorio (accion sensible ya auditada del lado del
  // backend en historial_ediciones).
  desactivar(id: number, motivo: string): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/estado`, { activo: false, motivo });
  }

  activar(id: number, motivo: string): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/estado`, { activo: true, motivo });
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
