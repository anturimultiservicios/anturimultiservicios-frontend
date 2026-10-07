import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface RecordatorioLlamada {
  id: number;
  afiliadoId: number;
  periodoAnio: number;
  periodoMes: number;
  diaRelativo: number;
  canal: 'LLAMADA' | 'SMS';
  estado: 'PENDIENTE' | 'ATENDIDO';
  fechaProgramada: string;
  ultimoAviso?: string | null;
  nota?: string | null;
  vecesLlamado?: number | null;
  vaAPagar?: boolean | null;
  fechaNota?: string | null;
  afiliado: { id: number; nombres: string; apellidos: string; telefono?: string; cedula: string; correo?: string };
}

@Injectable({ providedIn: 'root' })
export class RecordatoriosLlamadaServicio {
  private readonly URL = `${entorno.urlApi}/recordatorios-llamada`;

  constructor(private http: HttpClient) {}

  listarPendientes(): Observable<RecordatorioLlamada[]> {
    return this.http.get<RecordatorioLlamada[]>(`${this.URL}/pendientes`);
  }

  agregarNota(id: number, nota: string, vecesLlamado: number, vaAPagar?: boolean): Observable<RecordatorioLlamada> {
    return this.http.patch<RecordatorioLlamada>(`${this.URL}/${id}/nota`, { nota, vecesLlamado, vaAPagar });
  }
}
