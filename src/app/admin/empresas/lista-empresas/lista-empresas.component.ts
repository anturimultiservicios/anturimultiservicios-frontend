import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, catchError, of, debounceTime, distinctUntilChanged } from 'rxjs';
import { EmpresasServicio, Empresa } from '../../../nucleo/servicios/empresas.servicio';

@Component({
  selector: 'anturi-lista-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="pagina-lista">

      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Empresas</h2>
        <div class="encabezado-acciones">
          <div class="estadisticas-chips" *ngIf="stats">
            <span class="chip chip-verde">{{ stats.activas }} activas</span>
            <span class="chip chip-gris">{{ stats.inactivas }} inactivas</span>
          </div>
          <button class="boton boton-primario" (click)="mostrarModalCrear = true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nueva empresa
          </button>
        </div>
      </div>

      <!-- Filtros -->
      <div class="tarjeta pagina-filtros">
        <div class="filtros-fila">
          <div class="buscador-wrap">
            <svg class="buscador-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              class="campo-input buscador-input"
              placeholder="Buscar por nombre, NIT o municipio..."
              [(ngModel)]="busqueda"
              (ngModelChange)="onBusquedaCambia()"
            >
          </div>
          <div class="filtro-estado">
            <label class="campo-etiqueta">Estado</label>
            <select class="campo-input" [(ngModel)]="filtroActiva" (change)="cargarEmpresas()">
              <option value="todas">Todas</option>
              <option value="activas">Solo activas</option>
              <option value="inactivas">Solo inactivas</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Cargando -->
      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando empresas...</p>
      </div>

      <!-- Error -->
      <div *ngIf="errorCarga && !cargando" class="tarjeta estado-vacio">
        <p style="color: var(--color-error);">{{ errorCarga }}</p>
        <button class="boton boton-secundario" (click)="cargarEmpresas()">Reintentar</button>
      </div>

      <!-- Tabla -->
      <div *ngIf="!cargando && !errorCarga" class="tarjeta pagina-tabla-contenedor">
        <div *ngIf="empresasFiltradas.length === 0" class="estado-vacio">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40" style="color: var(--texto-terciario);">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
          </svg>
          <p>No se encontraron empresas{{ busqueda ? ' con ese criterio de búsqueda' : '' }}.</p>
        </div>

        <table *ngIf="empresasFiltradas.length > 0" class="tabla">
          <thead>
            <tr>
              <th>Razón social</th>
              <th>NIT</th>
              <th>Municipio</th>
              <th>Clase</th>
              <th style="text-align:right">Total pago</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let e of empresasPagina">
              <td>
                <span class="empresa-nombre">{{ e.razonSocial }}</span>
                <span *ngIf="e.correo" class="empresa-correo">{{ e.correo }}</span>
              </td>
              <td><code class="codigo-nit">{{ e.nit }}</code></td>
              <td>{{ e.municipio || '—' }}</td>
              <td>
                <span class="texto-clase">{{ e.claseAportante | slice:0:30 }}{{ (e.claseAportante?.length || 0) > 30 ? '…' : '' }}</span>
              </td>
              <td style="text-align:right; font-weight:600; color: var(--color-primario);">
                {{ e.totalPago != null ? ('$' + (e.totalPago | number)) : '—' }}
              </td>
              <td>
                <span class="badge-estado" [class.badge-activo]="e.activa" [class.badge-inactivo]="!e.activa">
                  {{ e.activa ? 'Activa' : 'Inactiva' }}
                </span>
              </td>
              <td class="col-acciones">
                <a [routerLink]="['/admin/empresas', e.id]" class="boton boton-icono" title="Ver detalle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </a>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Paginación -->
        <div *ngIf="totalPaginas > 1" class="paginacion">
          <button class="boton boton-icono" (click)="irPagina(paginaActual - 1)" [disabled]="paginaActual === 1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <span class="paginacion-info">{{ paginaActual }} / {{ totalPaginas }}</span>
          <button class="boton boton-icono" (click)="irPagina(paginaActual + 1)" [disabled]="paginaActual === totalPaginas">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
          <span class="paginacion-total">{{ empresasFiltradas.length }} registros</span>
        </div>
      </div>

      <!-- MODAL: Nueva empresa -->
      <div *ngIf="mostrarModalCrear" class="modal-overlay" (click)="cerrarModalCrear()">
        <div class="modal-form" (click)="$event.stopPropagation()">
          <div class="modal-form__header">
            <h3 class="modal-form__titulo">Nueva empresa</h3>
            <button class="boton boton-icono" (click)="cerrarModalCrear()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div *ngIf="errorCrear" class="alerta-error">{{ errorCrear }}</div>
          <div class="modal-form__cuerpo">
            <div class="campos-grid">
              <div class="campo-grupo campo-grupo--ancho">
                <label class="campo-etiqueta">Razón social <span class="requerido">*</span></label>
                <input type="text" class="campo-input" [(ngModel)]="formCrear.razonSocial" placeholder="Nombre de la empresa">
              </div>
              <div class="campo-grupo">
                <label class="campo-etiqueta">NIT <span class="requerido">*</span></label>
                <input type="text" class="campo-input" [(ngModel)]="formCrear.nit" placeholder="900123456">
              </div>
              <div class="campo-grupo">
                <label class="campo-etiqueta">Correo</label>
                <input type="email" class="campo-input" [(ngModel)]="formCrear.correo" placeholder="empresa@email.com">
              </div>
              <div class="campo-grupo">
                <label class="campo-etiqueta">Teléfono</label>
                <input type="tel" class="campo-input" [(ngModel)]="formCrear.telefono">
              </div>
              <div class="campo-grupo">
                <label class="campo-etiqueta">Municipio</label>
                <input type="text" class="campo-input" [(ngModel)]="formCrear.municipio">
              </div>
              <div class="campo-grupo">
                <label class="campo-etiqueta">Clase aportante</label>
                <input type="text" class="campo-input" [(ngModel)]="formCrear.claseAportante">
              </div>
              <div class="campo-grupo">
                <label class="campo-etiqueta">Asopagos</label>
                <input type="text" class="campo-input" [(ngModel)]="formCrear.asopagos">
              </div>
              <div class="campo-grupo">
                <label class="campo-etiqueta">Clave</label>
                <input type="text" class="campo-input" [(ngModel)]="formCrear.clave">
              </div>
            </div>
          </div>
          <div class="modal-form__pie">
            <button class="boton boton-secundario" (click)="cerrarModalCrear()" [disabled]="creando">Cancelar</button>
            <button class="boton boton-primario" (click)="crearEmpresa()" [disabled]="creando">
              <span *ngIf="creando" class="spinner-inline"></span>
              {{ creando ? 'Creando...' : 'Crear empresa' }}
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-3); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .encabezado-acciones { display: flex; align-items: center; gap: var(--espacio-3); flex-wrap: wrap; }
    .estadisticas-chips { display: flex; gap: var(--espacio-2); }
    .chip { display: inline-flex; align-items: center; padding: 3px var(--espacio-2); border-radius: var(--radio-full,9999px); font-size: 0.72rem; font-weight: 600; }
    .chip-verde { background: rgba(34,197,94,0.12); color: #15803d; }
    .chip-gris { background: rgba(0,0,0,0.07); color: var(--texto-secundario); }

    .pagina-filtros { padding: var(--espacio-4); }
    .filtros-fila { display: flex; gap: var(--espacio-3); flex-wrap: wrap; align-items: flex-end; }
    .buscador-wrap { position: relative; flex: 1; min-width: 220px; }
    .buscador-icono { position: absolute; left: var(--espacio-3); top: 50%; transform: translateY(-50%); color: var(--texto-terciario); pointer-events: none; }
    .buscador-input { padding-left: 2.2rem !important; }
    .filtro-estado { display: flex; flex-direction: column; gap: var(--espacio-1); min-width: 140px; }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-3); padding: var(--espacio-10); text-align: center; color: var(--texto-terciario); }
    .spinner { width: 36px; height: 36px; border: 3px solid var(--borde-color,#e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }

    .pagina-tabla-contenedor { padding: 0; overflow-x: auto; }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla th { padding: var(--espacio-3) var(--espacio-4); text-align: left; font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-terciario); background: var(--fondo-tabla-cabecera,rgba(0,0,0,0.03)); border-bottom: 1px solid var(--borde-color,#e5e7eb); white-space: nowrap; }
    .tabla td { padding: var(--espacio-3) var(--espacio-4); border-bottom: 1px solid var(--borde-color,#e5e7eb); font-size: var(--tamano-sm); vertical-align: middle; }
    .tabla tr:last-child td { border-bottom: none; }
    .tabla tr:hover td { background: var(--fondo-tabla-hover,rgba(0,0,0,0.02)); }
    .empresa-nombre { display: block; font-weight: 600; color: var(--texto-principal); }
    .empresa-correo { display: block; font-size: 0.72rem; color: var(--texto-terciario); margin-top: 2px; }
    .codigo-nit { background: var(--fondo-tabla-cabecera,rgba(0,0,0,0.05)); padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-family: monospace; }
    .texto-clase { font-size: 0.72rem; color: var(--texto-secundario); }
    .col-acciones { width: 50px; text-align: center; }

    .badge-estado { display: inline-flex; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; text-transform: uppercase; }
    .badge-activo { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-inactivo { background: rgba(0,0,0,0.07); color: var(--texto-terciario); }

    .paginacion { display: flex; align-items: center; justify-content: center; gap: var(--espacio-2); padding: var(--espacio-4); border-top: 1px solid var(--borde-color,#e5e7eb); }
    .paginacion-info { font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-principal); min-width: 70px; text-align: center; }
    .paginacion-total { font-size: var(--tamano-sm); color: var(--texto-terciario); margin-left: var(--espacio-2); }

    .alerta-error { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radio-md); color: var(--color-error); font-size: var(--tamano-sm); margin-bottom: var(--espacio-3); }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: var(--espacio-4); }
    .modal-form { background: var(--fondo-tarjeta,#fff); border-radius: var(--radio-xl); width: 100%; max-width: 560px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--sombra-md); }
    .modal-form__header { display: flex; align-items: center; justify-content: space-between; padding: var(--espacio-4) var(--espacio-5); border-bottom: 1px solid var(--borde-color,#e5e7eb); }
    .modal-form__titulo { font-size: var(--tamano-lg); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .modal-form__cuerpo { padding: var(--espacio-5); overflow-y: auto; flex: 1; }
    .modal-form__pie { display: flex; justify-content: flex-end; gap: var(--espacio-3); padding: var(--espacio-4) var(--espacio-5); border-top: 1px solid var(--borde-color,#e5e7eb); }
    .campos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .campo-grupo--ancho { grid-column: 1 / -1; }
    .requerido { color: var(--color-error); }
    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }
  `]
})
export class ListaEmpresasComponent implements OnInit, OnDestroy {
  empresas: Empresa[] = [];
  empresasFiltradas: Empresa[] = [];
  cargando = false;
  errorCarga = '';
  busqueda = '';
  filtroActiva = 'todas';

  paginaActual = 1;
  readonly porPagina = 25;

  stats: { activas: number; inactivas: number; total: number } | null = null;

  mostrarModalCrear = false;
  creando = false;
  errorCrear = '';
  formCrear: Partial<Empresa> = {};

  private destruir$ = new Subject<void>();
  private busqueda$ = new Subject<string>();

  constructor(private empresasServicio: EmpresasServicio) {}

  ngOnInit(): void {
    this.cargarEmpresas();
    this.cargarStats();
    this.busqueda$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destruir$)
    ).subscribe(() => this.aplicarFiltros());
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  cargarEmpresas(): void {
    this.cargando = true;
    this.errorCarga = '';
    this.empresasServicio.listar(undefined, false).pipe(
      catchError(() => { this.errorCarga = 'No se pudo cargar la lista de empresas.'; return of([]); }),
      takeUntil(this.destruir$)
    ).subscribe(data => {
      this.empresas = data;
      this.cargando = false;
      this.aplicarFiltros();
    });
  }

  cargarStats(): void {
    this.empresasServicio.estadisticas().pipe(
      catchError(() => of(null)),
      takeUntil(this.destruir$)
    ).subscribe(s => { this.stats = s; });
  }

  onBusquedaCambia(): void {
    this.busqueda$.next(this.busqueda);
  }

  aplicarFiltros(): void {
    let lista = [...this.empresas];
    const b = this.busqueda.toLowerCase().trim();
    if (b) {
      lista = lista.filter(e =>
        e.razonSocial.toLowerCase().includes(b) ||
        e.nit.includes(b) ||
        (e.municipio || '').toLowerCase().includes(b) ||
        (e.correo || '').toLowerCase().includes(b)
      );
    }
    if (this.filtroActiva === 'activas') lista = lista.filter(e => e.activa);
    if (this.filtroActiva === 'inactivas') lista = lista.filter(e => !e.activa);
    this.empresasFiltradas = lista;
    this.paginaActual = 1;
  }

  get totalPaginas(): number {
    return Math.ceil(this.empresasFiltradas.length / this.porPagina);
  }

  get empresasPagina(): Empresa[] {
    const inicio = (this.paginaActual - 1) * this.porPagina;
    return this.empresasFiltradas.slice(inicio, inicio + this.porPagina);
  }

  irPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas) this.paginaActual = p;
  }

  crearEmpresa(): void {
    if (!this.formCrear.razonSocial?.trim() || !this.formCrear.nit?.trim()) {
      this.errorCrear = 'Razón social y NIT son obligatorios.';
      return;
    }
    this.creando = true;
    this.errorCrear = '';
    this.empresasServicio.crear(this.formCrear).pipe(
      catchError((err: any) => { this.errorCrear = err?.error?.mensaje || 'Error al crear la empresa.'; return of(null); }),
      takeUntil(this.destruir$)
    ).subscribe(e => {
      this.creando = false;
      if (e) { this.cerrarModalCrear(); this.cargarEmpresas(); this.cargarStats(); }
    });
  }

  cerrarModalCrear(): void {
    this.mostrarModalCrear = false;
    this.formCrear = {};
    this.errorCrear = '';
  }
}
