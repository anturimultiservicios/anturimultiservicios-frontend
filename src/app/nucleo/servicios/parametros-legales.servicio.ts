import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

// 2026-10-07: primera pantalla real para este módulo - hasta hoy, cambiar
// un parámetro legal (SMLMV, una tasa ARL, la comisión fija, etc.) exigía
// un UPDATE directo en la base (ver AUDITORIA-CONECTIVIDAD-FRONTEND-
// BACKEND-2026-10-06.md). ADMIN/SUPER_ADMIN exclusivo - Secretaria calcula
// con las tasas ya vigentes (puedeCalcularLiquidacion), no las cambia.

export interface ParametroLegal {
  id: number;
  codigo: string;
  nombre: string;
  valor: number;
  unidad: string | null;
  fuente: string;
  soporte: string | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  motivo?: string;
  modificadoPorId?: number | null;
  modificadoPor?: { id: number; nombre: string; apellido: string };
}

@Injectable({ providedIn: 'root' })
export class ParametrosLegalesServicio {
  private readonly URL = `${entorno.urlApi}/parametros-legales`;

  constructor(private http: HttpClient) {}

  listarVigentes(): Observable<ParametroLegal[]> {
    return this.http.get<ParametroLegal[]>(this.URL);
  }

  historial(codigo: string): Observable<ParametroLegal[]> {
    return this.http.get<ParametroLegal[]>(`${this.URL}/${codigo}/historial`);
  }

  actualizar(codigo: string, datos: { valor: number; motivo: string; fuente?: string; soporte?: string }): Observable<ParametroLegal> {
    return this.http.patch<ParametroLegal>(`${this.URL}/${codigo}`, datos);
  }
}
