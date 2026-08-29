import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

// HALLAZGO (29/08): no existía ningún servicio de Sucursal en el frontend
// - el backend ya tenía crear/actualizar/listarPorEmpresa con scope D01-C
// aplicado, pero nada en la web podía usarlos. No se inventa ningún campo
// nuevo: nombre/direccion/telefono/ciudad/activa son exactamente los que
// ya existen en el modelo Sucursal - no hay evidencia todavía de que
// Anturi necesite algo más (ver INVESTIGACION-SUCURSAL-2026-08-29.md).
export interface Sucursal {
  id: number;
  nombre: string;
  direccion?: string;
  telefono?: string;
  ciudad?: string;
  empresaId: number;
  activa: boolean;
  creadoEn: string;
  actualizadoEn: string;
  _count?: { afiliados: number };
}

export interface CrearSucursalDto {
  nombre: string;
  direccion?: string;
  telefono?: string;
  ciudad?: string;
  empresaId: number;
  activa?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SucursalesServicio {
  private readonly URL = `${entorno.urlApi}/sucursales`;

  constructor(private http: HttpClient) {}

  listarPorEmpresa(empresaId: number): Observable<Sucursal[]> {
    return this.http.get<Sucursal[]>(`${this.URL}/empresa/${empresaId}`);
  }

  crear(dto: CrearSucursalDto): Observable<Sucursal> {
    return this.http.post<Sucursal>(this.URL, dto);
  }

  actualizar(id: number, dto: Partial<CrearSucursalDto>, motivo = 'Edición desde el panel'): Observable<Sucursal> {
    return this.http.put<Sucursal>(`${this.URL}/${id}`, { datos: dto, motivo });
  }
}
