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

  actualizar(id: number, dto: Partial<Empresa>): Observable<Empresa> {
    return this.http.patch<Empresa>(`${this.URL}/${id}`, dto);
  }

  estadisticas(): Observable<{ activas: number; inactivas: number; total: number }> {
    return this.http.get<any>(`${this.URL}/estadisticas`);
  }
}
