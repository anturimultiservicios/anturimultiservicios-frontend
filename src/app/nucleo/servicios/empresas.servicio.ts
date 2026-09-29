import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface Empresa {
  id: number;
  razonSocial: string;
  nit: string;
  correo?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  municipio?: string;
  asopagos?: string;
  clave?: string;
  diasPago?: number;
  claseAportante?: string;
  activa: boolean;
  sucursales?: any[];
  creadoEn: string;
}

@Injectable({ providedIn: 'root' })
export class EmpresasServicio {
  private readonly URL = `${entorno.urlApi}/empresas`;

  constructor(private http: HttpClient) {}

  listar(busqueda?: string, soloActivas = true): Observable<Empresa[]> {
    let params = new HttpParams();
    if (busqueda) params = params.set('busqueda', busqueda);
    if (soloActivas) params = params.set('activas', 'true');
    return this.http.get<Empresa[]>(this.URL, { params });
  }

  obtener(id: number): Observable<Empresa> {
    return this.http.get<Empresa>(`${this.URL}/${id}`);
  }

  crear(dto: Partial<Empresa>): Observable<Empresa> {
    return this.http.post<Empresa>(this.URL, dto);
  }

  // 2026-09-29: CORREGIDO - antes mandaba PATCH con el objeto plano, pero
  // el backend real solo tiene @Put(':id') esperando {datos, motivo} (ver
  // EmpresasControlador.actualizar()) - mismo desajuste ya detectado el
  // 28-sep y anotado como pendiente en detalle-empresa.component.ts, nunca
  // corregido porque no había ningún formulario de editar que lo usara
  // todavía. Se corrige de una vez acá - motivo obligatorio del lado del
  // backend (acción sensible auditada).
  actualizar(id: number, datos: Partial<Empresa>, motivo: string): Observable<Empresa> {
    return this.http.put<Empresa>(`${this.URL}/${id}`, { datos, motivo });
  }

  // Activar/desactivar - endpoint dedicado nuevo (2026-09-29), mismo patrón
  // que UsuariosServicio.activar()/desactivar(): motivo obligatorio.
  cambiarEstado(id: number, activa: boolean, motivo: string): Observable<Empresa> {
    return this.http.patch<Empresa>(`${this.URL}/${id}/estado`, { activa, motivo });
  }

  estadisticas(): Observable<{ activas: number; inactivas: number; total: number }> {
    return this.http.get<any>(`${this.URL}/estadisticas`);
  }
}
