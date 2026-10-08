import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface AfiliadoDiaCalendario {
  seguroId: number;
  tipo: string;
  estado: 'AL_DIA' | 'VENCIDO';
  afiliado: { id: number; nombres: string; apellidos: string; cedula: string; telefono?: string; correo?: string };
}

export interface DiaCalendario {
  fecha: string; // 'YYYY-MM-DD'
  afiliados: AfiliadoDiaCalendario[];
}

export interface Pago {
  id: number;
  seguroId: number;
  fechaPago: string;
  fechaPeriodo: string;
  monto: number;
  mesesCubiertos: number;
  referencia?: string;
  seguro?: { tipo: string; entidad: string };
  registradoPor?: { id: number; nombre: string; apellido: string };
}

export interface RegistrarPagoDto {
  seguroId: number;
  monto: number;
  mesesCubiertos: number;
  fechaPago?: string;
  referencia?: string;
}

export type CanalPago = 'EFECTIVO' | 'TRANSFERENCIA';

// 2026-10-07 (pantalla de "marcar como pagado"): un pago completo cubre
// todos los seguros reales del afiliado de una vez - ver nota en
// pagos.servicio.ts (backend) y registrar-pago.component.ts.
export interface PagoRegistrado {
  id: number;
  monto: number | string;
  canal: CanalPago | null;
  mesesCubiertos: number | null;
  fechaPago: string;
  afiliado: { id: number; nombres: string; apellidos: string; cedula: string } | null;
  registradoPor: { id: number; nombre: string; apellido: string } | null;
}

export interface ResumenPagos {
  totalRecibido: number;
  porCanal: { EFECTIVO: number; TRANSFERENCIA: number; SIN_CANAL: number };
  pagos: PagoRegistrado[];
}

export interface ResumenMensual {
  anio: number;
  mes: number;
  total: number;
  efectivo: number;
  transferencia: number;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class PagosServicio {
  private readonly URL = `${entorno.urlApi}/pagos`;

  constructor(private http: HttpClient) {}

  registrar(dto: RegistrarPagoDto): Observable<Pago> {
    return this.http.post<Pago>(this.URL, dto);
  }

  registrarCompleto(afiliadoId: number, monto: number, canal: CanalPago, mesesCubiertos: number, referencia?: string): Observable<any> {
    return this.http.post(`${this.URL}/completo`, { afiliadoId, monto, canal, mesesCubiertos, referencia });
  }

  resumen(desde: string, hasta: string): Observable<ResumenPagos> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<ResumenPagos>(`${this.URL}/resumen`, { params });
  }

  resumenMensual(): Observable<ResumenMensual[]> {
    return this.http.get<ResumenMensual[]>(`${this.URL}/resumen-mensual`);
  }

  listarPorAfiliado(afiliadoId: number): Observable<Pago[]> {
    return this.http.get<Pago[]>(`${this.URL}/afiliado/${afiliadoId}`);
  }

  calendario(desde: string, hasta: string): Observable<DiaCalendario[]> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<DiaCalendario[]>(`${this.URL}/calendario`, { params });
  }
}
