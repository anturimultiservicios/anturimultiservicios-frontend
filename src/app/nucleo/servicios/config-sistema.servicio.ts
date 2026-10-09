import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface ConfigSistema {
  enviarCorreosCobro: boolean;
  correoTestDestinatario: string;
  dispositivoObligatorio: boolean;
}

export interface AvisoCobroItem {
  afiliadoId: number;
  nombre: string;
  documento: string;
  correo: string | null;
  fechaLimite: string;
  diasParaPagar: number;
  valor: number;
  canal: 'CORREO' | 'LLAMADA';
}

export interface ResumenAvisosCobro {
  activo: boolean;
  correosEnviados: number;
  sinCorreo: number;
  sinValor: number;
  yaEnviados: number;
  errores: number;
  lista: AvisoCobroItem[];
}

@Injectable({ providedIn: 'root' })
export class ConfigSistemaServicio {
  private readonly URL = `${entorno.urlApi}/config-sistema`;

  constructor(private http: HttpClient) {}

  obtener(): Observable<ConfigSistema> {
    return this.http.get<ConfigSistema>(this.URL);
  }

  // dispositivoObligatorio deliberadamente fuera del DTO real del backend -
  // no es togglable por este endpoint (ver comentario en
  // config-sistema.dto.ts), por eso no se manda acá.
  actualizar(enviarCorreosCobro: boolean): Observable<ConfigSistema> {
    return this.http.patch<ConfigSistema>(this.URL, { enviarCorreosCobro });
  }

  // 2026-10-09: a quién le toca HOY el correo de cobro (solo activos sin
  // pagar, según la cadencia) - y enviarlos ya, al activar.
  avisosCobroHoy(): Observable<ResumenAvisosCobro> {
    return this.http.get<ResumenAvisosCobro>(`${entorno.urlApi}/afiliados/avisos-cobro/hoy`);
  }

  ejecutarAvisosCobro(): Observable<ResumenAvisosCobro> {
    return this.http.post<ResumenAvisosCobro>(`${entorno.urlApi}/afiliados/avisos-cobro/ejecutar`, {});
  }

  enviarCorreoTest(): Observable<{ mensaje: string }> {
    return this.http.get<{ mensaje: string }>(`${this.URL}/test-correo`);
  }
}
