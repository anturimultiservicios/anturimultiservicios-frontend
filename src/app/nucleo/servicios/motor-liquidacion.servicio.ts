import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

// 2026-10-07: primera conexión real del motor K→Q (cerrado el 2026-10-02,
// 105 pruebas) a una pantalla - hasta hoy nadie lo llamaba desde el
// frontend (ver AUDITORIA-CONECTIVIDAD-FRONTEND-BACKEND-2026-10-06.md).

export interface LineaCalculo {
  categoria: 'APORTE_SUBSISTEMA' | 'PROPIA_ANTURI' | 'CARGO_FINANCIERO' | 'MORA';
  subsistema?: 'EPS' | 'PENSION' | 'CAJA_COMPENSACION' | 'ARL';
  concepto: string;
  base: number;
  tarifa: number;
  valor: number;
  parametroCodigo?: string;
}

export interface ResultadoMotorLiquidacion {
  modalidad: string;
  ibc: number;
  diasMora: number;
  lineas: LineaCalculo[];
  valorSeguridadSocial: number;
  valorMora: number;
  totalValorSeguridadSocial: number;
  valorCuatroXMil: number;
  valorAdministracion: number;
  valorAfiliacion?: number; // cobro único al afiliarse (2026-10-08)
  totalAPagar: number;
  diasCotizados?: number;   // mes comercial de 30 días
  metadatos: { fecha: string; redondeoMultiplo: number; versionMotor: string; parametrosUsados: any[] };
}

export interface PlantillaLiquidacion {
  tipo: number;
  libro: string;
  hoja: string;
  descripcion: string;
  porcentajeSalud: number;
  porcentajePension: number;
  porcentajeArl: number;
  claseRiesgo: number;
  porcentajeCaja: number;
  porcentajeTotal: number;
  activa: boolean;
}

@Injectable({ providedIn: 'root' })
export class MotorLiquidacionServicio {
  private readonly URL = `${entorno.urlApi}/motor-liquidacion`;
  private readonly URL_PLANTILLAS = `${entorno.urlApi}/liquidacion/plantillas`;

  constructor(private http: HttpClient) {}

  listarPlantillas(): Observable<PlantillaLiquidacion[]> {
    return this.http.get<PlantillaLiquidacion[]>(this.URL_PLANTILLAS);
  }

  simularIndependiente(dto: { tipoPlantilla: number; ibc: number; diasMora?: number; diasCotizados?: number; valorAfiliacion?: number }): Observable<ResultadoMotorLiquidacion> {
    return this.http.post<ResultadoMotorLiquidacion>(`${this.URL}/simular/independiente`, dto);
  }

  simularEmpleador(dto: { modalidad: 'EMPRESA_EXONERADA' | 'EMPRESA_NO_EXONERADA'; ibc: number; claseRiesgoArl: string; diasMora?: number; diasCotizados?: number; valorAfiliacion?: number }): Observable<ResultadoMotorLiquidacion> {
    return this.http.post<ResultadoMotorLiquidacion>(`${this.URL}/simular/empleador`, dto);
  }

  // Independiente parcial (< 1 SMLMV, por semanas - Decreto 2616/2013).
  simularParcial(dto: { diasCotizados: number; claseRiesgoArl: string; codigoCaja?: 'CAJA_06' | 'CAJA_2' | 'CAJA_EMPRESA'; diasMora?: number; valorAfiliacion?: number }): Observable<ResultadoMotorLiquidacion> {
    return this.http.post<ResultadoMotorLiquidacion>(`${this.URL}/simular/parcial`, dto);
  }
}
