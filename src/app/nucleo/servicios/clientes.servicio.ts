import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

// 2026-10-22: vínculos entre clientes (esposa de, hijo de, recomendado por…)
// y organizar los nombres que traían notas entre paréntesis desde el Excel.
export type TipoCliente = 'AFILIADO' | 'EMPRESA';

export interface ClienteRef { tipo: TipoCliente; id: number; nombre: string; estado: string | null; documento: string | null }

export interface Vinculo {
  id: number;
  relacion: string;
  etiqueta: string;
  frase: string;
  nota: string | null;
  otro: ClienteRef;
}

export const RELACIONES: { valor: string; nombre: string }[] = [
  { valor: 'CONYUGE', nombre: 'Cónyuge / compañero(a) de' },
  { valor: 'HIJO', nombre: 'Hijo(a) de' },
  { valor: 'PADRE', nombre: 'Padre / madre de' },
  { valor: 'HERMANO', nombre: 'Hermano(a) de' },
  { valor: 'OTRO_FAMILIAR', nombre: 'Otro familiar de' },
  { valor: 'SOCIO', nombre: 'Socio(a) de' },
  { valor: 'RECOMENDADO_POR', nombre: 'Recomendado(a) por' },
  { valor: 'RECOMENDO', nombre: 'Recomendó a' },
];

export type DestinoNota = 'VINCULO' | 'REPRESENTANTE' | 'CONTACTO' | 'CONOCIDO_COMO' | 'OBSERVACIONES' | 'DEJAR';

export interface NombreConNota {
  tipo: TipoCliente;
  id: number;
  estado: string;
  documento: string;
  nombreActual: string;
  nombreLimpio: string;
  nombresLimpios?: string;
  apellidosLimpios?: string;
  nota: string;
  resto: string;
  propuesta: { destino: Exclude<DestinoNota, 'DEJAR'>; relacion?: string; nombre?: string; documento?: string; telefono?: string };
  candidatos: ClienteRef[];
}

@Injectable({ providedIn: 'root' })
export class ClientesServicio {
  private readonly URL = entorno.urlApi;

  constructor(private http: HttpClient) {}

  vinculos(tipo: TipoCliente, id: number): Observable<Vinculo[]> {
    return this.http.get<Vinculo[]>(`${this.URL}/vinculos`, { params: { tipo, id: String(id) } });
  }

  crearVinculo(datos: { origenTipo: TipoCliente; origenId: number; destinoTipo: TipoCliente; destinoId: number; relacion: string; nota?: string }): Observable<unknown> {
    return this.http.post(`${this.URL}/vinculos`, datos);
  }

  quitarVinculo(id: number): Observable<unknown> {
    return this.http.delete(`${this.URL}/vinculos/${id}`);
  }

  nombresConNotas(): Observable<NombreConNota[]> {
    return this.http.get<NombreConNota[]>(`${this.URL}/nombres-con-notas`);
  }

  organizarNombre(tipo: TipoCliente, id: number, datos: Record<string, unknown>): Observable<unknown> {
    return this.http.patch(`${this.URL}/nombres-con-notas/${tipo}/${id}`, datos);
  }
}
