import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

// D01-C: administración del scope combinado empresa+sucursal para el rol
// operativo (hoy SECRETARIA). Solo lo puede usar ADMIN/SUPER_ADMIN (mismo
// guard que el backend). Estas asignaciones son manuales, uno por uno - no
// hay backfill automático desde ningún lado, a propósito.
export interface AsignacionEmpresa {
  id: number; // id de la fila UsuarioEmpresa (para revocar)
  empresaId: number;
  empresa: { id: number; razonSocial: string; nit: string };
}

export interface AsignacionSucursal {
  id: number; // id de la fila UsuarioSucursal (para revocar)
  sucursalId: number;
  sucursal: { id: number; nombre: string; empresaId: number };
}

export interface AlcanceUsuario {
  empresas: AsignacionEmpresa[];
  sucursales: AsignacionSucursal[];
}

@Injectable({ providedIn: 'root' })
export class AlcanceServicio {
  private readonly URL = `${entorno.urlApi}/alcance`;

  constructor(private http: HttpClient) {}

  listarPorUsuario(usuarioId: number): Observable<AlcanceUsuario> {
    return this.http.get<AlcanceUsuario>(`${this.URL}/usuario/${usuarioId}`);
  }

  asignarEmpresa(usuarioId: number, empresaId: number): Observable<AsignacionEmpresa> {
    return this.http.post<AsignacionEmpresa>(`${this.URL}/empresa`, { usuarioId, empresaId });
  }

  // id acá es el id de la asignación (UsuarioEmpresa.id), no el de la empresa.
  revocarEmpresa(id: number): Observable<any> {
    return this.http.delete(`${this.URL}/empresa/${id}`);
  }

  asignarSucursal(usuarioId: number, sucursalId: number): Observable<AsignacionSucursal> {
    return this.http.post<AsignacionSucursal>(`${this.URL}/sucursal`, { usuarioId, sucursalId });
  }

  // id acá es el id de la asignación (UsuarioSucursal.id), no el de la sucursal.
  revocarSucursal(id: number): Observable<any> {
    return this.http.delete(`${this.URL}/sucursal/${id}`);
  }
}
