import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { entorno } from '../../../environments/entorno';

export interface EntidadSeguridadSocial { tipo: string; nombre: string; nit?: string | null }

// 2026-10-29: sugerencias de EPS, pensión, ARL y caja (de la biblioteca de
// Excel) para los campos de edición - se pide una sola vez por sesión.
@Injectable({ providedIn: 'root' })
export class EntidadesServicio {
  private lista$?: Observable<EntidadSeguridadSocial[]>;

  constructor(private http: HttpClient) {}

  porTipo(): Observable<Record<string, string[]>> {
    this.lista$ ??= this.http.get<EntidadSeguridadSocial[]>(`${entorno.urlApi}/biblioteca/entidades`).pipe(
      catchError(() => of([] as EntidadSeguridadSocial[])),
      shareReplay(1),
    );
    return this.lista$.pipe(map((l) => {
      const r: Record<string, string[]> = {};
      for (const e of l) (r[e.tipo] ??= []).push(e.nombre);
      return r;
    }));
  }
}
