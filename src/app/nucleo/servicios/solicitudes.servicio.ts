import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface SolicitudCambio {
  id: number;
  tipo: 'EDICION' | 'ELIMINACION' | 'CREACION' | 'RESTAURACION';
  tabla: string;
  registroId?: number;
  motivo: string;
  datosOriginales?: string;
  datosNuevos?: string;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  comentarioAdmin?: string;
  creadoPor: { id: number; nombre: string; apellido: string; rol: string };
  revisadoPor?: { id: number; nombre: string; apellido: string };
  creadoEn: string;
  revisadoEn?: string;
}

@Injectable({ providedIn: 'root' })
export class SolicitudesServicio {
  private readonly URL = `${entorno.urlApi}/solicitudes-cambio`;

  constructor(private http: HttpClient) {}

  crear(datos: {
    tipo: 'EDICION' | 'ELIMINACION' | 'CREACION' | 'RESTAURACION';
    tabla: string;
    registroId?: number;
    motivo: string;
    datosOriginales?: any;
    datosNuevos?: any;
  }): Observable<SolicitudCambio> {
    return this.http.post<SolicitudCambio>(this.URL, {
      ...datos,
      datosOriginales: datos.datosOriginales ? JSON.stringify(datos.datosOriginales) : undefined,
      datosNuevos: datos.datosNuevos ? JSON.stringify(datos.datosNuevos) : undefined,
    });
  }

  listar(estado?: string, soloMias = false): Observable<SolicitudCambio[]> {
    let params = new HttpParams();
    if (estado) params = params.set('estado', estado);
    if (soloMias) params = params.set('mias', 'true');
    return this.http.get<SolicitudCambio[]>(this.URL, { params });
  }

  obtener(id: number): Observable<SolicitudCambio> {
    return this.http.get<SolicitudCambio>(`${this.URL}/${id}`);
  }

  aprobar(id: number, comentario?: string): Observable<SolicitudCambio> {
    return this.http.patch<SolicitudCambio>(`${this.URL}/${id}/revisar`, {
      estado: 'APROBADA',
      comentarioAdmin: comentario,
    });
  }

  rechazar(id: number, comentario: string): Observable<SolicitudCambio> {
    return this.http.patch<SolicitudCambio>(`${this.URL}/${id}/revisar`, {
      estado: 'RECHAZADA',
      comentarioAdmin: comentario,
    });
  }

  contarPendientes(): Observable<number> {
    return this.http.get<number>(`${this.URL}/pendientes/cantidad`);
  }
}
