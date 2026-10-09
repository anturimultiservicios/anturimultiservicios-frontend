import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { entorno } from '../../../environments/entorno';

interface Entidad { tipo: string; nombre: string; nit: string | null }

// Una sola consulta por sesión (se reutiliza entre formularios).
let entidades$: Observable<Entidad[]> | null = null;

// 2026-10-09: sugerencias al escribir EPS, pensión, ARL, caja y cesantías
// (listas de los Excel de Anturi). Se usan con list="lista-eps", etc. Se
// puede escribir cualquier otra entidad: solo sugiere.
@Component({
  selector: 'anturi-listas-entidades',
  standalone: true,
  imports: [CommonModule],
  template: `
    <datalist id="lista-eps"><option *ngFor="let e of de('EPS')" [value]="e"></option></datalist>
    <datalist id="lista-pension"><option *ngFor="let e of de('PENSION')" [value]="e"></option></datalist>
    <datalist id="lista-arl"><option *ngFor="let e of de('ARL')" [value]="e"></option></datalist>
    <datalist id="lista-caja"><option *ngFor="let e of de('CAJA_COMPENSACION')" [value]="e"></option></datalist>
    <datalist id="lista-cesantias"><option *ngFor="let e of de('CESANTIAS')" [value]="e"></option></datalist>
  `,
})
export class ListasEntidadesComponent implements OnInit {
  private lista: Entidad[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    if (!entidades$) {
      entidades$ = this.http.get<Entidad[]>(`${entorno.urlApi}/biblioteca/entidades`).pipe(
        catchError(() => { entidades$ = null; return of([] as Entidad[]); }),
        shareReplay(1),
      );
    }
    entidades$.subscribe((l) => (this.lista = l));
  }

  de(tipo: string): string[] {
    return this.lista.filter((e) => e.tipo === tipo).map((e) => e.nombre);
  }
}
