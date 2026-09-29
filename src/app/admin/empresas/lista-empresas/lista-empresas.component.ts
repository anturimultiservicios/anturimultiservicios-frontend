import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, switchMap, catchError, of } from 'rxjs';
import { EmpresasServicio, Empresa } from '../../../nucleo/servicios/empresas.servicio';

@Component({
  selector: 'anturi-lista-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="pagina-lista">
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Empresas</h2>
      </div>

      <div class="estadisticas-chips">
        <button class="chip" [class.chip--activo]="filtroEstado === ''" (click)="filtrarPorEstado('')">
          <span class="chip__label">Todas</span>
          <span class="chip__count">{{ stats.total }}</span>
        </button>
        <button class="chip chip--verde" [class.chip--activo]="filtroEstado === 'activas'" (click)="filtrarPorEstado('activas')">
          <span class="chip__dot"></span>
          <span class="chip__label">Activas</span>
          <span class="chip__count">{{ stats.activas }}</span>
        </button>
        <button class="chip chip--rojo" [class.chip--activo]="filtroEstado === 'inactivas'" (click)="filtrarPorEstado('inactivas')">
          <span class="chip__dot"></span>
          <span class="chip__label">Inactivas</span>
          <span class="chip__count">{{ stats.inactivas }}</span>
        </button>
      </div>

      <div class="tarjeta filtros-contenedor">
        <div class="filtro-busqueda">
          <svg class="filtro-busqueda__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            class="campo-input filtro-busqueda__input"
            placeholder="Buscar por nombre o NIT..."
            [(ngModel)]="terminoBusqueda"
            (ngModelChange)="alCambiarBusqueda($event)"
          >
        </div>
      </div>

      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando empresas...</p>
      </div>

      <div *ngIf="error && !cargando" class="tarjeta estado-vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40" style="color: var(--color-error);">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>{{ error }}</p>
        <button class="boton boton-secundario" (click)="cargarEmpresas()">Reintentar</button>
      </div>

      <div *ngIf="!cargando && !error && empresasVisibles.length === 0" class="tarjeta estado-vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="color: var(--texto-terciario);">
          <rect x="2" y="7" width="20" height="14" rx="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
        <p style="color: var(--texto-terciario); font-size: var(--tamano-lg);">
          {{ terminoBusqueda ? 'No se encontraron empresas con "' + terminoBusqueda + '"' : 'No hay empresas registradas' }}
        </p>
      </div>

      <div *ngIf="!cargando && !error && empresasVisibles.length > 0" class="tarjeta tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr>
              <th>Razón social</th>
              <th>NIT</th>
              <th>Municipio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              *ngFor="let emp of empresasVisibles"
              class="fila-tabla"
              (click)="irADetalle(emp.id)"
              [title]="'Ver detalle de ' + emp.razonSocial"
            >
              <td>
                <div class="celda-nombre">
                  <div class="avatar-inicial">{{ (emp.razonSocial || '?').charAt(0).toUpperCase() }}</div>
                  <div class="nombre-completo">{{ emp.razonSocial }}</div>
                </div>
              </td>
              <td class="celda-cedula">{{ emp.nit }}</td>
              <td>{{ emp.municipio || emp.ciudad || '—' }}</td>
              <td>
                <span class="badge-estado" [ngClass]="emp.activa ? 'badge-activo' : 'badge-inactivo'">
                  {{ emp.activa ? 'ACTIVA' : 'INACTIVA' }}
                </span>
              </td>
              <td class="celda-acciones" (click)="$event.stopPropagation()">
                <button class="boton boton-icono" title="Ver detalle" (click)="irADetalle(emp.id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="tabla-pie">
          <span class="tabla-pie__total">
            {{ empresasVisibles.length }} empresa{{ empresasVisibles.length !== 1 ? 's' : '' }}
            <span *ngIf="filtroEstado" class="tabla-pie__filtro">({{ filtroEstado }})</span>
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-3); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }

    .estadisticas-chips { display: flex; gap: var(--espacio-2); flex-wrap: wrap; }
    .chip { display: inline-flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-2) var(--espacio-3); border-radius: var(--radio-pill); border: 1.5px solid var(--borde-color); background: var(--fondo-tarjeta); cursor: pointer; font-size: var(--tamano-sm); color: var(--texto-secundario); transition: all var(--transicion-rapida); }
    .chip:hover { border-color: var(--color-primario); color: var(--color-primario); }
    .chip--activo { background: var(--color-primario); border-color: var(--color-primario); color: white; }
    .chip__label { font-weight: 500; }
    .chip__count { font-weight: 700; font-size: var(--tamano-xs); padding: 1px 6px; border-radius: 999px; background: rgba(0,0,0,0.12); }
    .chip--activo .chip__count { background: rgba(255,255,255,0.25); }
    .chip__dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
    .chip--verde { color: #15803d; border-color: rgba(34,197,94,0.3); }
    .chip--verde:hover, .chip--verde.chip--activo { background: #15803d; border-color: #15803d; color: white; }
    .chip--rojo { color: #b91c1c; border-color: rgba(239,68,68,0.3); }
    .chip--rojo:hover, .chip--rojo.chip--activo { background: #b91c1c; border-color: #b91c1c; color: white; }

    .filtros-contenedor { display: flex; gap: var(--espacio-4); align-items: flex-end; padding: var(--espacio-4); flex-wrap: wrap; }
    .filtro-busqueda { flex: 1; min-width: 240px; position: relative; }
    .filtro-busqueda__icono { position: absolute; left: var(--espacio-3); top: 50%; transform: translateY(-50%); color: var(--texto-terciario); pointer-events: none; }
    .filtro-busqueda__input { padding-left: calc(var(--espacio-3) * 2 + 16px) !important; }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .spinner { width: 40px; height: 40px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }

    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); text-align: center; }

    .tabla-contenedor { padding: 0; overflow: hidden; }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla thead th { padding: var(--espacio-3) var(--espacio-4); text-align: left; font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-secundario); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); border-bottom: 1px solid var(--borde-color, #e5e7eb); white-space: nowrap; }
    .tabla tbody td { padding: var(--espacio-3) var(--espacio-4); border-bottom: 1px solid var(--borde-color, #e5e7eb); font-size: var(--tamano-sm); color: var(--texto-principal); vertical-align: middle; }
    .fila-tabla { cursor: pointer; transition: background var(--transicion-base); }
    .fila-tabla:hover { background: var(--fondo-tarjeta-hover, rgba(0,0,0,0.02)); }
    .fila-tabla:last-child td { border-bottom: none; }

    .celda-nombre { display: flex; align-items: center; gap: var(--espacio-3); }
    .avatar-inicial { width: 36px; height: 36px; border-radius: 50%; background: rgba(27,50,112,0.12); color: var(--color-primario); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: var(--tamano-sm); flex-shrink: 0; }
    .nombre-completo { font-weight: 600; color: var(--texto-principal); }
    .celda-cedula { font-family: monospace; letter-spacing: 0.03em; }
    .celda-acciones { white-space: nowrap; }

    .badge-estado { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-activo { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-inactivo { background: rgba(239,68,68,0.12); color: #b91c1c; }

    .tabla-pie { padding: var(--espacio-3) var(--espacio-4); border-top: 1px solid var(--borde-color, #e5e7eb); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.02)); display: flex; align-items: center; justify-content: space-between; gap: var(--espacio-4); flex-wrap: wrap; }
    .tabla-pie__total { font-size: var(--tamano-sm); color: var(--texto-terciario); }
    .tabla-pie__filtro { font-weight: 600; color: var(--color-primario); text-transform: capitalize; }
  `]
})
export class ListaEmpresasComponent implements OnInit, OnDestroy {
  empresas: Empresa[] = [];
  empresasVisibles: Empresa[] = [];
  terminoBusqueda = '';
  filtroEstado: '' | 'activas' | 'inactivas' = '';
  cargando = false;
  error = '';

  stats = { total: 0, activas: 0, inactivas: 0 };

  private busqueda$ = new Subject<string>();
  private destruir$ = new Subject<void>();

  constructor(
    private empresasServicio: EmpresasServicio,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.empresasServicio.estadisticas().pipe(
      catchError(() => of({ total: 0, activas: 0, inactivas: 0 }))
    ).subscribe(s => { this.stats = s; });

    this.busqueda$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(termino => this.buscar(termino)),
      takeUntil(this.destruir$)
    ).subscribe();

    this.cargarEmpresas();
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  private buscar(termino: string) {
    this.cargando = true;
    this.error = '';
    // soloActivas=false: el buscador debe encontrar tambien inactivas, el
    // filtro de chips (Activas/Inactivas) se aplica despues en memoria.
    return this.empresasServicio.listar(termino || undefined, false).pipe(
      catchError(() => {
        this.error = 'Error al cargar empresas. Verifique la conexión.';
        return of([] as Empresa[]);
      })
    ).pipe(
      switchMap(lista => {
        this.empresas = lista;
        this.aplicarFiltroEstado();
        this.cargando = false;
        return of(lista);
      })
    );
  }

  alCambiarBusqueda(valor: string): void {
    this.busqueda$.next(valor);
  }

  cargarEmpresas(): void {
    this.buscar(this.terminoBusqueda).subscribe();
  }

  filtrarPorEstado(estado: '' | 'activas' | 'inactivas'): void {
    this.filtroEstado = estado;
    this.aplicarFiltroEstado();
  }

  private aplicarFiltroEstado(): void {
    if (this.filtroEstado === 'activas') {
      this.empresasVisibles = this.empresas.filter(e => e.activa);
    } else if (this.filtroEstado === 'inactivas') {
      this.empresasVisibles = this.empresas.filter(e => !e.activa);
    } else {
      this.empresasVisibles = this.empresas;
    }
  }

  irADetalle(id: number): void {
    this.router.navigate(['/admin', 'empresas', id]);
  }
}
