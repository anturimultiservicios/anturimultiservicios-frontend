import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface EstadoHorarioAcceso {
  minutosParaCierre: number | null;
  horaInicio: number;
  horaFin: number;
  mensaje?: string;
}

export interface ConfiguracionHorarioAcceso {
  id: number;
  activo: boolean;
  horaInicio: number;
  horaFin: number;
  // 2026-10-08: sábado medio día, domingo y festivos
  sabadoActivo: boolean;
  sabadoHoraFin: number;
  domingoActivo: boolean;
  bloquearFestivos: boolean;
  actualizadoEn: string;
}

export interface ExcepcionHorarioAcceso {
  id: number;
  usuarioId: number;
  motivo: string | null;
  vigenteDesde: string;
  vigenteHasta: string;
  usuario: { id: number; nombre: string; apellido: string; rol: string };
  otorgadaPor: { id: number; nombre: string; apellido: string };
}

// 2026-10-01 (decisión de Cristopher, seguridad): ADMIN/SECRETARIA solo
// pueden estar conectados de 7:00 a 19:00 hora Colombia - SUPER_ADMIN
// nunca está restringido. Este servicio es el punto único donde vive el
// aviso de "se cierra en 5 minutos" y la pantalla de cierre forzado, para
// que tanto el polling periódico como el interceptor de HTTP (que detecta
// el corte real en cualquier request) escriban al mismo lugar.
@Injectable({ providedIn: 'root' })
export class HorarioAccesoServicio {
  private readonly URL = `${entorno.urlApi}/horario-acceso`;

  private minutosParaCierreSubject = new BehaviorSubject<number | null>(null);
  readonly minutosParaCierre$ = this.minutosParaCierreSubject.asObservable();

  // No-null = hay que mostrar la pantalla completa de cierre y ya se
  // cerró la sesión - el mensaje incluye el horario real configurado.
  private cierreForzadoSubject = new BehaviorSubject<string | null>(null);
  readonly cierreForzado$ = this.cierreForzadoSubject.asObservable();

  constructor(private http: HttpClient) {}

  consultarEstado(): Observable<EstadoHorarioAcceso> {
    return this.http.get<EstadoHorarioAcceso>(`${this.URL}/estado`);
  }

  // Gestión - exclusivo SUPER_ADMIN (el backend también lo exige)
  obtenerConfiguracion(): Observable<ConfiguracionHorarioAcceso> {
    return this.http.get<ConfiguracionHorarioAcceso>(`${this.URL}/configuracion`);
  }

  actualizarConfiguracion(datos: Partial<Pick<ConfiguracionHorarioAcceso, 'activo' | 'horaInicio' | 'horaFin' | 'sabadoActivo' | 'sabadoHoraFin' | 'domingoActivo' | 'bloquearFestivos'>>): Observable<ConfiguracionHorarioAcceso> {
    return this.http.patch<ConfiguracionHorarioAcceso>(`${this.URL}/configuracion`, datos);
  }

  listarExcepciones(): Observable<ExcepcionHorarioAcceso[]> {
    return this.http.get<ExcepcionHorarioAcceso[]>(`${this.URL}/excepciones`);
  }

  otorgarExcepcion(usuarioId: number, vigenteHasta: string, motivo: string): Observable<ExcepcionHorarioAcceso> {
    return this.http.post<ExcepcionHorarioAcceso>(`${this.URL}/excepciones`, { usuarioId, vigenteHasta, motivo });
  }

  revocarExcepcion(id: number): Observable<any> {
    return this.http.delete(`${this.URL}/excepciones/${id}`);
  }

  actualizarMinutosParaCierre(minutos: number | null): void {
    this.minutosParaCierreSubject.next(minutos);
  }

  // Llamado desde el interceptor de HTTP apenas detecta el mensaje real de
  // corte por horario en cualquier respuesta - no espera al próximo
  // sondeo periódico.
  anunciarCierreForzado(mensaje: string): void {
    this.cierreForzadoSubject.next(mensaje);
  }

  limpiarAvisos(): void {
    this.minutosParaCierreSubject.next(null);
    this.cierreForzadoSubject.next(null);
  }
}
