import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export type TipoAfiliacion =
  | 'INDEPENDIENTE'
  | 'INDEPENDIENTE_PARCIAL'
  | 'INDEPENDIENTE_RESIDENTE_EXTERIOR'
  | 'INDEPENDIENTE_VOLUNTARIO_ARL'
  | 'INDEPENDIENTE_CONTRATISTA'
  | 'EMPRESA_EXONERADA'
  | 'EMPRESA_NO_EXONERADA';

export type ClaseRiesgoArl = 'I' | 'II' | 'III' | 'IV' | 'V';

// 2026-09-29: 'INDETERMINADO' es una respuesta válida y explícita (no
// binario, o prefiere no decirlo) - nunca se adivina desde el nombre. Con
// M/F el saludo formal usa "Sr./Sra."; con INDETERMINADO (o sin dato
// todavía, afiliados viejos) usa el nombre completo - ver saludo.util.ts
// en el backend.
export type GeneroAfiliado = 'M' | 'F' | 'INDETERMINADO';

export interface Afiliado {
  id: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  correo?: string;
  telefono?: string;
  genero?: GeneroAfiliado;
  notificarCorreo?: boolean;
  notificarSms?: boolean;
  notificarLlamada?: boolean;
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
  // 2026-10-07 (backfill real de Migración B): tipoDocumento vive en
  // Persona, no en Afiliado - personaId es null solo para los 4 registros
  // duplicados sin resolver (ver notificación a Secretaria/Admin).
  personaId?: number | null;
  persona?: { id: number; tipoDocumento: string } | null;
  tipoDocumento?: string;
  sucursalId?: number;
  sucursal?: any;
  seguros?: any[];
  documentos?: any[];
  historial?: any[];
  creadoEn: string;
}

export interface CrearAfiliadoDto {
  valorAfiliacion?: number; // cobro único al afiliarse (2026-10-08)
  nombres: string;
  apellidos: string;
  tipoDocumento?: string; // CC por defecto - ver nucleo/utilidades/tipos-documento.ts
  cedula: string;
  genero: GeneroAfiliado;
  correo?: string;
  telefono?: string;
  notificarCorreo?: boolean;
  notificarSms?: boolean;
  notificarLlamada?: boolean;
  fechaNacimiento?: string;
  cargo?: string;
  claseAportante?: string;
  asopagos?: string;
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
  eps?: string;
  afp?: string;
  arl?: string;
  caja?: string;
  estado?: 'ACTIVO' | 'RETIRADO' | 'SUSPENDIDO';
  fechaIngreso?: string;
}

@Injectable({ providedIn: 'root' })
export class AfiliadosServicio {
  private readonly URL = `${entorno.urlApi}/afiliados`;

  constructor(private http: HttpClient) {}

  listar(busqueda?: string, estado?: string, sucursalId?: number, pagina = 1, porPagina = 50, empresaId?: number): Observable<{ datos: Afiliado[]; total: number; pagina: number; porPagina: number; totalPaginas: number }> {
    let params = new HttpParams();
    if (busqueda) params = params.set('busqueda', busqueda);
    if (estado) params = params.set('estado', estado);
    if (sucursalId) params = params.set('sucursalId', sucursalId.toString());
    if (empresaId) params = params.set('empresaId', empresaId.toString());
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

  listarPapelera(): Observable<(Afiliado & { eliminadoEn: string; eliminadoPor: { id: number; nombre: string; apellido: string } | null; motivoEliminacion: string | null })[]> {
    return this.http.get<any>(`${this.URL}/papelera`);
  }

  estadisticas(): Observable<any> {
    return this.http.get(`${this.URL}/estadisticas`);
  }
}
