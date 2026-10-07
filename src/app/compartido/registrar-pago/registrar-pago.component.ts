import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, finalize, forkJoin, of, switchMap, takeUntil } from 'rxjs';
import { AfiliadosServicio, Afiliado } from '../../nucleo/servicios/afiliados.servicio';
import { EmpresasServicio, Empresa } from '../../nucleo/servicios/empresas.servicio';
import { PagosServicio, CanalPago, ResumenPagos } from '../../nucleo/servicios/pagos.servicio';

// 2026-10-07 (decisión de Cristopher): "no tenemos esa parte" - marcar que
// una persona ya pagó, de una sola vez cubre todos sus seguros (EPS/
// pensión/ARL/caja), deja de sonar sola el recordatorio (correo/llamada,
// ambos leen Seguro.fechaVencimiento) y alimenta el resumen de ingresos de
// Anturi. Se busca por nombre/cédula (persona) o NIT/razón social
// (empresa, con varios empleados a cargo - cada uno con SU PROPIO monto,
// no uno a repartir).
@Component({
  selector: 'anturi-registrar-pago',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pagina-lista">
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Registrar pago recibido</h2>
      </div>

      <div class="tarjeta">
        <div class="campo-grupo">
          <label class="campo-etiqueta">Buscar por nombre, cédula o NIT</label>
          <input
            type="text"
            class="campo-input"
            placeholder="Ej: Juan Pérez, 123456789, 900123456..."
            [(ngModel)]="terminoBusqueda"
            (ngModelChange)="buscar$.next($event)"
          >
        </div>

        <div *ngIf="buscando" class="estado-carga-inline">Buscando...</div>

        <div *ngIf="!buscando && terminoBusqueda && resultadosPersonas.length === 0 && resultadosEmpresas.length === 0" class="estado-vacio-inline">
          Sin resultados para "{{ terminoBusqueda }}".
        </div>

        <!-- Resultados: personas (independientes) -->
        <div *ngIf="resultadosPersonas.length > 0" class="resultados-grupo">
          <h4 class="resultados-titulo">Personas</h4>
          <div *ngFor="let a of resultadosPersonas" class="fila-persona">
            <label class="permiso-check">
              <input type="checkbox" [checked]="estaSeleccionado(a.id)" (change)="toggleSeleccion(a)" [disabled]="yaPagados.has(a.id)">
              <strong>{{ a.nombres }} {{ a.apellidos }}</strong>
              <span class="dato-secundario">CC {{ a.cedula }}</span>
            </label>
            <span class="monto-persona">{{ (a.totalPago || 0) | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
            <span *ngIf="yaPagados.has(a.id)" class="badge-pagado">Pagado ✓</span>
          </div>
        </div>

        <!-- Resultados: empresas (NIT) -->
        <div *ngIf="resultadosEmpresas.length > 0" class="resultados-grupo">
          <h4 class="resultados-titulo">Empresas</h4>
          <div *ngFor="let emp of resultadosEmpresas" class="empresa-bloque">
            <button class="empresa-encabezado" (click)="toggleEmpresa(emp)">
              <strong>{{ emp.razonSocial }}</strong>
              <span class="dato-secundario">NIT {{ emp.nit }}</span>
              <span class="empresa-flecha">{{ empresaExpandidaId === emp.id ? '▲' : '▼' }}</span>
            </button>
            <div *ngIf="empresaExpandidaId === emp.id" class="empresa-empleados">
              <div *ngIf="cargandoEmpleados" class="estado-carga-inline">Cargando empleados...</div>
              <div *ngIf="!cargandoEmpleados && empleadosEmpresa.length === 0" class="estado-vacio-inline">Esta empresa no tiene empleados activos registrados.</div>
              <div *ngFor="let a of empleadosEmpresa" class="fila-persona">
                <label class="permiso-check">
                  <input type="checkbox" [checked]="estaSeleccionado(a.id)" (change)="toggleSeleccion(a)" [disabled]="yaPagados.has(a.id)">
                  <strong>{{ a.nombres }} {{ a.apellidos }}</strong>
                  <span class="dato-secundario">CC {{ a.cedula }}</span>
                </label>
                <span class="monto-persona">{{ (a.totalPago || 0) | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
                <span *ngIf="yaPagados.has(a.id)" class="badge-pagado">Pagado ✓</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Panel de confirmación -->
        <div *ngIf="seleccionados.size > 0" class="panel-confirmar">
          <p class="panel-confirmar__resumen">
            <strong>{{ seleccionados.size }}</strong> persona{{ seleccionados.size !== 1 ? 's' : '' }} seleccionada{{ seleccionados.size !== 1 ? 's' : '' }} -
            total <strong>{{ totalSeleccionado | currency:'COP':'symbol-narrow':'1.0-0' }}</strong>
          </p>
          <div class="campo-grupo">
            <label class="campo-etiqueta">¿Cómo se recibió el dinero? <span class="requerido">*</span></label>
            <select class="campo-input" [(ngModel)]="canalSeleccionado">
              <option [ngValue]="null">Seleccione...</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
          </div>
          <div *ngIf="errorRegistro" class="alerta-error">{{ errorRegistro }}</div>
          <div class="panel-confirmar__acciones">
            <button class="boton boton-secundario" (click)="limpiarSeleccion()" [disabled]="registrando">Cancelar</button>
            <button class="boton boton-primario" (click)="confirmarPagos()" [disabled]="registrando || !canalSeleccionado">
              <span *ngIf="registrando" class="spinner-inline"></span>
              {{ registrando ? 'Registrando...' : 'Marcar como pagado' }}
            </button>
          </div>
        </div>

        <div *ngIf="mensajeExito" class="alerta-exito" style="margin-top: var(--espacio-3);">{{ mensajeExito }}</div>
      </div>

      <!-- Resumen de ingresos -->
      <div class="tarjeta">
        <h3 class="seccion-titulo">Resumen de ingresos</h3>
        <div class="resumen-filtros">
          <div class="campo-grupo">
            <label class="campo-etiqueta">Desde</label>
            <input type="date" class="campo-input" [(ngModel)]="resumenDesde" (ngModelChange)="cargarResumen()">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Hasta</label>
            <input type="date" class="campo-input" [(ngModel)]="resumenHasta" (ngModelChange)="cargarResumen()">
          </div>
        </div>

        <div *ngIf="cargandoResumen" class="estado-carga-inline">Cargando resumen...</div>

        <div *ngIf="!cargandoResumen && resumen" class="resumen-totales">
          <div class="resumen-total-item">
            <span class="resumen-total-etiqueta">Total recibido</span>
            <span class="resumen-total-valor">{{ resumen.totalRecibido | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <div class="resumen-total-item">
            <span class="resumen-total-etiqueta">Efectivo</span>
            <span class="resumen-total-valor">{{ resumen.porCanal.EFECTIVO | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <div class="resumen-total-item">
            <span class="resumen-total-etiqueta">Transferencia</span>
            <span class="resumen-total-valor">{{ resumen.porCanal.TRANSFERENCIA | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
          </div>
        </div>

        <div *ngIf="!cargandoResumen && resumen && resumen.pagos.length > 0" class="tabla-scroll">
          <table class="tabla">
            <thead>
              <tr><th>Persona</th><th>Monto</th><th>Canal</th><th>Registrado por</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of resumen.pagos">
                <td>{{ p.afiliado ? (p.afiliado.nombres + ' ' + p.afiliado.apellidos) : 'Sin identificar' }}</td>
                <td>{{ p.monto | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                <td>{{ p.canal === 'EFECTIVO' ? 'Efectivo' : p.canal === 'TRANSFERENCIA' ? 'Transferencia' : '-' }}</td>
                <td>{{ p.registradoPor ? (p.registradoPor.nombre + ' ' + p.registradoPor.apellido) : '-' }}</td>
                <td>{{ p.fechaPago | date:'dd/MM/yyyy HH:mm' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div *ngIf="!cargandoResumen && resumen && resumen.pagos.length === 0" class="estado-vacio-inline">No hay pagos registrados en este rango de fechas.</div>
      </div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .tarjeta { background: var(--fondo-tarjeta); border: 1px solid var(--borde-color); border-radius: var(--radio-md); padding: var(--espacio-4); display: flex; flex-direction: column; gap: var(--espacio-3); }
    .seccion-titulo { font-size: var(--tamano-lg); font-weight: 600; color: var(--texto-principal); margin: 0; }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .requerido { color: var(--color-error); }
    .estado-carga-inline, .estado-vacio-inline { color: var(--texto-terciario); font-size: var(--tamano-sm); padding: var(--espacio-2) 0; }

    .resultados-grupo { display: flex; flex-direction: column; gap: var(--espacio-2); }
    .resultados-titulo { font-size: var(--tamano-sm); font-weight: 700; color: var(--texto-secundario); text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
    .fila-persona { display: flex; align-items: center; justify-content: space-between; gap: var(--espacio-3); padding: var(--espacio-2) var(--espacio-3); border: 1px solid var(--borde-color); border-radius: var(--radio-md); }
    .permiso-check { display: flex; align-items: center; gap: var(--espacio-2); cursor: pointer; flex: 1; min-width: 0; }
    .permiso-check input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-primario); flex-shrink: 0; }
    .dato-secundario { color: var(--texto-terciario); font-size: var(--tamano-sm); }
    .monto-persona { font-weight: 600; color: var(--texto-principal); white-space: nowrap; }
    .badge-pagado { color: #15803d; font-size: var(--tamano-sm); font-weight: 600; white-space: nowrap; }

    .empresa-bloque { border: 1px solid var(--borde-color); border-radius: var(--radio-md); overflow: hidden; }
    .empresa-encabezado { width: 100%; display: flex; align-items: center; gap: var(--espacio-3); padding: var(--espacio-3); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); border: none; cursor: pointer; text-align: left; font-size: var(--tamano-base); color: var(--texto-principal); }
    .empresa-flecha { margin-left: auto; color: var(--texto-terciario); }
    .empresa-empleados { display: flex; flex-direction: column; gap: var(--espacio-2); padding: var(--espacio-3); }

    .panel-confirmar { display: flex; flex-direction: column; gap: var(--espacio-3); padding: var(--espacio-4); background: rgba(27,50,112,0.05); border-radius: var(--radio-md); border: 1px solid rgba(27,50,112,0.15); }
    .panel-confirmar__resumen { margin: 0; }
    .panel-confirmar__acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); }

    .resumen-filtros { display: flex; gap: var(--espacio-4); flex-wrap: wrap; }
    .resumen-totales { display: flex; gap: var(--espacio-4); flex-wrap: wrap; }
    .resumen-total-item { display: flex; flex-direction: column; gap: 2px; padding: var(--espacio-3); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); border-radius: var(--radio-md); min-width: 160px; }
    .resumen-total-etiqueta { font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .resumen-total-valor { font-size: var(--tamano-lg); font-weight: 700; color: var(--texto-principal); }

    .tabla-scroll { overflow-x: auto; }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla th, .tabla td { text-align: left; padding: var(--espacio-3); border-bottom: 1px solid var(--borde-color); font-size: var(--tamano-sm); }
    .tabla th { color: var(--texto-secundario); font-weight: 600; }

    .alerta-exito { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: var(--radio-md); padding: var(--espacio-3); }
    .alerta-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: var(--radio-md); padding: var(--espacio-3); font-size: var(--tamano-sm); }
    .spinner-inline { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: 6px; }
    @keyframes girar { to { transform: rotate(360deg); } }
  `],
})
export class RegistrarPagoComponent implements OnDestroy {
  terminoBusqueda = '';
  buscando = false;
  resultadosPersonas: Afiliado[] = [];
  resultadosEmpresas: Empresa[] = [];

  empresaExpandidaId: number | null = null;
  empleadosEmpresa: Afiliado[] = [];
  cargandoEmpleados = false;

  seleccionados = new Map<number, Afiliado>();
  yaPagados = new Set<number>();
  canalSeleccionado: CanalPago | null = null;
  registrando = false;
  errorRegistro = '';
  mensajeExito = '';

  resumenDesde: string;
  resumenHasta: string;
  resumen: ResumenPagos | null = null;
  cargandoResumen = false;

  buscar$ = new Subject<string>();
  private destruir$ = new Subject<void>();

  constructor(
    private afiliadosServicio: AfiliadosServicio,
    private empresasServicio: EmpresasServicio,
    private pagosServicio: PagosServicio,
  ) {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.resumenDesde = primerDiaMes.toISOString().slice(0, 10);
    this.resumenHasta = hoy.toISOString().slice(0, 10);

    this.buscar$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((termino) => {
        if (!termino || termino.trim().length < 2) {
          this.resultadosPersonas = [];
          this.resultadosEmpresas = [];
          return of(null);
        }
        this.buscando = true;
        return forkJoin({
          personas: this.afiliadosServicio.listar(termino, 'ACTIVO', undefined, 1, 20).pipe(catchError(() => of({ datos: [] as Afiliado[] }))),
          empresas: this.empresasServicio.listar(termino, true).pipe(catchError(() => of([] as Empresa[]))),
        });
      }),
      takeUntil(this.destruir$),
    ).subscribe((res) => {
      this.buscando = false;
      if (res) {
        this.resultadosPersonas = res.personas.datos;
        this.resultadosEmpresas = res.empresas;
      }
    });

    this.cargarResumen();
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  toggleEmpresa(emp: Empresa): void {
    if (this.empresaExpandidaId === emp.id) {
      this.empresaExpandidaId = null;
      this.empleadosEmpresa = [];
      return;
    }
    this.empresaExpandidaId = emp.id;
    this.cargandoEmpleados = true;
    this.afiliadosServicio.listar(undefined, 'ACTIVO', undefined, 1, 200, emp.id).pipe(
      catchError(() => of({ datos: [] as Afiliado[] })),
      finalize(() => { this.cargandoEmpleados = false; }),
      takeUntil(this.destruir$),
    ).subscribe((res) => { this.empleadosEmpresa = res.datos; });
  }

  estaSeleccionado(id: number): boolean {
    return this.seleccionados.has(id);
  }

  toggleSeleccion(a: Afiliado): void {
    if (this.seleccionados.has(a.id)) {
      this.seleccionados.delete(a.id);
    } else {
      this.seleccionados.set(a.id, a);
    }
  }

  limpiarSeleccion(): void {
    this.seleccionados.clear();
    this.canalSeleccionado = null;
    this.errorRegistro = '';
  }

  get totalSeleccionado(): number {
    let total = 0;
    for (const a of this.seleccionados.values()) total += Number(a.totalPago || 0);
    return total;
  }

  confirmarPagos(): void {
    if (!this.canalSeleccionado || this.seleccionados.size === 0) return;
    this.registrando = true;
    this.errorRegistro = '';
    const personas = Array.from(this.seleccionados.values());

    forkJoin(
      personas.map((a) =>
        this.pagosServicio.registrarCompleto(a.id, Number(a.totalPago || 0), this.canalSeleccionado!).pipe(
          catchError((err) => of({ error: true, afiliado: a, mensaje: err?.error?.message })),
        ),
      ),
    ).pipe(
      finalize(() => { this.registrando = false; }),
    ).subscribe((resultados) => {
      const exitosos = resultados.filter((r: any) => !r?.error);
      const fallidos = resultados.filter((r: any) => r?.error);

      for (const a of personas) {
        if (!fallidos.some((f: any) => f.afiliado.id === a.id)) {
          this.yaPagados.add(a.id);
        }
      }

      if (exitosos.length > 0) {
        this.mensajeExito = `${exitosos.length} pago(s) registrado(s) correctamente.`;
        setTimeout(() => { this.mensajeExito = ''; }, 5000);
        this.cargarResumen();
      }
      if (fallidos.length > 0) {
        const nombres = fallidos.map((f: any) => `${f.afiliado.nombres} ${f.afiliado.apellidos}`).join(', ');
        this.errorRegistro = `No se pudo registrar el pago de: ${nombres}.`;
      } else {
        this.limpiarSeleccion();
      }
    });
  }

  cargarResumen(): void {
    this.cargandoResumen = true;
    this.pagosServicio.resumen(this.resumenDesde, this.resumenHasta).pipe(
      catchError(() => of(null)),
      finalize(() => { this.cargandoResumen = false; }),
      takeUntil(this.destruir$),
    ).subscribe((res) => { this.resumen = res; });
  }
}
