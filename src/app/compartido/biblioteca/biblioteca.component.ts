import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';
import { entorno } from '../../../environments/entorno';

interface HojaResumen { id: number; archivo: string; hoja: string; orden: number; soloAdmin: boolean; columnas: number; cantidadFilas: number }
interface ArchivoExcel { archivo: string; soloAdmin: boolean; hojas: HojaResumen[] }

// 2026-10-09 (pedido de Cristopher: "todo lo del Excel en la página, nada
// oculto"): los Excel originales de Anturi, hoja por hoja, para consultar sin
// salir de la plataforma. Las claves salen tapadas (están cifradas en "Claves
// de portales"). Contabilidad, caja menor, recaudo y nómina solo los ven
// Administrador y Super Admin (el servidor lo controla).
@Component({
  selector: 'anturi-biblioteca',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bib">
      <div>
        <h2 class="pagina-titulo">Archivos Excel</h2>
        <p class="bib__ayuda">Los archivos originales de Anturi, tal cual, para consultar. Las claves salen tapadas: están en "Claves de portales".</p>
      </div>

      <div *ngIf="cargandoLista" class="estado">Cargando...</div>
      <div *ngIf="error" class="alerta-error">{{ error }}</div>

      <div class="bib__cuerpo" *ngIf="!cargandoLista && archivos.length">
        <aside class="tarjeta bib__archivos">
          <button *ngFor="let a of archivos" type="button" class="archivo" [class.archivo--activo]="a === archivo" (click)="elegirArchivo(a)">
            <span class="archivo__nombre">{{ a.archivo }}</span>
            <span class="archivo__meta">{{ a.hojas.length }} hoja{{ a.hojas.length !== 1 ? 's' : '' }}<span *ngIf="a.soloAdmin"> · solo admin</span></span>
          </button>
        </aside>

        <section class="tarjeta bib__hoja" *ngIf="archivo">
          <div class="pestanas">
            <button *ngFor="let h of archivo.hojas" type="button" class="pestana" [class.pestana--activa]="h.id === hojaId" (click)="abrirHoja(h)">{{ h.hoja }}</button>
          </div>
          <div class="hoja__barra">
            <input type="search" class="campo-input buscar" placeholder="Buscar en esta hoja (nombre, cédula, valor...)" [(ngModel)]="filtro" (ngModelChange)="limite = 200">
            <span class="hoja__meta" *ngIf="filas.length">{{ filtradas.length }} fila{{ filtradas.length !== 1 ? 's' : '' }}</span>
          </div>
          <div *ngIf="cargandoHoja" class="estado">Cargando hoja...</div>
          <div class="tabla-scroll" *ngIf="!cargandoHoja && filas.length">
            <table class="tabla-excel">
              <tbody>
                <tr *ngFor="let f of visibles; let i = index">
                  <th class="num-fila">{{ f.n }}</th>
                  <td *ngFor="let c of f.celdas" [class.vacia]="!c">{{ c }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button *ngIf="filtradas.length > limite" type="button" class="boton boton-secundario boton-sm mas" (click)="limite = limite + 500">Ver más filas ({{ filtradas.length - limite }} restantes)</button>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .bib { display: flex; flex-direction: column; gap: var(--espacio-4); min-width: 0; }
    .pagina-titulo { margin: 0; font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); }
    .bib__ayuda { margin: 4px 0 0; color: var(--texto-secundario); font-size: var(--tamano-sm); }
    .bib__cuerpo { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: var(--espacio-4); align-items: start; }
    .bib__archivos { padding: var(--espacio-2); display: flex; flex-direction: column; gap: 2px; max-height: 75vh; overflow-y: auto; }
    .archivo { text-align: left; border: none; background: none; padding: 8px 10px; border-radius: var(--radio-md); cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
    .archivo:hover { background: var(--fondo-tarjeta-hover); }
    .archivo--activo { background: rgba(27,50,112,0.1); }
    .archivo__nombre { font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-principal); }
    .archivo__meta { font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .bib__hoja { padding: var(--espacio-3); min-width: 0; }
    .pestanas { display: flex; gap: 4px; overflow-x: auto; padding-bottom: var(--espacio-2); border-bottom: 1px solid var(--borde-color); }
    .pestana { white-space: nowrap; border: 1px solid var(--borde-color); background: var(--fondo-tarjeta); color: var(--texto-secundario); padding: 4px 10px; border-radius: var(--radio-md); font-size: var(--tamano-xs); cursor: pointer; }
    .pestana--activa { background: var(--color-primario); color: #fff; border-color: var(--color-primario); }
    .hoja__barra { display: flex; gap: var(--espacio-3); align-items: center; margin: var(--espacio-3) 0; }
    .buscar { max-width: 360px; }
    .hoja__meta { font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .tabla-scroll { overflow: auto; max-height: 65vh; border: 1px solid var(--borde-color); border-radius: var(--radio-md); }
    .tabla-excel { border-collapse: collapse; font-size: 12px; }
    .tabla-excel td, .tabla-excel th { border: 1px solid var(--borde-color); padding: 3px 6px; white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis; color: var(--texto-principal); }
    .tabla-excel td.vacia { min-width: 24px; }
    .num-fila { position: sticky; left: 0; background: var(--fondo-tabla-cabecera, #f1f5f9); color: var(--texto-terciario); font-weight: 500; }
    .mas { margin-top: var(--espacio-3); }
    .estado { padding: var(--espacio-4); color: var(--texto-terciario); }
    @media (max-width: 800px) { .bib__cuerpo { grid-template-columns: 1fr; } .bib__archivos { max-height: 220px; } }
  `],
})
export class BibliotecaComponent implements OnInit {
  private readonly URL = `${entorno.urlApi}/biblioteca`;
  archivos: ArchivoExcel[] = [];
  archivo: ArchivoExcel | null = null;
  hojaId: number | null = null;
  filas: string[][] = [];
  filtro = '';
  limite = 200;
  cargandoLista = false;
  cargandoHoja = false;
  error = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargandoLista = true;
    this.http.get<ArchivoExcel[]>(this.URL).pipe(
      catchError(() => { this.error = 'No se pudieron cargar los archivos.'; return of([] as ArchivoExcel[]); }),
      finalize(() => (this.cargandoLista = false)),
    ).subscribe((a) => {
      this.archivos = a;
      // por defecto, RELACION (la más usada)
      const inicial = a.find((x) => x.archivo.startsWith('RELACION')) ?? a[0];
      if (inicial) this.elegirArchivo(inicial);
    });
  }

  elegirArchivo(a: ArchivoExcel): void {
    this.archivo = a;
    if (a.hojas[0]) this.abrirHoja(a.hojas[0]);
  }

  abrirHoja(h: HojaResumen): void {
    this.hojaId = h.id;
    this.filtro = '';
    this.limite = 200;
    this.cargandoHoja = true;
    this.filas = [];
    this.http.get<{ filas: string[][] }>(`${this.URL}/hojas/${h.id}`).pipe(
      catchError(() => { this.error = 'No se pudo abrir la hoja.'; return of(null); }),
      finalize(() => (this.cargandoHoja = false)),
    ).subscribe((r) => { this.filas = r?.filas ?? []; });
  }

  get filtradas(): { n: number; celdas: string[] }[] {
    const conNumero = this.filas.map((celdas, i) => ({ n: i + 1, celdas }));
    const t = this.filtro.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!t) return conNumero;
    return conNumero.filter((f) => f.celdas.join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t));
  }

  get visibles() {
    return this.filtradas.slice(0, this.limite);
  }
}
