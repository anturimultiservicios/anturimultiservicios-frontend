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
  // Valores económicos
  valor?: number;
  comision?: number;
  totalPago?: number;
  cuatroXMil?: number;
  porcentajeArl?: number;
  actividadEconomica?: string;
  // Seguros de referencia
  eps?: string;
  afp?: string;
  cajaCom?: string;
  // Fechas
  fechaIngreso?: string;
  fechaRetiro?: string;
  // Notas
  observaciones?: string;
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

  actualizar(id: number, dto: Partial<Empresa>, motivo = 'Edición desde el panel'): Observable<Empresa> {
    return this.http.put<Empresa>(`${this.URL}/${id}`, { datos: dto, motivo });
  }

  estadisticas(): Observable<{ activas: number; inactivas: number; total: number }> {
    return this.http.get<any>(`${this.URL}/estadisticas`);
  }
}
