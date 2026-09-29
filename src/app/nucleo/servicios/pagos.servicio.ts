import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

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

@Injectable({ providedIn: 'root' })
export class PagosServicio {
  private readonly URL = `${entorno.urlApi}/pagos`;

  constructor(private http: HttpClient) {}

  registrar(dto: RegistrarPagoDto): Observable<Pago> {
    return this.http.post<Pago>(this.URL, dto);
  }

  listarPorAfiliado(afiliadoId: number): Observable<Pago[]> {
    return this.http.get<Pago[]>(`${this.URL}/afiliado/${afiliadoId}`);
  }
}
