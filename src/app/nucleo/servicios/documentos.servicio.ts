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
  afiliadoId: number | null;
  empresaId?: number | null;
  carpetaId?: number | null;
  carpeta?: { id: number; nombre: string } | null;
  tipo: TipoDocumento;
  nombre: string;
  nombreOriginal: string;
  rutaArchivo: string;
  extension: string;
  tamanoKb?: number;
  estado: 'ACTIVO' | 'ELIMINADO';
  creadoEn: string;
}

// 2026-10-15: carpetas con nombre único (las fijas de siempre + las creadas)
export interface CatalogoCarpetas {
  fijas: { tipo: TipoDocumento; nombre: string }[];
  propias: { id: number; nombre: string; clave: string }[];
}

export interface ResultadoCarpeta {
  existia: boolean;
  fija: boolean;
  tipo: TipoDocumento | null;
  nombre: string;
  carpeta: { id: number; nombre: string } | null;
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

  // ── 2026-10-15: empresas, carpetas y vista previa con la sesión ──
  // 2026-10-16: documentos de un trabajador (sin ficha de afiliado)
  listarDePersona(personaId: number): Observable<Documento[]> {
    return this.http.get<Documento[]>(`${this.URL}/persona/${personaId}`);
  }

  // 2026-10-30 (Anyi): documentos de un familiar/beneficiario
  listarDeFamiliar(familiarId: number): Observable<Documento[]> {
    return this.http.get<Documento[]>(`${this.URL}/familiar/${familiarId}`);
  }

  listarDeEmpresa(empresaId: number): Observable<Documento[]> {
    return this.http.get<Documento[]>(`${this.URL}/empresa/${empresaId}`);
  }

  carpetas(): Observable<CatalogoCarpetas> {
    return this.http.get<CatalogoCarpetas>(`${this.URL}/carpetas`);
  }

  crearCarpeta(nombre: string): Observable<ResultadoCarpeta> {
    return this.http.post<ResultadoCarpeta>(`${this.URL}/carpetas`, { nombre });
  }

  subirA(destino: { afiliadoId?: number; empresaId?: number; personaId?: number; familiarId?: number; tipo?: string; carpetaId?: number | null }, archivo: File): Observable<HttpEvent<any>> {
    const form = new FormData();
    form.append('archivo', archivo, archivo.name);
    if (destino.afiliadoId) form.append('afiliadoId', String(destino.afiliadoId));
    if (destino.empresaId) form.append('empresaId', String(destino.empresaId));
    if (destino.personaId) form.append('personaId', String(destino.personaId));
    if (destino.familiarId) form.append('familiarId', String(destino.familiarId));
    form.append('tipo', destino.tipo || 'OTRO');
    if (destino.carpetaId) form.append('carpetaId', String(destino.carpetaId));
    return this.http.request(new HttpRequest('POST', `${this.URL}/subir`, form, { reportProgress: true }));
  }

  mover(id: number, destino: { tipo?: string; carpetaId?: number | null }): Observable<Documento> {
    return this.http.patch<Documento>(`${this.URL}/${id}/tipo`, { tipo: destino.tipo ?? 'OTRO', carpetaId: destino.carpetaId ?? undefined });
  }

  // el archivo se pide CON la sesión (el navegador solo no la manda)
  archivo(id: number): Observable<Blob> {
    return this.http.get(`${this.URL}/${id}/ver`, { responseType: 'blob' });
  }

  obtenerUrlVisualizacion(id: number): string {
    return `${entorno.urlApi}/documentos/${id}/ver`;
  }

  // 2026-10-15: la Asistente debe decir por qué (le llega a Anturi)
  eliminar(id: number, motivo?: string): Observable<any> {
    return this.http.delete(`${this.URL}/${id}`, motivo ? { body: { motivo } } : {});
  }

  reemplazar(id: number, archivo: File, motivo: string): Observable<any> {
    const form = new FormData();
    form.append('archivo', archivo, archivo.name);
    form.append('motivo', motivo);
    return this.http.post(`${this.URL}/${id}/reemplazar`, form);
  }

  esImagen(extension: string): boolean {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension.toLowerCase().replace('.', ''));
  }

  esPdf(extension: string): boolean {
    return extension.toLowerCase().replace('.', '') === 'pdf';
  }
}
