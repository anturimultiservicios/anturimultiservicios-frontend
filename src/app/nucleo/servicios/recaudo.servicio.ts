import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface TotalesRecaudo {
  recaudado: number;
  seguridadSocial: number;
  cuatroXMil: number;
  comision: number;
  afiliacion: number;
  noAporta: number;
  paraAnturi: number;
  efectivo: number;
  transferencia: number;
  cantidad: number;
  personas: number;
}

export interface PagoRecaudo {
  id: number;
  fecha: string;
  nombre: string;
  documento: string;
  tipoDocumento: string;
  tipo: 'AFILIADO' | 'COOPERATIVA' | 'EMPRESA' | 'NO_APORTA' | 'OTRO';
  cuenta: string | null;
  canal: 'EFECTIVO' | 'TRANSFERENCIA' | null;
  meses: number | null;
  monto: number;
  seguridadSocial: number;
  cuatroXMil: number;
  comision: number;
  afiliacion: number;
  estimado: boolean;
  // cargado del Excel histórico (no registrado en la página)
  historico?: boolean;
  motivo: string | null;
  registradoPor: string | null;
}

export interface Recaudo {
  desde: string;
  hasta: string;
  totales: TotalesRecaudo;
  pagos: PagoRecaudo[];
  // 2026-10-09: lo del Excel histórico no se suma salvo que se pida
  incluyeHistorico?: boolean;
  historicoExcel?: { cantidad: number; recaudado: number };
}

// 2026-10-09: control del dinero - solo Administrador y Super Admin.
@Injectable({ providedIn: 'root' })
export class RecaudoServicio {
  private readonly URL = `${entorno.urlApi}/recaudo`;

  constructor(private http: HttpClient) {}

  obtener(desde: string, hasta: string, historico = false): Observable<Recaudo> {
    let params = new HttpParams().set('desde', desde).set('hasta', hasta);
    if (historico) params = params.set('historico', 'true');
    return this.http.get<Recaudo>(this.URL, { params });
  }
}
