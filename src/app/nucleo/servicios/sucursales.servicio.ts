import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

// 2026-10-07: primer servicio real para este módulo (ver AUDITORIA-
// CONECTIVIDAD-FRONTEND-BACKEND-2026-10-06.md) - el backend ya existía
// completo, sin ningún consumidor. Directo para SECRETARIA/ADMIN/
// SUPER_ADMIN con permiso granular (puedeCrearSucursales/
// puedeEditarSucursales) - a diferencia de Empresa, no pasa por
// SolicitudCambio (gestionar sucursales no está en esa lista sensible).

export interface Sucursal {
  id: number;
  nombre: string;
  direccion?: string;
  telefono?: string;
  ciudad?: string;
  empresaId: number;
  activa: boolean;
  creadoEn: string;
  _count?: { afiliados: number };
}

@Injectable({ providedIn: 'root' })
export class SucursalesServicio {
  private readonly URL = `${entorno.urlApi}/sucursales`;

  constructor(private http: HttpClient) {}

  listarPorEmpresa(empresaId: number): Observable<Sucursal[]> {
    return this.http.get<Sucursal[]>(`${this.URL}/empresa/${empresaId}`);
  }

  crear(dto: { nombre: string; empresaId: number; direccion?: string; telefono?: string; ciudad?: string }): Observable<Sucursal> {
    return this.http.post<Sucursal>(this.URL, dto);
  }

  actualizar(id: number, datos: Partial<Sucursal>, motivo: string): Observable<Sucursal> {
    return this.http.put<Sucursal>(`${this.URL}/${id}`, { datos, motivo });
  }
}
