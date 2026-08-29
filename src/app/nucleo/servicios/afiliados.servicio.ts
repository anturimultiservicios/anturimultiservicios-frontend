import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export type TipoAfiliacion =
  | 'INDEPENDIENTE_VOLUNTARIO_ARL'
  | 'INDEPENDIENTE_CONTRATISTA'
  | 'EMPRESA_EXONERADA'
  | 'EMPRESA_NO_EXONERADA';

export type ClaseRiesgoArl = 'I' | 'II' | 'III' | 'IV' | 'V';

export interface Afiliado {
  id: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  correo?: string;
  telefono?: string;
  fechaNacimiento?: string;
  cargo?: string;
  claseAportante?: string;
  asopagos?: string;
  clave?: string;
  diasPago?: number;
  tipoAfiliacion?: TipoAfiliacion;
  claseRiesgoArl?: ClaseRiesgoArl;
  porcentajeArl?: number;
  porcentajeSalud?: number;
  porcentajePension?: number;
  porcentajeSaludEmpleador?: number;
  porcentajePensionEmpleador?: number;
  porcentajeCaja?: number;
  porcentajeSena?: number;
  porcentajeIcbf?: number;
  actividadEconomica?: string;
  valor?: number;
  comision?: number;
  totalPago?: number;
  cuatroXMil?: number;
  cesantias?: number;
  estado: 'ACTIVO' | 'RETIRADO' | 'SUSPENDIDO';
  fechaIngreso?: string;
  fechaRetiro?: string;
  sucursalId?: number;
  sucursal?: any;
  seguros?: any[];
  documentos?: any[];
  historial?: any[];
  observaciones?: string;
  // HALLAZGO (29/08): faltaban - necesarios para la vista de papelera
  // (ver GET /afiliados/papelera).
  eliminadoEn?: string;
  eliminacionDefinitivaEn?: string;
  creadoEn: string;
}

export interface CrearAfiliadoDto {
  nombres: string;
  apellidos: string;
  cedula: string;
  correo?: string;
  telefono?: string;
  fechaNacimiento?: string;
  cargo?: string;
  claseAportante?: string;
  asopagos?: string;
  diasPago?: number;
  tipoAfiliacion?: TipoAfiliacion;
  // HALLAZGO (29/08): faltaba en este DTO - el backend ya acepta
  // sucursalId al crear un afiliado (ver DIAGNOSTICO-MAESTRO-USO-REAL-
  // 2026-08-29.md), pero el formulario no tenía ningún campo para
  // vincular un afiliado-empleado con su Empresa/Sucursal.
  sucursalId?: number;
  claseRiesgoArl?: ClaseRiesgoArl;
  porcentajeArl?: number;
  porcentajeSalud?: number;
  porcentajePension?: number;
  porcentajeSaludEmpleador?: number;
  porcentajePensionEmpleador?: number;
  porcentajeCaja?: number;
  porcentajeSena?: number;
  porcentajeIcbf?: number;
  actividadEconomica?: string;
  valor?: number;
  comision?: number;
  totalPago?: number;
  eps?: string;
  afp?: string;
  arl?: string;
  caja?: string;
  estado?: 'ACTIVO' | 'RETIRADO' | 'SUSPENDIDO';
  fechaIngreso?: string;
  observaciones?: string;
}

@Injectable({ providedIn: 'root' })
export class AfiliadosServicio {
  private readonly URL = `${entorno.urlApi}/afiliados`;

  constructor(private http: HttpClient) {}

  listar(busqueda?: string, estado?: string, sucursalId?: number, pagina = 1, porPagina = 50): Observable<{ datos: Afiliado[]; total: number; pagina: number; porPagina: number; totalPaginas: number }> {
    let params = new HttpParams();
    if (busqueda) params = params.set('busqueda', busqueda);
    if (estado) params = params.set('estado', estado);
    if (sucursalId) params = params.set('sucursalId', sucursalId.toString());
    params = params.set('pagina', pagina.toString());
    params = params.set('porPagina', porPagina.toString());
    return this.http.get<{ datos: Afiliado[]; total: number; pagina: number; porPagina: number; totalPaginas: number }>(this.URL, { params });
  }

  obtener(id: number): Observable<Afiliado> {
    return this.http.get<Afiliado>(`${this.URL}/${id}`);
  }

  crear(dto: CrearAfiliadoDto): Observable<Afiliado> {
    return this.http.post<Afiliado>(this.URL, dto);
  }

  actualizar(id: number, datos: Partial<Afiliado>, motivo: string): Observable<Afiliado> {
    return this.http.put<Afiliado>(`${this.URL}/${id}`, { datos, motivo });
  }

  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.URL}/${id}`);
  }

  restaurar(id: number): Observable<any> {
    return this.http.post(`${this.URL}/${id}/restaurar`, {});
  }

  // HALLAZGO (29/08): restaurar() ya existía pero nada en el frontend lo
  // llamaba - no había ninguna forma de ver qué afiliados estaban en
  // papelera para poder restaurarlos. GET /afiliados/papelera ya trae,
  // cuando existe, quién lo eliminó y el motivo real (cruce con
  // HistorialEdicion del lado del backend).
  listarPapelera(): Observable<(Afiliado & {
    eliminadoPor: { id: number; nombre: string; apellido: string } | null;
    motivoEliminacion: string | null;
  })[]> {
    return this.http.get<any>(`${this.URL}/papelera`);
  }

  estadisticas(): Observable<any> {
    return this.http.get(`${this.URL}/estadisticas`);
  }
}
