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

  desactivar(id: number): Observable<any> {
    return this.http.patch(`${this.URL}/${id}`, { activo: false });
  }

  activar(id: number): Observable<any> {
    return this.http.patch(`${this.URL}/${id}`, { activo: true });
  }

  actualizarPerfil(datos: { nombre?: string; apellido?: string; fotoPerfil?: string }): Observable<UsuarioSistema> {
    return this.http.patch<UsuarioSistema>(`${this.URL}/perfil/mi-perfil`, datos);
  }

  cambiarContrasena(contrasenaActual: string, nuevaContrasena: string): Observable<any> {
    return this.http.patch(`${this.URL}/perfil/cambiar-contrasena`, { contrasenaActual, nuevaContrasena });
  }
}
