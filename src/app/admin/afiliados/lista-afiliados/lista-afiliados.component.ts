import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, switchMap, catchError, of } from 'rxjs';
import { AfiliadosServicio, Afiliado } from '../../../nucleo/servicios/afiliados.servicio';

@Component({
  selector: 'anturi-lista-afiliados',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="pagina-lista">
      <!-- Encabezado -->
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Afiliados</h2>
        <a routerLink="/admin/afiliados/nuevo" class="boton boton-primario">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Nuevo afiliado
        </a>
      </div>

      <!-- Filtros -->
      <div class="tarjeta filtros-contenedor">
        <div class="filtro-busqueda">
          <svg class="filtro-busqueda__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            class="campo-input filtro-busqueda__input"
            placeholder="Buscar por nombre, apellido o cédula..."
            [(ngModel)]="terminoBusqueda"
            (ngModelChange)="alCambiarBusqueda($event)"
          >
        </div>
        <div class="filtro-estado">
          <label class="campo-etiqueta">Estado</label>
          <select class="campo-input" [(ngModel)]="estadoSeleccionado" (change)="cargarAfiliados()">
            <option value="">Todos</option>
            <option value="ACTIVO">Activo</option>
            <option value="RETIRADO">Retirado</option>
            <option value="SUSPENDIDO">Suspendido</option>
          </select>
        </div>
      </div>

      <!-- Spinner de carga -->
      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando afiliados...</p>
      </div>

      <!-- Mensaje de error -->
      <div *ngIf="error && !cargando" class="tarjeta estado-vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40" style="color: var(--color-error);">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>{{ error }}</p>
        <button class="boton boton-secundario" (click)="cargarAfiliados()">Reintentar</button>
      </div>

      <!-- Estado vacío -->
      <div *ngIf="!cargando && !error && afiliados.length === 0" class="tarjeta estado-vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="color: var(--texto-terciario);">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <p style="color: var(--texto-terciario); font-size: var(--tamano-lg);">
          {{ terminoBusqueda ? 'No se encontraron afiliados con "' + terminoBusqueda + '"' : 'No hay afiliados registrados' }}
        </p>
        <a *ngIf="!terminoBusqueda" routerLink="/admin/afiliados/nuevo" class="boton boton-primario">Registrar primer afiliado</a>
      </div>

      <!-- Tabla -->
      <div *ngIf="!cargando && !error && afiliados.length > 0" class="tarjeta tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr>
              <th>Nombre completo</th>
              <th>Cédula</th>
              <th>Clase aportante</th>
              <th>EPS / ARL</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              *ngFor="let af of afiliados"
              class="fila-tabla"
              (click)="irADetalle(af.id)"
              [title]="'Ver detalle de ' + af.nombres + ' ' + af.apellidos"
            >
              <td>
                <div class="celda-nombre">
                  <div class="avatar-inicial">{{ (af.nombres || '?').charAt(0).toUpperCase() }}</div>
                  <div>
                    <div class="nombre-completo">{{ af.nombres }} {{ af.apellidos }}</div>
                    <div *ngIf="af.cargo" class="nombre-cargo">{{ af.cargo }}</div>
                  </div>
                </div>
              </td>
              <td class="celda-cedula">{{ af.cedula }}</td>
              <td>{{ af.claseAportante || '—' }}</td>
              <td>
                <div class="celda-seguros">
                  <span *ngIf="af.seguros && obtenerSeguro(af, 'EPS') as eps">EPS: {{ eps }}</span>
                  <span *ngIf="af.seguros && obtenerSeguro(af, 'ARL') as arl">ARL: {{ arl }}</span>
                  <span *ngIf="!af.seguros || (!obtenerSeguro(af, 'EPS') && !obtenerSeguro(af, 'ARL'))">—</span>
                </div>
              </td>
              <td>
                <span class="badge-estado" [ngClass]="claseBadge(af.estado)">
                  {{ af.estado }}
                </span>
              </td>
              <td class="celda-acciones" (click)="$event.stopPropagation()">
                <button
                  class="boton boton-icono"
                  title="Ver detalle"
                  (click)="irADetalle(af.id)"
                >
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
          <span class="tabla-pie__total">{{ afiliados.length }} afiliado{{ afiliados.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-3); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }

    .filtros-contenedor { display: flex; gap: var(--espacio-4); align-items: flex-end; padding: var(--espacio-4); flex-wrap: wrap; }
    .filtro-busqueda { flex: 1; min-width: 240px; position: relative; }
    .filtro-busqueda__icono { position: absolute; left: var(--espacio-3); top: 50%; transform: translateY(-50%); color: var(--texto-terciario); pointer-events: none; }
    .filtro-busqueda__input { padding-left: calc(var(--espacio-3) * 2 + 16px) !important; }
    .filtro-estado { display: flex; flex-direction: column; gap: var(--espacio-1); min-width: 160px; }

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
    .nombre-cargo { font-size: var(--tamano-sm); color: var(--texto-terciario); }
    .celda-cedula { font-family: monospace; letter-spacing: 0.03em; }
    .celda-seguros { display: flex; flex-direction: column; gap: 2px; font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .celda-acciones { white-space: nowrap; }

    .badge-estado { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-activo { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-retirado { background: rgba(249,115,22,0.12); color: #c2410c; }
    .badge-suspendido { background: rgba(239,68,68,0.12); color: #b91c1c; }

    .tabla-pie { padding: var(--espacio-3) var(--espacio-4); border-top: 1px solid var(--borde-color, #e5e7eb); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.02)); }
    .tabla-pie__total { font-size: var(--tamano-sm); color: var(--texto-terciario); }
  `]
})
export class ListaAfiliadosComponent implements OnInit, OnDestroy {
  afiliados: Afiliado[] = [];
  terminoBusqueda = '';
  estadoSeleccionado = '';
  cargando = false;
  error = '';

  private busqueda$ = new Subject<string>();
  private destruir$ = new Subject<void>();

  constructor(
    private afiliadosServicio: AfiliadosServicio,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Debounce para búsqueda en tiempo real
    this.busqueda$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(termino => {
        this.cargando = true;
        this.error = '';
        return this.afiliadosServicio.listar(termino || undefined, this.estadoSeleccionado || undefined).pipe(
          catchError(err => {
            this.error = 'Error al cargar afiliados. Verifique la conexión.';
            return of([]);
          })
        );
      }),
      takeUntil(this.destruir$)
    ).subscribe(lista => {
      this.afiliados = lista;
      this.cargando = false;
    });

    // Carga inicial
    this.cargarAfiliados();
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  alCambiarBusqueda(valor: string): void {
    this.busqueda$.next(valor);
  }

  cargarAfiliados(): void {
    this.cargando = true;
    this.error = '';
    this.afiliadosServicio.listar(
      this.terminoBusqueda || undefined,
      this.estadoSeleccionado || undefined
    ).pipe(
      catchError(err => {
        this.error = 'Error al cargar afiliados. Verifique la conexión.';
        return of([]);
      })
    ).subscribe(lista => {
      this.afiliados = lista;
      this.cargando = false;
    });
  }

  irADetalle(id: number): void {
    this.router.navigate(['/admin/afiliados', id]);
  }

  claseBadge(estado: string): string {
    const mapa: Record<string, string> = {
      ACTIVO: 'badge-activo',
      RETIRADO: 'badge-retirado',
      SUSPENDIDO: 'badge-suspendido',
    };
    return mapa[estado] ?? '';
  }

  obtenerSeguro(af: Afiliado, tipo: string): string {
    if (!af.seguros) return '';
    const seg = af.seguros.find((s: any) => s.tipo === tipo);
    return seg?.nombre || '';
  }
}
