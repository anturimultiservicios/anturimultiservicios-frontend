import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

// 2026-10-16: ficha del trabajador (personal de empresa sin ficha de
// afiliado) y familia (beneficiarios) de afiliados y trabajadores.
export interface FichaTrabajador {
  id: number;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  fechaNacimiento: string | null;
  fechaExpedicion: string | null;
  direccion: string | null;
  municipio: string | null;
  observaciones: string | null;
  afiliado: { id: number } | null;
  relacionesLaborales: {
    id: number; cargo: string | null; estado: string; fechaIngreso: string | null; fechaRetiro: string | null;
    salario?: string | number | null; otrosIngresos?: string | number | null; auxilioTransporte?: string | number | null;
    empresa: { id: number; razonSocial: string; nit: string }; sucursal: { id: number; nombre: string } | null;
  }[];
}

export interface Familiar {
  id: number;
  afiliadoId: number | null;
  personaId: number | null;
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumento: string | null;
  parentesco: string;
  fechaNacimiento: string | null;
  // 2026-10-22 (Anyi)
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  observaciones: string | null;
}

export const PARENTESCOS: { valor: string; nombre: string }[] = [
  { valor: 'HIJO', nombre: 'Hijo(a)' },
  { valor: 'HIJASTRO', nombre: 'Hijastro(a)' },
  { valor: 'CONYUGE', nombre: 'Cónyuge' },
  { valor: 'COMPANERO_PERMANENTE', nombre: 'Compañero(a) permanente' },
  { valor: 'HERMANO', nombre: 'Hermano(a)' },
  { valor: 'PADRE', nombre: 'Padre' },
  { valor: 'MADRE', nombre: 'Madre' },
  { valor: 'OTRO', nombre: 'Otro' },
];

// 2026-10-22: resultado de buscar a quién agregar a una empresa
export interface PersonaEncontrada {
  personaId: number;
  tipoDocumento: string;
  numeroDocumento: string;
  nombre: string;
  afiliado: { id: number; estado: string } | null;
  trabajaEn: { empresaId: number; razonSocial: string }[];
}

@Injectable({ providedIn: 'root' })
export class TrabajadoresServicio {
  private readonly URL = entorno.urlApi;

  constructor(private http: HttpClient) {}

  buscar(texto: string): Observable<PersonaEncontrada[]> {
    return this.http.get<PersonaEncontrada[]>(`${this.URL}/trabajadores`, { params: { buscar: texto } });
  }

  obtener(personaId: number): Observable<FichaTrabajador> {
    return this.http.get<FichaTrabajador>(`${this.URL}/trabajadores/${personaId}`);
  }

  actualizar(personaId: number, datos: Partial<FichaTrabajador> & { motivo?: string }): Observable<FichaTrabajador> {
    return this.http.put<FichaTrabajador>(`${this.URL}/trabajadores/${personaId}`, datos);
  }

  // 2026-10-22 (Anyi): cargo y lo que gana en una empresa
  actualizarRelacion(relacionId: number, datos: { cargo?: string; salario?: number | null; otrosIngresos?: number | null; auxilioTransporte?: number | null }): Observable<unknown> {
    return this.http.put(`${this.URL}/trabajadores/relacion/${relacionId}`, datos);
  }

  familia(titular: { afiliadoId?: number; personaId?: number }): Observable<Familiar[]> {
    const q = titular.afiliadoId ? `afiliadoId=${titular.afiliadoId}` : `personaId=${titular.personaId}`;
    return this.http.get<Familiar[]>(`${this.URL}/familiares?${q}`);
  }

  agregarFamiliar(datos: Partial<Familiar>): Observable<Familiar> {
    return this.http.post<Familiar>(`${this.URL}/familiares`, datos);
  }

  editarFamiliar(id: number, datos: Partial<Familiar>): Observable<Familiar> {
    return this.http.put<Familiar>(`${this.URL}/familiares/${id}`, datos);
  }

  quitarFamiliar(id: number, motivo: string): Observable<{ mensaje: string; pendienteAprobacion: boolean }> {
    return this.http.delete<{ mensaje: string; pendienteAprobacion: boolean }>(`${this.URL}/familiares/${id}`, { body: { motivo } });
  }
}
