import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export type EstadoDispositivo = 'PENDIENTE' | 'AUTORIZADO' | 'REVOCADO' | 'BLOQUEADO';

export interface DispositivoUsuario {
  id: number;
  nombre: string | null;
  estado: EstadoDispositivo;
  sistemaOperativo: string | null;
  navegador: string | null;
  ipRegistro?: string | null;
  fechaSolicitud: string;
  fechaAutorizacion?: string | null;
  ultimoUso?: string | null;
  usuario?: { id: number; nombre: string; apellido: string; correo: string; rol: string };
  autorizadoPor?: { id: number; nombre: string; apellido: string } | null;
}

@Injectable({ providedIn: 'root' })
export class DispositivosServicio {
  private readonly URL = `${entorno.urlApi}/dispositivos`;

  constructor(private http: HttpClient) {}

  // ── Autoservicio (D1) ──────────────────────────────────────────────────
  misDispositivos(): Observable<DispositivoUsuario[]> {
    return this.http.get<DispositivoUsuario[]>(`${this.URL}/mios`);
  }

  registrarInicio(): Observable<any> {
    return this.http.post<any>(`${this.URL}/registrar-inicio`, {});
  }

  registrarCompletar(respuesta: any, nombreSugerido?: string): Observable<DispositivoUsuario> {
    return this.http.post<DispositivoUsuario>(`${this.URL}/registrar-completar`, { respuesta, nombreSugerido });
  }

  // ── Administración (D2) ─────────────────────────────────────────────────
  listarPendientes(): Observable<DispositivoUsuario[]> {
    return this.http.get<DispositivoUsuario[]>(`${this.URL}/pendientes`);
  }

  listarTodos(): Observable<DispositivoUsuario[]> {
    return this.http.get<DispositivoUsuario[]>(`${this.URL}/todos`);
  }

  aprobar(id: number, motivo: string): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/aprobar`, { motivo });
  }

  rechazar(id: number, motivo: string): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/rechazar`, { motivo });
  }

  revocar(id: number, motivo: string): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/revocar`, { motivo });
  }

  // ── confirmar-con-dispositivo-existente (D3+D4) ──────────────────────────
  iniciarConfirmacionConExistente(): Observable<any> {
    return this.http.post<any>(`${this.URL}/confirmar-con-existente/iniciar`, {});
  }

  completarConfirmacionConExistente(respuesta: any, idDispositivoNuevo: number): Observable<any> {
    return this.http.post(`${this.URL}/confirmar-con-existente/completar`, { respuesta, idDispositivoNuevo });
  }
}