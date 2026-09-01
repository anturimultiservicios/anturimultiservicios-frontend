import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface Documento {
  id: number;
  afiliadoId: number;
  tipo: 'CEDULA' | 'REGISTRO' | 'AFILIACION' | 'FACTURA' | 'OTRO';
  nombre: string;
  nombreOriginal: string;
  rutaArchivo: string;
  extension: string;
  tamanoKb?: number;
  estado: 'ACTIVO' | 'ELIMINADO';
  creadoEn: string;
}

export interface SlotDocumento {
  tipo: 'CEDULA' | 'REGISTRO' | 'AFILIACION' | 'FACTURA';
  label: string;
  obligatorio: boolean;
  presente: boolean;
  documentos: Documento[];
}

@Injectable({ providedIn: 'root' })
export class DocumentosServicio {
  private readonly URL = `${entorno.urlApi}/documentos`;

  constructor(private http: HttpClient) {}

  listarDeAfiliado(afiliadoId: number): Observable<Documento[]> {
    return this.http.get<Documento[]>(`${this.URL}/afiliado/${afiliadoId}`);
  }

  completitudAfiliado(afiliadoId: number): Observable<SlotDocumento[]> {
    return this.http.get<SlotDocumento[]>(`${this.URL}/afiliado/${afiliadoId}/completitud`);
  }

  subir(afiliadoId: number, archivo: File, tipo: string, nombre: string): Observable<HttpEvent<any>> {
    const form = new FormData();
    form.append('archivo', archivo, archivo.name);
    form.append('afiliadoId', afiliadoId.toString());
    form.append('tipo', tipo);
    form.append('nombre', nombre);

    const req = new HttpRequest('POST', `${this.URL}/subir`, form, { reportProgress: true });
    return this.http.request(req);
  }

  obtenerUrlVisualizacion(id: number): string {
    return `${entorno.urlApi}/documentos/${id}/ver`;
  }

  // Bloque 2 (ficha de Afiliado): GET /documentos/:id/ver exige JWT por
  // header Authorization - un <img>/<iframe> con esta URL directa nunca
  // pudo autenticarse (no hay mecanismo alternativo en el backend, ver
  // investigación previa). Pasando por HttpClient con responseType 'blob',
  // el interceptor global (token.interceptor.ts) adjunta el token exactamente
  // igual que en cualquier otra llamada de la app - mismo endpoint, mismas
  // guardias, mismos permisos, sin exponer el JWT en ninguna URL.
  obtenerBlobVisualizacion(id: number): Observable<Blob> {
    return this.http.get(`${this.URL}/${id}/ver`, { responseType: 'blob' });
  }

  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.URL}/${id}`);
  }

  esImagen(extension: string): boolean {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension.toLowerCase().replace('.', ''));
  }

  esPdf(extension: string): boolean {
    return extension.toLowerCase().replace('.', '') === 'pdf';
  }
}
