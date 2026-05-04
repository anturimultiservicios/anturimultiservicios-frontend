import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface Documento {
  id: number;
  afiliadoId: number;
  tipo: 'CEDULA' | 'AFILIACION' | 'CONTRATO' | 'CERTIFICADO' | 'OTRO';
  nombre: string;
  nombreOriginal: string;
  rutaArchivo: string;
  extension: string;
  tamanoKb?: number;
  estado: 'ACTIVO' | 'ELIMINADO';
  creadoEn: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentosServicio {
  private readonly URL = `${entorno.urlApi}/documentos`;

  constructor(private http: HttpClient) {}

  listarDeAfiliado(afiliadoId: number): Observable<Documento[]> {
    return this.http.get<Documento[]>(`${this.URL}/afiliado/${afiliadoId}`);
  }

  subir(afiliadoId: number, archivo: File, tipo: string, nombre: string): Observable<HttpEvent<any>> {
    const form = new FormData();
    form.append('archivo', archivo, archivo.name);
    form.append('afiliadoId', afiliadoId.toString());
    form.append('tipo', tipo);
    form.append('nombre', nombre);

    const req = new HttpRequest('POST', this.URL, form, { reportProgress: true });
    return this.http.request(req);
  }

  obtenerUrlVisualizacion(id: number): string {
    return `${entorno.urlApi}/documentos/${id}/ver`;
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
