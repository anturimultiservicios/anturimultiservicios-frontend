import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

// Centinela usado cuando un hallazgo se importó a propósito sin ningún
// documento con su propia identificación (ver FASE 8, 2026-10-06) - nunca
// un número inventado.
export const IDENTIFICACION_PENDIENTE = 'PENDIENTE';

export interface HallazgoReconciliacion {
  id: number;
  origenArchivo: string;
  loteImportacionId: string;
  filaOrigen: number | null;
  tipoIdentificacion: string;
  numeroIdentificacion: string;
  nombreEncontrado: string;
  afiliadoId: number | null;
  empresaId: number | null;
  rolDetectado: string;
  relacionDescripcion: string | null;
  fechaInicioExcel: string | null;
  fechaFinExcel: string | null;
  estadoExcel: string | null;
  estado: string;
  observaciones: string | null;
  empleadorHallazgoId: number | null;
  registradoEn: string;
}

export interface EvidenciaHallazgo {
  vinculoId: number;
  id: number;
  clase: string;
  tipo: string;
  rutaArchivo: string | null;
  extension: string | null;
  tamanoKb: number | null;
  creadaEn: string;
}

@Injectable({ providedIn: 'root' })
export class HallazgosReconciliacionServicio {
  private readonly URL = `${entorno.urlApi}/hallazgos-reconciliacion`;
  private readonly URL_EVIDENCIAS = `${entorno.urlApi}/evidencias-hallazgo`;

  constructor(private http: HttpClient) {}

  listar(): Observable<HallazgoReconciliacion[]> {
    return this.http.get<HallazgoReconciliacion[]>(this.URL);
  }

  buscarPorIdentificacion(identificacion: string): Observable<HallazgoReconciliacion[]> {
    return this.http.get<HallazgoReconciliacion[]>(`${this.URL}/${identificacion}`);
  }

  actualizar(
    id: number,
    datos: { estado?: string; observaciones?: string; tipoIdentificacion?: string; numeroIdentificacion?: string },
  ): Observable<HallazgoReconciliacion> {
    return this.http.patch<HallazgoReconciliacion>(`${this.URL}/${id}`, datos);
  }

  listarEvidencias(hallazgoId: number): Observable<EvidenciaHallazgo[]> {
    return this.http.get<EvidenciaHallazgo[]>(`${this.URL_EVIDENCIAS}/hallazgo/${hallazgoId}`);
  }

  subirEvidencia(hallazgoId: number, archivo: File, tipo: string): Observable<HttpEvent<any>> {
    const form = new FormData();
    form.append('archivo', archivo, archivo.name);
    form.append('hallazgoId', hallazgoId.toString());
    form.append('tipo', tipo);

    const req = new HttpRequest('POST', `${this.URL_EVIDENCIAS}/subir`, form, { reportProgress: true });
    return this.http.request(req);
  }

  obtenerUrlVisualizacionEvidencia(id: number): string {
    return `${this.URL_EVIDENCIAS}/${id}/ver`;
  }

  // 2026-10-06 (permisos Secretaria): ADMIN/SUPER_ADMIN únicamente, directo
  // - Secretaria usa SolicitudesServicio.crear() (tabla='evidencias_hallazgo')
  // en vez de llamar estos 2 métodos.
  cambiarTipoEvidencia(id: number, tipo: string, motivo: string): Observable<EvidenciaHallazgo> {
    return this.http.patch<EvidenciaHallazgo>(`${this.URL_EVIDENCIAS}/${id}/tipo`, { tipo, motivo });
  }

  eliminarEvidencia(id: number, motivo: string): Observable<any> {
    return this.http.request('delete', `${this.URL_EVIDENCIAS}/${id}`, { body: { motivo } });
  }

  esImagen(extension: string | null): boolean {
    if (!extension) return false;
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension.toLowerCase().replace('.', ''));
  }

  esPdf(extension: string | null): boolean {
    if (!extension) return false;
    return extension.toLowerCase().replace('.', '') === 'pdf';
  }
}
