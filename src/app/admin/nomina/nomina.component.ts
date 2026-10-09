import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';
import { entorno } from '../../../environments/entorno';
import { calcularLineaNomina } from './nomina-calculo';
import { esc, fechaCorta, imprimirHtml, pesos } from '../../compartido/imprimir';

interface Empleador { empleadorDocumento: string; empleadorNombre: string; empresaId: number | null; ultimoPeriodo: string; periodos: number }
interface Totales { trabajadores: number; devengado: number; descuentos: number; salud: number; pension: number; neto: number; ajuste: number; totalNomina: number }
interface PeriodoResumen { id: number; empresaId: number | null; empleadorNombre: string; empleadorDocumento: string; desde: string; hasta: string; ajuste: string | number; totales: Totales }
interface Linea {
  nombre: string; tipoDocumento: string; documento: string; fechaIngreso: string | null;
  salarioBase: number; dias: number; conAuxilio: boolean;
  diasIncapacidad: number; valorIncapacidad: number; diasVacaciones: number; valorVacaciones: number;
  horasExtras: number; recargos: number; otrosIngresos: number; otrosDescuentos: number;
}
interface PeriodoDetalle extends PeriodoResumen {
  observaciones: string | null;
  lineas: (Linea & Record<string, unknown>)[];
  empresa: { id: number; razonSocial: string; nit: string; direccion: string | null; municipio: string | null; telefono: string | null } | null;
  ley: { salarioMinimo: number; auxilioTransporte: number };
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const lineaVacia = (dias = 15): Linea => ({
  nombre: '', tipoDocumento: 'CC', documento: '', fechaIngreso: null, salarioBase: 0, dias, conAuxilio: false,
  diasIncapacidad: 0, valorIncapacidad: 0, diasVacaciones: 0, valorVacaciones: 0, horasExtras: 0, recargos: 0, otrosIngresos: 0, otrosDescuentos: 0,
});

// 2026-10-09 (pedido de Cristopher): NÓMINA de los empleadores que lleva
// Anturi, desde la página (antes NOMINA EMPLEADOR.xlsx, una hoja por
// quincena: LN = liquidación, Nomina = planilla, RN = colillas). Solo
// Administrador y Super Admin. Salud y pensión 4% cada una sobre lo
// salarial; fondo de solidaridad 1% desde 4 mínimos.
@Component({
  selector: 'anturi-nomina',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="nom">
      <div class="nom__encabezado">
        <div>
          <h2 class="pagina-titulo">Nómina</h2>
          <p class="nom__ayuda">Quincenas de los empleadores que lleva Anturi. Salud 4% y pensión 4% del trabajador; el auxilio de transporte no lleva descuentos.</p>
        </div>
        <button type="button" class="boton boton-primario" (click)="abrirNuevo()">+ Nueva nómina</button>
      </div>

      <div *ngIf="mensaje" class="alerta-exito">{{ mensaje }}</div>
      <div *ngIf="error" class="alerta-error">{{ error }}</div>

      <div class="nom__cuerpo">
        <aside class="tarjeta nom__lista">
          <div class="nom__lista-titulo">Empleadores</div>
          <div *ngIf="!empleadores.length && !cargando" class="estado">Todavía no hay nóminas.</div>
          <button *ngFor="let e of empleadores" type="button" class="item" [class.item--activo]="e.empleadorDocumento === empleador?.empleadorDocumento" (click)="elegirEmpleador(e)">
            <span class="item__nombre">{{ e.empleadorNombre }}</span>
            <span class="item__meta">{{ e.empleadorDocumento }} · {{ e.periodos }} periodo{{ e.periodos !== 1 ? 's' : '' }}</span>
          </button>
          <ng-container *ngIf="empleador">
            <div class="nom__lista-titulo">Periodos</div>
            <button *ngFor="let p of periodos" type="button" class="item" [class.item--activo]="p.id === detalle?.id" (click)="abrir(p.id)">
              <span class="item__nombre">{{ p.desde | date:'d MMM':'UTC' }} – {{ p.hasta | date:'d MMM y':'UTC' }}</span>
              <span class="item__meta">{{ p.totales.trabajadores }} trab. · {{ p.totales.totalNomina | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
            </button>
          </ng-container>
        </aside>

        <section class="tarjeta nom__detalle" *ngIf="detalle; else sinDetalle">
          <div class="det__cab">
            <div>
              <h3 class="det__titulo">{{ detalle.empleadorNombre }} <small>{{ detalle.empleadorDocumento }}</small></h3>
              <div class="det__periodo">Periodo de pago: {{ detalle.desde | date:'dd/MM/yyyy':'UTC' }} al {{ detalle.hasta | date:'dd/MM/yyyy':'UTC' }}</div>
              <div class="det__ley">Salario mínimo {{ detalle.ley.salarioMinimo | currency:'COP':'symbol-narrow':'1.0-0' }} · Auxilio de transporte {{ detalle.ley.auxilioTransporte | currency:'COP':'symbol-narrow':'1.0-0' }}</div>
            </div>
            <div class="det__acciones">
              <button type="button" class="boton boton-secundario boton-sm" (click)="imprimirPlanilla()">Imprimir planilla</button>
              <button type="button" class="boton boton-secundario boton-sm" (click)="imprimirColillas()">Imprimir colillas</button>
              <button type="button" class="boton boton-secundario boton-sm" [disabled]="trabajando" (click)="siguiente()">Siguiente quincena →</button>
              <button type="button" class="boton boton-texto boton-sm peligro" [disabled]="trabajando" (click)="eliminar()">Eliminar</button>
            </div>
          </div>

          <div class="tabla-scroll">
            <table class="tabla tabla-nomina">
              <thead>
                <tr>
                  <th>Trabajador</th><th>Documento</th><th>Salario mensual</th><th>Días</th><th title="Auxilio de transporte">Aux.</th>
                  <th>Incapacidad</th><th>Vacaciones</th><th>Horas extras</th><th>Recargos</th><th>Otros ingresos</th><th>Otros descuentos</th>
                  <th class="calc">Devengado</th><th class="calc">Salud</th><th class="calc">Pensión</th><th class="calc">Neto a pagar</th><th></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let l of lineas; let i = index">
                  <td><input class="campo-input c-nombre" [(ngModel)]="l.nombre" [attr.aria-label]="'Nombre trabajador ' + (i + 1)"></td>
                  <td><input class="campo-input c-doc" [(ngModel)]="l.documento" aria-label="Documento"></td>
                  <td><input type="number" min="0" class="campo-input c-num" [(ngModel)]="l.salarioBase" aria-label="Salario mensual"></td>
                  <td><input type="number" min="0" max="31" class="campo-input c-dias" [(ngModel)]="l.dias" aria-label="Días"></td>
                  <td class="centro"><input type="checkbox" [(ngModel)]="l.conAuxilio" aria-label="Auxilio de transporte"></td>
                  <td><input type="number" min="0" class="campo-input c-num" [(ngModel)]="l.valorIncapacidad" aria-label="Incapacidad"></td>
                  <td><input type="number" min="0" class="campo-input c-num" [(ngModel)]="l.valorVacaciones" aria-label="Vacaciones"></td>
                  <td><input type="number" min="0" class="campo-input c-num" [(ngModel)]="l.horasExtras" aria-label="Horas extras"></td>
                  <td><input type="number" min="0" class="campo-input c-num" [(ngModel)]="l.recargos" aria-label="Recargos"></td>
                  <td><input type="number" min="0" class="campo-input c-num" [(ngModel)]="l.otrosIngresos" aria-label="Otros ingresos"></td>
                  <td><input type="number" min="0" class="campo-input c-num" [(ngModel)]="l.otrosDescuentos" aria-label="Otros descuentos"></td>
                  <td class="calc">{{ calc(l).totalDevengado | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td class="calc">{{ calc(l).salud | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td class="calc">{{ calc(l).pension | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td class="calc fuerte">{{ calc(l).neto | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td><button type="button" class="boton boton-texto boton-sm peligro" (click)="quitar(i)" title="Quitar">✕</button></td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="11" class="der">TOTALES</td>
                  <td class="calc">{{ totales.devengado | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td class="calc">{{ totales.salud | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td class="calc">{{ totales.pension | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td class="calc fuerte">{{ totales.neto | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="det__pie">
            <div class="det__botones">
              <button type="button" class="boton boton-secundario boton-sm" (click)="agregar()">+ Trabajador</button>
              <button *ngIf="detalle.empresaId" type="button" class="boton boton-secundario boton-sm" (click)="traerPersonal()">Traer personal de la empresa</button>
            </div>
            <div class="det__ajuste">
              <label for="nomAjuste">Ajuste</label>
              <input id="nomAjuste" type="number" class="campo-input c-num" [(ngModel)]="ajuste">
              <span>Total nómina: <strong>{{ totales.neto + num(ajuste) | currency:'COP':'symbol-narrow':'1.0-0' }}</strong></span>
            </div>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="nomObs">Observaciones</label>
            <textarea id="nomObs" class="campo-input" rows="2" [(ngModel)]="observaciones"></textarea>
          </div>
          <div class="det__guardar">
            <span *ngIf="cambios" class="pendiente">Hay cambios sin guardar</span>
            <button type="button" class="boton boton-primario" [disabled]="trabajando || !lineasValidas" (click)="guardar()">{{ trabajando ? 'Guardando...' : 'Guardar nómina' }}</button>
          </div>
        </section>
        <ng-template #sinDetalle>
          <section class="tarjeta nom__detalle estado">{{ cargando ? 'Cargando...' : 'Elija un empleador y un periodo, o cree una nueva nómina.' }}</section>
        </ng-template>
      </div>
    </div>

    <div *ngIf="modalNuevo" class="modal-overlay" (click)="modalNuevo = false">
      <div class="modal-contenido" (click)="$event.stopPropagation()" role="dialog" aria-labelledby="tituloNuevaNomina">
        <h3 id="tituloNuevaNomina" class="modal-titulo">Nueva nómina</h3>
        <div class="campo-grupo">
          <label class="campo-etiqueta" for="nnNombre">Empleador (nombre o razón social)</label>
          <input id="nnNombre" class="campo-input" list="nn-empleadores" [(ngModel)]="nuevo.empleadorNombre" (ngModelChange)="completarEmpleador()">
          <datalist id="nn-empleadores"><option *ngFor="let e of empleadores" [value]="e.empleadorNombre"></option></datalist>
        </div>
        <div class="campo-grupo">
          <label class="campo-etiqueta" for="nnDoc">Cédula o NIT del empleador</label>
          <input id="nnDoc" class="campo-input" [(ngModel)]="nuevo.empleadorDocumento">
          <small class="sub">Si tiene cuenta en Anturi con ese documento, se enlaza sola.</small>
        </div>
        <div class="fila2">
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="nnDesde">Desde</label>
            <input id="nnDesde" type="date" class="campo-input" [(ngModel)]="nuevo.desde">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="nnHasta">Hasta</label>
            <input id="nnHasta" type="date" class="campo-input" [(ngModel)]="nuevo.hasta">
          </div>
        </div>
        <div *ngIf="errorNuevo" class="alerta-error">{{ errorNuevo }}</div>
        <div class="modal-acciones">
          <button type="button" class="boton boton-secundario" (click)="modalNuevo = false">Cancelar</button>
          <button type="button" class="boton boton-primario" [disabled]="trabajando || !nuevo.empleadorNombre.trim() || nuevo.empleadorDocumento.trim().length < 3 || !nuevo.desde || !nuevo.hasta" (click)="crear()">Crear</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .nom { display: flex; flex-direction: column; gap: var(--espacio-4); min-width: 0; }
    .nom__encabezado { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--espacio-3); flex-wrap: wrap; }
    .pagina-titulo { margin: 0; font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); }
    .nom__ayuda { margin: 4px 0 0; color: var(--texto-secundario); font-size: var(--tamano-sm); }
    .nom__cuerpo { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: var(--espacio-4); align-items: start; }
    .nom__lista { padding: var(--espacio-2); display: flex; flex-direction: column; gap: 2px; max-height: 78vh; overflow-y: auto; }
    .nom__lista-titulo { font-size: var(--tamano-xs); font-weight: 700; text-transform: uppercase; color: var(--texto-terciario); padding: 8px 10px 4px; }
    .item { text-align: left; border: none; background: none; padding: 7px 10px; border-radius: var(--radio-md); cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
    .item:hover { background: var(--fondo-tarjeta-hover); }
    .item--activo { background: rgba(27,50,112,0.1); }
    .item__nombre { font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-principal); }
    .item__meta { font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .nom__detalle { padding: var(--espacio-4); min-width: 0; display: flex; flex-direction: column; gap: var(--espacio-3); }
    .det__cab { display: flex; justify-content: space-between; gap: var(--espacio-3); flex-wrap: wrap; }
    .det__titulo { margin: 0; font-size: var(--tamano-lg); color: var(--texto-principal); }
    .det__titulo small { font-weight: 400; color: var(--texto-terciario); }
    .det__periodo { font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .det__ley { font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .det__acciones { display: flex; gap: var(--espacio-2); flex-wrap: wrap; align-items: flex-start; }
    .tabla-scroll { overflow-x: auto; }
    .tabla-nomina { font-size: var(--tamano-sm); }
    .tabla-nomina th { white-space: nowrap; font-size: var(--tamano-xs); }
    .tabla-nomina td { padding: 4px; }
    .tabla-nomina .campo-input { padding: 4px 6px; font-size: var(--tamano-sm); }
    .c-nombre { min-width: 200px; } .c-doc { width: 110px; } .c-num { width: 110px; } .c-dias { width: 60px; }
    .calc { text-align: right; white-space: nowrap; background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); }
    .fuerte { font-weight: 700; }
    .der { text-align: right; font-weight: 700; }
    .centro { text-align: center; }
    .peligro { color: var(--color-error, #dc2626); }
    .det__pie { display: flex; justify-content: space-between; gap: var(--espacio-3); flex-wrap: wrap; align-items: center; }
    .det__botones { display: flex; gap: var(--espacio-2); flex-wrap: wrap; }
    .det__ajuste { display: flex; gap: var(--espacio-2); align-items: center; font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .det__guardar { display: flex; justify-content: flex-end; align-items: center; gap: var(--espacio-3); }
    .pendiente { font-size: var(--tamano-sm); color: #b45309; }
    .estado { padding: var(--espacio-4); color: var(--texto-terciario); }
    .sub { font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .fila2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--espacio-3); }
    @media (max-width: 900px) { .nom__cuerpo { grid-template-columns: 1fr; } .nom__lista { max-height: 260px; } }
  `],
})
export class NominaComponent implements OnInit {
  private readonly URL = `${entorno.urlApi}/nomina`;
  num = num;
  empleadores: Empleador[] = [];
  empleador: Empleador | null = null;
  periodos: PeriodoResumen[] = [];
  detalle: PeriodoDetalle | null = null;
  lineas: Linea[] = [];
  ajuste = 0;
  observaciones = '';
  private original = '';
  cargando = false;
  trabajando = false;
  error = '';
  mensaje = '';
  modalNuevo = false;
  errorNuevo = '';
  nuevo = { empleadorNombre: '', empleadorDocumento: '', desde: '', hasta: '' };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarEmpleadores();
  }

  private fallo(e: any, porDefecto: string): void {
    const m = e?.error?.message;
    this.error = m ? [].concat(m).join('. ') : porDefecto;
  }

  private avisar(m: string): void {
    this.mensaje = m;
    this.error = '';
    setTimeout(() => (this.mensaje = ''), 4000);
  }

  cargarEmpleadores(seleccionar?: string): void {
    this.cargando = true;
    this.http.get<Empleador[]>(`${this.URL}/empleadores`).pipe(
      catchError((e) => { this.fallo(e, 'No se pudo cargar la nómina.'); return of([] as Empleador[]); }),
      finalize(() => (this.cargando = false)),
    ).subscribe((l) => {
      this.empleadores = l;
      const elegido = l.find((x) => x.empleadorDocumento === (seleccionar ?? this.empleador?.empleadorDocumento)) ?? (l.length === 1 ? l[0] : null);
      if (elegido) this.elegirEmpleador(elegido, !!seleccionar);
    });
  }

  elegirEmpleador(e: Empleador, mantenerDetalle = false): void {
    this.empleador = e;
    this.http.get<PeriodoResumen[]>(`${this.URL}/periodos`, { params: { empleador: e.empleadorDocumento } }).pipe(
      catchError(() => of([] as PeriodoResumen[])),
    ).subscribe((p) => {
      this.periodos = p;
      if (!mantenerDetalle && p[0] && this.detalle?.empleadorDocumento !== e.empleadorDocumento) this.abrir(p[0].id);
    });
  }

  abrir(id: number): void {
    if (this.cambios && !confirm('Hay cambios sin guardar en esta nómina. ¿Salir sin guardar?')) return;
    this.http.get<PeriodoDetalle>(`${this.URL}/periodos/${id}`).pipe(
      catchError((e) => { this.fallo(e, 'No se pudo abrir el periodo.'); return of(null); }),
    ).subscribe((d) => d && this.mostrar(d));
  }

  private mostrar(d: PeriodoDetalle): void {
    this.detalle = d;
    this.lineas = d.lineas.map((l) => ({
      nombre: l.nombre, tipoDocumento: l.tipoDocumento, documento: l.documento,
      fechaIngreso: l.fechaIngreso ? String(l.fechaIngreso).slice(0, 10) : null,
      salarioBase: num(l.salarioBase), dias: num(l.dias), conAuxilio: !!l.conAuxilio,
      diasIncapacidad: num(l.diasIncapacidad), valorIncapacidad: num(l.valorIncapacidad),
      diasVacaciones: num(l.diasVacaciones), valorVacaciones: num(l.valorVacaciones),
      horasExtras: num(l.horasExtras), recargos: num(l.recargos), otrosIngresos: num(l.otrosIngresos), otrosDescuentos: num(l.otrosDescuentos),
    }));
    this.ajuste = num(d.ajuste);
    this.observaciones = d.observaciones ?? '';
    this.original = this.huella();
  }

  private huella(): string {
    return JSON.stringify([this.lineas, num(this.ajuste), this.observaciones]);
  }

  get cambios(): boolean {
    return !!this.detalle && this.huella() !== this.original;
  }

  calc(l: Linea) {
    const ley = this.detalle?.ley ?? { salarioMinimo: 1_750_905, auxilioTransporte: 249_095 };
    return calcularLineaNomina(l, ley.salarioMinimo, ley.auxilioTransporte);
  }

  get totales() {
    const t = { devengado: 0, salud: 0, pension: 0, neto: 0 };
    for (const l of this.lineas) {
      const c = this.calc(l);
      t.devengado += c.totalDevengado; t.salud += c.salud; t.pension += c.pension; t.neto += c.neto;
    }
    return t;
  }

  get lineasValidas(): boolean {
    return this.lineas.every((l) => l.nombre.trim().length >= 2 && l.documento.trim().length >= 3 && num(l.salarioBase) >= 0 && num(l.dias) >= 0 && num(l.dias) <= 31);
  }

  agregar(): void {
    this.lineas.push(lineaVacia(this.lineas[0]?.dias ?? 15));
  }

  quitar(i: number): void {
    if (confirm(`¿Quitar a ${this.lineas[i].nombre || 'este trabajador'} de esta nómina?`)) this.lineas.splice(i, 1);
  }

  // Trae el personal activo de la cuenta del empleador (Empresas → Personal).
  traerPersonal(): void {
    if (!this.detalle?.empresaId) return;
    this.http.get<{ estadoRelacion: string; nombre: string; documento: string; tipoDocumento: string; fechaIngreso: string | null }[]>(
      `${entorno.urlApi}/empresas/${this.detalle.empresaId}/personal`,
    ).pipe(catchError((e) => { this.fallo(e, 'No se pudo traer el personal.'); return of([]); })).subscribe((personal) => {
      const ya = new Set(this.lineas.map((l) => l.documento.replace(/\D/g, '')));
      const nuevos = personal.filter((p) => p.estadoRelacion === 'ACTIVA' && !ya.has(String(p.documento).replace(/\D/g, '')));
      const salario = this.detalle?.ley.salarioMinimo ?? 0;
      for (const p of nuevos) {
        this.lineas.push({ ...lineaVacia(this.lineas[0]?.dias ?? 15), nombre: p.nombre.toUpperCase(), documento: p.documento, tipoDocumento: p.tipoDocumento || 'CC', fechaIngreso: p.fechaIngreso ? p.fechaIngreso.slice(0, 10) : null, salarioBase: salario });
      }
      this.avisar(nuevos.length ? `Se agregaron ${nuevos.length} trabajador(es) con salario mínimo; revise los valores y guarde.` : 'Todo el personal activo ya está en esta nómina.');
    });
  }

  guardar(): void {
    if (!this.detalle) return;
    this.trabajando = true;
    this.http.put<PeriodoDetalle>(`${this.URL}/periodos/${this.detalle.id}`, {
      ajuste: num(this.ajuste), observaciones: this.observaciones, lineas: this.lineasParaEnviar(),
    }).pipe(finalize(() => (this.trabajando = false))).subscribe({
      next: (d) => { this.mostrar(d); this.avisar('Nómina guardada.'); this.recargarPeriodos(); },
      error: (e) => this.fallo(e, 'No se pudo guardar la nómina.'),
    });
  }

  private lineasParaEnviar() {
    return this.lineas.map((l) => ({ ...l, salarioBase: num(l.salarioBase), dias: num(l.dias), valorIncapacidad: num(l.valorIncapacidad), valorVacaciones: num(l.valorVacaciones), horasExtras: num(l.horasExtras), recargos: num(l.recargos), otrosIngresos: num(l.otrosIngresos), otrosDescuentos: num(l.otrosDescuentos), fechaIngreso: l.fechaIngreso || undefined }));
  }

  private recargarPeriodos(): void {
    if (this.empleador) this.elegirEmpleador(this.empleador, true);
  }

  siguiente(): void {
    if (!this.detalle) return;
    if (this.cambios) { this.error = 'Guarde los cambios antes de pasar a la siguiente quincena.'; return; }
    this.trabajando = true;
    this.http.post<PeriodoDetalle>(`${this.URL}/periodos/${this.detalle.id}/siguiente`, {}).pipe(finalize(() => (this.trabajando = false))).subscribe({
      next: (d) => { this.mostrar(d); this.avisar('Quincena creada con los mismos trabajadores. Revise novedades (incapacidades, extras...) y guarde.'); this.cargarEmpleadores(d.empleadorDocumento); },
      error: (e) => this.fallo(e, 'No se pudo crear la siguiente quincena.'),
    });
  }

  eliminar(): void {
    if (!this.detalle || !confirm('¿Eliminar este periodo de nómina? No se puede deshacer.')) return;
    this.trabajando = true;
    this.http.delete(`${this.URL}/periodos/${this.detalle.id}`).pipe(finalize(() => (this.trabajando = false))).subscribe({
      next: () => { this.detalle = null; this.lineas = []; this.original = ''; this.avisar('Periodo eliminado.'); this.cargarEmpleadores(); },
      error: (e) => this.fallo(e, 'No se pudo eliminar.'),
    });
  }

  abrirNuevo(): void {
    const hoy = new Date();
    const y = hoy.getFullYear(), m = hoy.getMonth();
    const pad = (n: number) => String(n).padStart(2, '0');
    const primera = hoy.getDate() <= 15;
    const fin = new Date(y, m + 1, 0).getDate();
    this.nuevo = {
      empleadorNombre: this.empleador?.empleadorNombre ?? '',
      empleadorDocumento: this.empleador?.empleadorDocumento ?? '',
      desde: `${y}-${pad(m + 1)}-${primera ? '01' : '16'}`,
      hasta: `${y}-${pad(m + 1)}-${primera ? '15' : pad(fin)}`,
    };
    this.errorNuevo = '';
    this.modalNuevo = true;
  }

  completarEmpleador(): void {
    const e = this.empleadores.find((x) => x.empleadorNombre === this.nuevo.empleadorNombre.trim().toUpperCase());
    if (e) this.nuevo.empleadorDocumento = e.empleadorDocumento;
  }

  crear(): void {
    this.trabajando = true;
    this.errorNuevo = '';
    this.http.post<PeriodoDetalle>(`${this.URL}/periodos`, { ...this.nuevo, lineas: [] }).pipe(finalize(() => (this.trabajando = false))).subscribe({
      next: (d) => {
        this.modalNuevo = false;
        this.original = '';
        this.mostrar(d);
        if (!this.lineas.length) this.agregar();
        this.avisar('Nómina creada. Agregue los trabajadores y guarde.');
        this.cargarEmpleadores(d.empleadorDocumento);
      },
      error: (e) => (this.errorNuevo = e?.error?.message ? [].concat(e.error.message).join('. ') : 'No se pudo crear.'),
    });
  }

  private encabezadoEmpleador(d: PeriodoDetalle): string {
    return `<div class="emp"><div><span class="et">Empleador:</span> ${esc(d.empleadorNombre)}</div><div><span class="et">Documento:</span> ${esc(d.empleadorDocumento)}</div>
      ${d.empresa?.direccion ? `<div><span class="et">Dirección:</span> ${esc(d.empresa.direccion)} ${esc(d.empresa.municipio ?? '')}</div>` : ''}
      <div><span class="et">Periodo de pago:</span> ${fechaCorta(d.desde)} al ${fechaCorta(d.hasta)}</div></div>`;
  }

  imprimirPlanilla(): void {
    const d = this.detalle;
    if (!d) return;
    const filas = this.lineas.map((l, i) => {
      const c = this.calc(l);
      return `<tr><td>${i + 1}</td><td>${esc(l.nombre)}</td><td>${esc(l.tipoDocumento)} ${esc(l.documento)}</td><td class="n">${l.dias}</td><td class="n">${pesos(c.salario)}</td><td class="n">${pesos(c.auxTransporte)}</td>
        <td class="n">${pesos(num(l.valorIncapacidad) + num(l.valorVacaciones))}</td><td class="n">${pesos(num(l.horasExtras) + num(l.recargos))}</td><td class="n">${pesos(l.otrosIngresos)}</td>
        <td class="n">${pesos(c.totalDevengado)}</td><td class="n">${pesos(c.salud)}</td><td class="n">${pesos(c.pension + c.fondoSolidaridad)}</td><td class="n">${pesos(l.otrosDescuentos)}</td><td class="n">${pesos(c.totalDescuentos)}</td><td class="n"><b>${pesos(c.neto)}</b></td><td class="firma"></td></tr>`;
    }).join('');
    const t = this.totales;
    const cuerpo = `<h2>NÓMINA</h2>${this.encabezadoEmpleador(d)}
      <table><thead><tr><th>N°</th><th>Nombre</th><th>Documento</th><th>Días</th><th>Salario</th><th>Aux. transp.</th><th>Incap./Vac.</th><th>Extras/Recargos</th><th>Otros ingresos</th><th>Total pagos</th><th>Salud</th><th>Pensión</th><th>Otros desc.</th><th>Total desc.</th><th>Neto a pagar</th><th>Firma</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><td colspan="9" class="n"><b>TOTALES</b></td><td class="n">${pesos(t.devengado)}</td><td class="n">${pesos(t.salud)}</td><td class="n">${pesos(t.pension)}</td><td></td><td></td><td class="n"><b>${pesos(t.neto)}</b></td><td></td></tr></tfoot></table>
      ${num(this.ajuste) ? `<p><span class="et">Ajuste:</span> ${pesos(this.ajuste)} · <span class="et">Total nómina:</span> ${pesos(t.neto + num(this.ajuste))}</p>` : ''}`;
    const css = `h2 { margin: 0 0 8px; } .emp { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; font-size: 13px; margin-bottom: 12px; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; } th, td { border: 1px solid #000; padding: 4px; } th { background: #eee; } .n { text-align: right; white-space: nowrap; } .firma { min-width: 90px; }
      @page { size: landscape; }`;
    if (!imprimirHtml(`Nómina ${d.empleadorNombre}`, cuerpo, css)) this.error = 'El navegador bloqueó la ventana para imprimir.';
  }

  // Colilla de pago por trabajador (hoja "RN" del Excel).
  imprimirColillas(): void {
    const d = this.detalle;
    if (!d) return;
    const colillas = this.lineas.map((l, i) => {
      const c = this.calc(l);
      const filaSi = (t: string, v: number, pct = '') => (v ? `<tr><td>${t}</td><td class="c">${pct}</td><td class="n">${pesos(v)}</td></tr>` : '');
      return `<div class="colilla${i < this.lineas.length - 1 ? ' salto' : ''}">
        <h3>COLILLA DE PAGO</h3>${this.encabezadoEmpleador(d)}
        <div class="trab"><span class="et">Empleado:</span> ${esc(l.nombre)} &nbsp; <span class="et">Identificación:</span> ${esc(l.tipoDocumento)} ${esc(l.documento)} &nbsp; <span class="et">Días:</span> ${l.dias}</div>
        <table><thead><tr><th colspan="3">RESUMEN DEL PAGO</th></tr></thead><tbody>
          ${filaSi('Salario', c.salario)}${filaSi('Auxilio de transporte', c.auxTransporte)}${filaSi('Incapacidad', num(l.valorIncapacidad))}${filaSi('Vacaciones', num(l.valorVacaciones))}
          ${filaSi('Horas extras', num(l.horasExtras))}${filaSi('Recargos', num(l.recargos))}${filaSi('Otros ingresos', num(l.otrosIngresos))}
          <tr class="tot"><td>TOTAL PAGOS AL TRABAJADOR</td><td></td><td class="n">${pesos(c.totalDevengado)}</td></tr>
        </tbody></table>
        <table><thead><tr><th>DEDUCCIONES</th><th>%</th><th>VALOR</th></tr></thead><tbody>
          ${filaSi('Salud', c.salud, '4%')}${filaSi('Pensión', c.pension, '4%')}${filaSi('Fondo de solidaridad', c.fondoSolidaridad, '1%')}${filaSi('Otras deducciones', num(l.otrosDescuentos))}
          <tr class="tot"><td>TOTAL DEDUCCIONES</td><td></td><td class="n">${pesos(c.totalDescuentos)}</td></tr>
        </tbody></table>
        <div class="neto">NETO A PAGAR: ${pesos(c.neto)}</div>
        <div class="firmas"><div>${esc(l.nombre)}<br><span class="et">Firma del trabajador</span></div><div>${esc(d.empleadorNombre)}<br><span class="et">Firma del empleador</span></div></div>
      </div>`;
    }).join('');
    const css = `.colilla { max-width: 640px; border: 1px solid #000; padding: 16px; margin-bottom: 16px; } h3 { margin: 0 0 8px; text-align: center; }
      .emp { font-size: 12px; margin-bottom: 8px; } .trab { font-size: 13px; margin: 8px 0; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; margin-bottom: 8px; } th, td { border: 1px solid #000; padding: 4px 6px; } th { background: #eee; }
      .n { text-align: right; } .c { text-align: center; width: 50px; } .tot td { font-weight: 700; } .neto { font-size: 16px; font-weight: 700; text-align: right; margin: 8px 0; }
      .firmas { display: flex; justify-content: space-between; margin-top: 48px; font-size: 12px; } .firmas div { border-top: 1px solid #000; padding-top: 4px; min-width: 220px; text-align: center; }`;
    if (!imprimirHtml(`Colillas ${d.empleadorNombre}`, colillas, css)) this.error = 'El navegador bloqueó la ventana para imprimir.';
  }
}
