import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

// 2026-10-08: el backend guardaba notificaciones (nuevo afiliado, cambios,
// eliminaciones, pagos, solicitudes...) desde agosto, pero ninguna
// pantalla las leía - Anturi nunca las veía. Distinto de
// NotificacionServicio (toasts locales de la pantalla).
export interface NotificacionSistema {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  referenciaId: number | null;
  creadoEn: string;
}

// Tarea abierta calculada en vivo por el backend - no se marca como leída,
// desaparece sola cuando se resuelve (ej. cédula duplicada).
export interface PendienteSistema {
  clave: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  referenciaId: number | null;
  // revisiones (2026-10-09): a qué cuenta o ficha lleva
  empresaId?: number | null;
  afiliadoId?: number | null;
}

@Injectable({ providedIn: 'root' })
export class NotificacionesSistemaServicio {
  private readonly URL = `${entorno.urlApi}/notificaciones`;

  constructor(private http: HttpClient) {}

  listar(): Observable<NotificacionSistema[]> {
    return this.http.get<NotificacionSistema[]>(this.URL);
  }

  pendientes(): Observable<PendienteSistema[]> {
    return this.http.get<PendienteSistema[]>(`${this.URL}/pendientes`);
  }

  // 2026-10-09: marcar revisada una revisión pendiente, con lo que se encontró
  resolverRevision(id: number, nota: string): Observable<unknown> {
    return this.http.put(`${this.URL}/revisiones/${id}/resolver`, { nota });
  }

  contarSinLeer(): Observable<number> {
    return this.http.get<number>(`${this.URL}/sin-leer`);
  }

  marcarLeida(id: number): Observable<unknown> {
    return this.http.put(`${this.URL}/${id}/leida`, {});
  }

  marcarTodas(): Observable<unknown> {
    return this.http.put(`${this.URL}/marcar-todas`, {});
  }
}
