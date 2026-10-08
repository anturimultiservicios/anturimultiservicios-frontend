import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface EventoIncapacidad {
  id: number;
  hallazgoId: number | null;
  afiliadoId: number | null;
  tipoEvento: string;
  fechaInicio: string;
  fechaFin: string | null;
  origenCarpeta: string | null;
  estado: string;
  registradoEn: string;
}

export interface TramoReferencia {
  desde: number; hasta: number; dias: number; porcentaje: number;
  valorDiario: number; subtotal: number; quienPaga: string;
}

export interface CalculoReferencia {
  diasTotales: number;
  abierto: boolean;
  ibcMensual: number;
  tramos: TramoReferencia[];
  totalReferencia: number;
  advertencias: string[];
}

@Injectable({ providedIn: 'root' })
export class EventosIncapacidadServicio {
  private readonly URL = `${entorno.urlApi}/eventos-incapacidad`;

  constructor(private http: HttpClient) {}

  crear(dto: { afiliadoId?: number; hallazgoId?: number; tipoEvento: string; fechaInicio: string; fechaFin?: string }): Observable<EventoIncapacidad> {
    return this.http.post<EventoIncapacidad>(this.URL, dto);
  }

  listarPorAfiliado(afiliadoId: number): Observable<EventoIncapacidad[]> {
    return this.http.get<EventoIncapacidad[]>(`${this.URL}/afiliado/${afiliadoId}`);
  }

  listarDocumentos(eventoId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.URL}/${eventoId}/documentos`);
  }

  subirDocumento(eventoId: number, tipo: string, archivo: File): Observable<any> {
    const formulario = new FormData();
    formulario.append('tipo', tipo);
    formulario.append('archivo', archivo);
    return this.http.post(`${this.URL}/${eventoId}/documentos`, formulario);
  }

  urlVerDocumento(documentoId: number): string {
    return `${this.URL}/documentos/${documentoId}/ver`;
  }

  calcularReferencia(eventoId: number, ibc?: number): Observable<CalculoReferencia> {
    const params: any = {};
    if (ibc) params.ibc = ibc.toString();
    return this.http.get<CalculoReferencia>(`${this.URL}/${eventoId}/calculo-referencia`, { params });
  }
}
