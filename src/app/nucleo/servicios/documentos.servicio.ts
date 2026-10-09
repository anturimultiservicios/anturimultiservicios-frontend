import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

// 2026-09-30: alineado con el enum real del backend (TipoDocumento) -
// antes decía 'CONTRATO'/'CERTIFICADO', que nunca existieron ahí, y le
// faltaban 'REGISTRO'/'FACTURA' que sí existen. Se amplía con los tipos
// granulares nuevos (REGISTRO_CIVIL, ARL, EPS, CAJA_COMPENSACION, PENSION,
// CESANTIAS) para que cada uno tenga su propio botón de subida.
export type TipoDocumento =
  | 'CEDULA' | 'REGISTRO' | 'REGISTRO_CIVIL' | 'AFILIACION'
  | 'ARL' | 'EPS' | 'CAJA_COMPENSACION' | 'PENSION' | 'CESANTIAS'
  | 'FACTURA' | 'OTRO' | 'RECIBO_PAGO';

export interface Documento {
  id: number;
  afiliadoId: number;
  tipo: TipoDocumento;
  nombre: string;
  nombreOriginal: string;
  rutaArchivo: string;
  extension: string;
  tamanoKb?: number;
  estado: 'ACTIVO' | 'ELIMINADO';
  creadoEn: string;
}

export interface TipoDocumentoRequerido {
  tipo: TipoDocumento;
  label: string;
  obligatorio: boolean;
}

@Injectable({ providedIn: 'root' })
export class DocumentosServicio {
  private readonly URL = `${entorno.urlApi}/documentos`;

  constructor(private http: HttpClient) {}

  listarDeAfiliado(afiliadoId: number): Observable<Documento[]> {
    return this.http.get<Documento[]>(`${this.URL}/afiliado/${afiliadoId}`);
  }

  tiposRequeridos(): Observable<TipoDocumentoRequerido[]> {
    return this.http.get<TipoDocumentoRequerido[]>(`${this.URL}/tipos-requeridos`);
  }

  // 2026-09-30 (bug real encontrado): faltaba '/subir' - esta llamada
  // posteaba a `${urlApi}/documentos` en vez de `${urlApi}/documentos/subir`
  // (la ruta real del backend), así que la subida de archivos nunca le
  // pegaba al endpoint correcto.
  subir(afiliadoId: number, archivo: File, tipo: string, nombre: string): Observable<HttpEvent<any>> {
    const form = new FormData();
    form.append('archivo', archivo, archivo.name);
    form.append('afiliadoId', afiliadoId.toString());
    form.append('tipo', tipo);
    form.append('nombre', nombre);

    const req = new HttpRequest('POST', `${this.URL}/subir`, form, { reportProgress: true });
    return this.http.request(req);
  }

  // Reclasificar un documento que llegó como OTRO (o cualquier otro tipo)
  // hacia su categoría real, sin tener que volver a subir el archivo.
  cambiarTipo(id: number, nuevoTipo: TipoDocumento): Observable<Documento> {
    return this.http.patch<Documento>(`${this.URL}/${id}/tipo`, { tipo: nuevoTipo });
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
