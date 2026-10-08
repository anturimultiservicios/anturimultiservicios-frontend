import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

// 2026-10-08: usuarios y claves de portales externos por empresa o persona.
export type TipoCredencial = 'OPERADOR_PILA' | 'EPS' | 'PENSION' | 'ARL' | 'CAJA' | 'CESANTIAS' | 'OTRO';

export const TIPOS_CREDENCIAL: { valor: TipoCredencial; nombre: string; ejemplo: string }[] = [
  { valor: 'OPERADOR_PILA', nombre: 'Operador PILA', ejemplo: 'Asopagos, Aportes en Línea, SOI' },
  { valor: 'EPS', nombre: 'EPS', ejemplo: 'Nueva EPS, Sura, Sanitas' },
  { valor: 'PENSION', nombre: 'Pensión', ejemplo: 'Colpensiones, Porvenir, Protección' },
  { valor: 'ARL', nombre: 'ARL', ejemplo: 'Positiva, Sura, Bolívar' },
  { valor: 'CAJA', nombre: 'Caja de compensación', ejemplo: 'Comfenalco Quindío' },
  { valor: 'CESANTIAS', nombre: 'Cesantías', ejemplo: 'Porvenir, Protección' },
  { valor: 'OTRO', nombre: 'Otro portal', ejemplo: 'DIAN, banco...' },
];

export interface Credencial {
  id: number;
  tipo: TipoCredencial;
  entidad: string;
  usuario: string | null;
  tieneClave: boolean;
  notas: string | null;
  actualizadoEn: string;
}

export interface TitularCredenciales {
  tipo: 'EMPRESA' | 'AFILIADO';
  id: number;
  nombre: string;
  documento: string;
  estado: string;
  credenciales: Credencial[];
}

export interface NuevaCredencial {
  tipo: TipoCredencial;
  entidad: string;
  usuario?: string;
  clave?: string;
  notas?: string;
}

@Injectable({ providedIn: 'root' })
export class CredencialesServicio {
  private readonly URL = `${entorno.urlApi}/credenciales-pila`;

  constructor(private http: HttpClient) {}

  buscar(busqueda: string): Observable<TitularCredenciales[]> {
    return this.http.get<TitularCredenciales[]>(this.URL, { params: new HttpParams().set('busqueda', busqueda) });
  }

  deTitular(tipo: 'EMPRESA' | 'AFILIADO', id: number): Observable<Credencial[]> {
    return this.http.get<Credencial[]>(`${this.URL}/titular/${tipo}/${id}`);
  }

  ver(id: number): Observable<{ usuario: string | null; clave: string | null; entidad: string }> {
    return this.http.post<any>(`${this.URL}/${id}/ver`, {});
  }

  crear(titularTipo: 'EMPRESA' | 'AFILIADO', titularId: number, datos: NuevaCredencial): Observable<Credencial> {
    return this.http.post<Credencial>(this.URL, { titularTipo, titularId, ...datos });
  }

  actualizar(id: number, datos: Partial<NuevaCredencial>): Observable<Credencial> {
    return this.http.patch<Credencial>(`${this.URL}/${id}`, datos);
  }

  quitar(id: number): Observable<unknown> {
    return this.http.delete(`${this.URL}/${id}`);
  }
}
