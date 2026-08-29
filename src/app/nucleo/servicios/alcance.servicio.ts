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

  // HALLAZGO (29/08): faltaba un camino de autoservicio - una cuenta
  // Asistente no podía saber si tenía o no alcance asignado. Cualquier rol
  // puede llamarlo, pero el backend solo devuelve SU PROPIO alcance.
  miAlcance(): Observable<AlcanceUsuario> {
    return this.http.get<AlcanceUsuario>(`${this.URL}/mi-alcance`);
  }

  // motivo obligatorio (29/08): asignar/revocar alcance es una acción
  // sensible que ya exige y audita un motivo real del lado del backend.
  asignarEmpresa(usuarioId: number, empresaId: number, motivo: string): Observable<AsignacionEmpresa> {
    return this.http.post<AsignacionEmpresa>(`${this.URL}/empresa`, { usuarioId, empresaId, motivo });
  }

  // id acá es el id de la asignación (UsuarioEmpresa.id), no el de la empresa.
  revocarEmpresa(id: number, motivo: string): Observable<any> {
    return this.http.delete(`${this.URL}/empresa/${id}`, { body: { motivo } });
  }

  asignarSucursal(usuarioId: number, sucursalId: number, motivo: string): Observable<AsignacionSucursal> {
    return this.http.post<AsignacionSucursal>(`${this.URL}/sucursal`, { usuarioId, sucursalId, motivo });
  }

  // id acá es el id de la asignación (UsuarioSucursal.id), no el de la sucursal.
  revocarSucursal(id: number, motivo: string): Observable<any> {
    return this.http.delete(`${this.URL}/sucursal/${id}`, { body: { motivo } });
  }
}
