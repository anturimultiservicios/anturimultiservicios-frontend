import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of, finalize } from 'rxjs';
import { ParametrosLegalesServicio, ParametroLegal } from '../../nucleo/servicios/parametros-legales.servicio';

// 2026-10-07 - primera pantalla real para esta tabla (ver AUDITORIA-
// CONECTIVIDAD-FRONTEND-BACKEND-2026-10-06.md). Cada cambio crea una
// vigencia NUEVA (nunca se sobrescribe el valor viejo) - mismo criterio
// que el backend ya implementa, acá solo se expone.
@Component({
  selector: 'anturi-parametros-legales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pagina-lista">
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Parámetros legales</h2>
      </div>
      <p class="pagina-subtitulo">
        Tasas/porcentajes/valores que el motor de liquidación usa para calcular cuánto paga cada afiliado.
        Cambiar uno acá crea una vigencia nueva desde hoy - el valor anterior queda en el historial, nunca se borra.
      </p>

      <div class="tarjeta filtros-contenedor">
        <div class="filtro-busqueda">
          <svg class="filtro-busqueda__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="campo-input filtro-busqueda__input" placeholder="Buscar por código o nombre..."
            [(ngModel)]="terminoBusqueda" (ngModelChange)="aplicarFiltro()">
        </div>
      </div>

      <div *ngIf="cargando" class="estado-carga"><div class="spinner"></div></div>
      <div *ngIf="error && !cargando" class="tarjeta estado-vacio">
        <p>{{ error }}</p>
        <button class="boton boton-secundario" (click)="cargar()">Reintentar</button>
      </div>

      <div *ngIf="!cargando && !error" class="tarjeta tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr><th>Código</th><th>Nombre</th><th>Valor</th><th>Fuente</th><th>Vigente desde</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of visibles" class="fila-tabla">
              <td class="celda-codigo">{{ p.codigo }}</td>
              <td>{{ p.nombre }}</td>
              <td class="celda-valor">{{ p.valor }}{{ p.unidad === '%' ? '%' : '' }} <span *ngIf="p.unidad && p.unidad !== '%'" class="unidad">{{ p.unidad }}</span></td>
              <td><span class="badge-estado" [ngClass]="claseFuente(p.fuente)">{{ p.fuente }}</span></td>
              <td class="celda-fecha">{{ p.vigenteDesde | date:'dd/MM/yyyy' }}</td>
              <td class="celda-acciones">
                <button class="boton boton-secundario boton-sm" (click)="abrirEditar(p)">Editar</button>
                <button class="boton boton-texto boton-sm" (click)="abrirHistorial(p)">Historial</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="tabla-pie"><span class="tabla-pie__total">{{ visibles.length }} parámetro{{ visibles.length !== 1 ? 's' : '' }}</span></div>
      </div>
    </div>

    <!-- MODAL: editar -->
    <div *ngIf="editando" class="modal-overlay" (click)="cerrarEditar()">
      <div class="modal-form" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-titulo">Cambiar {{ editando.nombre }}</h3>
          <button class="boton boton-icono" (click)="cerrarEditar()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-cuerpo">
          <div *ngIf="errorModal" class="alerta-error" style="margin-bottom: var(--espacio-4);">{{ errorModal }}</div>
          <p style="font-size: var(--tamano-sm); color: var(--texto-terciario);">
            Valor actual: <strong>{{ editando.valor }}{{ editando.unidad || '' }}</strong> (vigente desde {{ editando.vigenteDesde | date:'dd/MM/yyyy' }})
          </p>
          <div class="campo-grupo" style="margin-top: var(--espacio-3);">
            <label class="campo-etiqueta">Nuevo valor <span class="requerido">*</span></label>
            <input type="number" class="campo-input" [(ngModel)]="formValor" step="0.00001">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Fuente</label>
            <select class="campo-input" [(ngModel)]="formFuente">
              <option value="LEY">LEY (norma oficial vigente)</option>
              <option value="EXCEL_HISTORICO">EXCEL_HISTORICO (como venía del Excel)</option>
              <option value="ANTURI">ANTURI (decisión operativa propia)</option>
            </select>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Soporte (norma, URL, archivo de respaldo)</label>
            <input type="text" class="campo-input" [(ngModel)]="formSoporte" placeholder="Opcional">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Motivo del cambio <span class="requerido">*</span></label>
            <input type="text" class="campo-input" [(ngModel)]="formMotivo" placeholder="Ej: el gobierno subió la tasa de interés bancario corriente">
          </div>
        </div>
        <div class="modal-pie">
          <button class="boton boton-secundario" (click)="cerrarEditar()" [disabled]="guardando">Cancelar</button>
          <button class="boton boton-primario" (click)="guardar()" [disabled]="guardando || !formMotivo.trim() || formValor === null">
            <span *ngIf="guardando" class="spinner-inline"></span>
            {{ guardando ? 'Guardando...' : 'Guardar nueva vigencia' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: historial -->
    <div *ngIf="historialDe" class="modal-overlay" (click)="historialDe = null">
      <div class="modal-form" (click)="$event.stopPropagation()" style="max-width: 560px;">
        <div class="modal-header">
          <h3 class="modal-titulo">Historial de {{ historialDe }}</h3>
          <button class="boton boton-icono" (click)="historialDe = null">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-cuerpo">
          <div *ngIf="cargandoHistorial" class="estado-carga"><div class="spinner"></div></div>
          <table *ngIf="!cargandoHistorial" class="tabla">
            <thead><tr><th>Valor</th><th>Vigencia</th><th>Motivo</th><th>Por</th></tr></thead>
            <tbody>
              <tr *ngFor="let h of historialFilas">
                <td>{{ h.valor }}{{ h.unidad || '' }}</td>
                <td class="celda-fecha">{{ h.vigenteDesde | date:'dd/MM/yy' }} - {{ h.vigenteHasta ? (h.vigenteHasta | date:'dd/MM/yy') : 'hoy' }}</td>
                <td style="font-size: var(--tamano-sm);">{{ h.motivo }}</td>
                <td style="font-size: var(--tamano-sm);">{{ h.modificadoPor ? (h.modificadoPor.nombre + ' ' + h.modificadoPor.apellido) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; margin: 0; }
    .pagina-subtitulo { color: var(--texto-terciario); font-size: var(--tamano-sm); margin: -12px 0 0; }

    .filtros-contenedor { display: flex; gap: var(--espacio-4); padding: var(--espacio-4); }
    .filtro-busqueda { flex: 1; min-width: 240px; position: relative; }
    .filtro-busqueda__icono { position: absolute; left: var(--espacio-3); top: 50%; transform: translateY(-50%); color: var(--texto-terciario); pointer-events: none; }
    .filtro-busqueda__input { padding-left: calc(var(--espacio-3) * 2 + 16px) !important; }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .spinner { width: 40px; height: 40px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }
    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); text-align: center; }

    .tabla-contenedor { padding: 0; overflow-x: auto; }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla thead th { padding: var(--espacio-3) var(--espacio-4); text-align: left; font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-secundario); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); border-bottom: 1px solid var(--borde-color); white-space: nowrap; }
    .tabla tbody td { padding: var(--espacio-3) var(--espacio-4); border-bottom: 1px solid var(--borde-color); font-size: var(--tamano-sm); vertical-align: middle; }
    .fila-tabla:last-child td { border-bottom: none; }
    .celda-codigo { font-family: monospace; font-weight: 600; }
    .celda-valor { font-weight: 600; }
    .unidad { font-weight: 400; color: var(--texto-terciario); font-size: var(--tamano-xs); }
    .celda-acciones { white-space: nowrap; display: flex; gap: var(--espacio-2); }
    .boton-sm { padding: 4px 10px; font-size: var(--tamano-xs); }
    .boton-texto { background: none; border: none; color: var(--color-primario); cursor: pointer; }

    .badge-estado { display: inline-flex; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.7rem; font-weight: 600; letter-spacing: 0.03em; }
    .badge-ley { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-excel { background: rgba(37,99,235,0.1); color: #1d4ed8; }
    .badge-anturi { background: rgba(234,88,12,0.12); color: #c2410c; }

    .tabla-pie { padding: var(--espacio-3) var(--espacio-4); border-top: 1px solid var(--borde-color); font-size: var(--tamano-sm); color: var(--texto-terciario); }
    .requerido { color: var(--color-error); }
    .alerta-error { padding: var(--espacio-3); background: rgba(239,68,68,0.08); border-radius: var(--radio-md); color: var(--color-error); font-size: var(--tamano-sm); }
    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }
  `],
})
export class ParametrosLegalesComponent implements OnInit {
  parametros: ParametroLegal[] = [];
  visibles: ParametroLegal[] = [];
  terminoBusqueda = '';
  cargando = false;
  error = '';

  editando: ParametroLegal | null = null;
  formValor: number | null = null;
  formFuente = 'LEY';
  formSoporte = '';
  formMotivo = '';
  errorModal = '';
  guardando = false;

  historialDe: string | null = null;
  historialFilas: ParametroLegal[] = [];
  cargandoHistorial = false;

  constructor(private servicio: ParametrosLegalesServicio) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.servicio.listarVigentes().pipe(
      catchError(() => { this.error = 'Error al cargar los parámetros. Verifique la conexión.'; return of([] as ParametroLegal[]); }),
    ).subscribe((lista) => {
      this.parametros = lista;
      this.aplicarFiltro();
      this.cargando = false;
    });
  }

  aplicarFiltro(): void {
    const t = this.terminoBusqueda.trim().toLowerCase();
    this.visibles = !t ? this.parametros : this.parametros.filter(
      (p) => p.codigo.toLowerCase().includes(t) || p.nombre.toLowerCase().includes(t),
    );
  }

  claseFuente(fuente: string): string {
    if (fuente === 'LEY') return 'badge-ley';
    if (fuente === 'EXCEL_HISTORICO') return 'badge-excel';
    return 'badge-anturi';
  }

  abrirEditar(p: ParametroLegal): void {
    this.editando = p;
    this.formValor = p.valor;
    this.formFuente = p.fuente;
    this.formSoporte = p.soporte || '';
    this.formMotivo = '';
    this.errorModal = '';
  }

  cerrarEditar(): void {
    this.editando = null;
  }

  guardar(): void {
    if (!this.editando || this.formValor === null || !this.formMotivo.trim()) return;
    this.guardando = true;
    this.errorModal = '';
    this.servicio.actualizar(this.editando.codigo, {
      valor: this.formValor,
      motivo: this.formMotivo.trim(),
      fuente: this.formFuente,
      soporte: this.formSoporte.trim() || undefined,
    }).pipe(
      catchError((err) => { this.errorModal = err?.error?.message || 'Error al guardar el cambio.'; return of(null); }),
      finalize(() => { this.guardando = false; }),
    ).subscribe((actualizado) => {
      if (actualizado) {
        this.editando = null;
        this.cargar();
      }
    });
  }

  abrirHistorial(p: ParametroLegal): void {
    this.historialDe = p.codigo;
    this.cargandoHistorial = true;
    this.servicio.historial(p.codigo).pipe(
      catchError(() => of([] as ParametroLegal[])),
    ).subscribe((lista) => {
      this.historialFilas = lista;
      this.cargandoHistorial = false;
    });
  }
}
