import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import {
  HallazgosReconciliacionServicio,
  HallazgoReconciliacion,
  IDENTIFICACION_PENDIENTE,
} from '../../../nucleo/servicios/hallazgos-reconciliacion.servicio';

// Pantalla de triage de HallazgoReconciliacion (FASE 1-9, 2026-10-05/06) -
// primera pantalla real en el panel admin para esta tabla de staging, antes
// solo se operaba por script/SQL directo. Mismo patrón visual que
// ListaEmpresasComponent (chips + tabla + búsqueda).
@Component({
  selector: 'anturi-lista-hallazgos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pagina-lista">
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Reconciliación de empleadores</h2>
      </div>
      <p class="pagina-subtitulo">
        Hallazgos de Excel/carpetas documentales que todavía no son un Afiliado/Empresa real -
        tabla de staging, sin crear ninguna identidad nueva por sí sola.
      </p>

      <div class="estadisticas-chips">
        <button class="chip" [class.chip--activo]="filtro === ''" (click)="filtrar('')">
          <span class="chip__label">Todos</span>
          <span class="chip__count">{{ hallazgos.length }}</span>
        </button>
        <button class="chip chip--naranja" [class.chip--activo]="filtro === 'PENDIENTE_IDENTIFICACION'" (click)="filtrar('PENDIENTE_IDENTIFICACION')">
          <span class="chip__dot"></span>
          <span class="chip__label">Sin cédula (alerta)</span>
          <span class="chip__count">{{ contarPorEstado('PENDIENTE_IDENTIFICACION') }}</span>
        </button>
        <button class="chip" [class.chip--activo]="filtro === 'EMPLEADOR_NATURAL'" (click)="filtrar('EMPLEADOR_NATURAL')">
          <span class="chip__label">Empleadores</span>
          <span class="chip__count">{{ contarPorRol('EMPLEADOR_NATURAL') }}</span>
        </button>
        <button class="chip" [class.chip--activo]="filtro === 'EMPLEADO_DE_EMPLEADOR_NATURAL'" (click)="filtrar('EMPLEADO_DE_EMPLEADOR_NATURAL')">
          <span class="chip__label">Trabajadores</span>
          <span class="chip__count">{{ contarPorRol('EMPLEADO_DE_EMPLEADOR_NATURAL') }}</span>
        </button>
        <button class="chip" [class.chip--activo]="filtro === 'INDEPENDIENTE'" (click)="filtrar('INDEPENDIENTE')">
          <span class="chip__label">Independientes</span>
          <span class="chip__count">{{ contarPorRol('INDEPENDIENTE') }}</span>
        </button>
        <button class="chip" [class.chip--activo]="filtro === 'EMPRESA'" (click)="filtrar('EMPRESA')">
          <span class="chip__label">Empresas (NIT)</span>
          <span class="chip__count">{{ contarPorRol('EMPRESA') }}</span>
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
            placeholder="Buscar por nombre o identificación..."
            [(ngModel)]="terminoBusqueda"
            (ngModelChange)="aplicarFiltro()"
          >
        </div>
      </div>

      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando hallazgos...</p>
      </div>

      <div *ngIf="error && !cargando" class="tarjeta estado-vacio">
        <p>{{ error }}</p>
        <button class="boton boton-secundario" (click)="cargar()">Reintentar</button>
      </div>

      <div *ngIf="!cargando && !error && visibles.length === 0" class="tarjeta estado-vacio">
        <p style="color: var(--texto-terciario); font-size: var(--tamano-lg);">No hay hallazgos con este filtro.</p>
      </div>

      <div *ngIf="!cargando && !error && visibles.length > 0" class="tarjeta tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr>
              <th>Nombre encontrado</th>
              <th>Identificación</th>
              <th>Rol</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let h of visibles" class="fila-tabla" (click)="irADetalle(h.id)">
              <td>
                <div class="celda-nombre">
                  <div class="avatar-inicial">{{ (h.nombreEncontrado || '?').charAt(0).toUpperCase() }}</div>
                  <div class="nombre-completo">{{ h.nombreEncontrado }}</div>
                </div>
              </td>
              <td class="celda-cedula">
                <span *ngIf="h.numeroIdentificacion !== PENDIENTE">{{ h.tipoIdentificacion }} {{ h.numeroIdentificacion }}</span>
                <span *ngIf="h.numeroIdentificacion === PENDIENTE" class="badge-estado badge-alerta">SIN CÉDULA</span>
              </td>
              <td>{{ h.rolDetectado }}</td>
              <td>
                <span class="badge-estado" [ngClass]="claseEstado(h.estado)">{{ h.estado }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="tabla-pie">
          <span class="tabla-pie__total">{{ visibles.length }} hallazgo{{ visibles.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-3); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .pagina-subtitulo { color: var(--texto-terciario); font-size: var(--tamano-sm); margin: -12px 0 0; }

    .estadisticas-chips { display: flex; gap: var(--espacio-2); flex-wrap: wrap; }
    .chip { display: inline-flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-2) var(--espacio-3); border-radius: var(--radio-pill); border: 1.5px solid var(--borde-color); background: var(--fondo-tarjeta); cursor: pointer; font-size: var(--tamano-sm); color: var(--texto-secundario); transition: all var(--transicion-rapida); }
    .chip:hover { border-color: var(--color-primario); color: var(--color-primario); }
    .chip--activo { background: var(--color-primario); border-color: var(--color-primario); color: white; }
    .chip__label { font-weight: 500; }
    .chip__count { font-weight: 700; font-size: var(--tamano-xs); padding: 1px 6px; border-radius: 999px; background: rgba(0,0,0,0.12); }
    .chip--activo .chip__count { background: rgba(255,255,255,0.25); }
    .chip__dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
    .chip--naranja { color: #c2410c; border-color: rgba(234,88,12,0.3); }
    .chip--naranja:hover, .chip--naranja.chip--activo { background: #c2410c; border-color: #c2410c; color: white; }

    .filtros-contenedor { display: flex; gap: var(--espacio-4); align-items: flex-end; padding: var(--espacio-4); flex-wrap: wrap; }
    .filtro-busqueda { flex: 1; min-width: 240px; position: relative; }
    .filtro-busqueda__icono { position: absolute; left: var(--espacio-3); top: 50%; transform: translateY(-50%); color: var(--texto-terciario); pointer-events: none; }
    .filtro-busqueda__input { padding-left: calc(var(--espacio-3) * 2 + 16px) !important; }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .spinner { width: 40px; height: 40px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }
    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); text-align: center; }

    .tabla-contenedor { padding: 0; overflow: hidden; overflow-x: auto; }
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

    .badge-estado { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-alerta { background: rgba(234,88,12,0.14); color: #c2410c; }
    .badge-revisado { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-descartado { background: rgba(107,114,128,0.14); color: #4b5563; }
    .badge-pendiente { background: rgba(37,99,235,0.1); color: #1d4ed8; }

    .tabla-pie { padding: var(--espacio-3) var(--espacio-4); border-top: 1px solid var(--borde-color, #e5e7eb); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.02)); display: flex; align-items: center; justify-content: space-between; gap: var(--espacio-4); flex-wrap: wrap; }
    .tabla-pie__total { font-size: var(--tamano-sm); color: var(--texto-terciario); }
  `],
})
export class ListaHallazgosComponent implements OnInit {
  readonly PENDIENTE = IDENTIFICACION_PENDIENTE;

  hallazgos: HallazgoReconciliacion[] = [];
  visibles: HallazgoReconciliacion[] = [];
  terminoBusqueda = '';
  filtro = '';
  cargando = false;
  error = '';

  constructor(
    private servicio: HallazgosReconciliacionServicio,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.servicio.listar().pipe(
      catchError(() => {
        this.error = 'Error al cargar los hallazgos. Verifique la conexión.';
        return of([] as HallazgoReconciliacion[]);
      }),
    ).subscribe((lista) => {
      this.hallazgos = lista;
      this.aplicarFiltro();
      this.cargando = false;
    });
  }

  filtrar(valor: string): void {
    this.filtro = valor;
    this.aplicarFiltro();
  }

  aplicarFiltro(): void {
    let lista = this.hallazgos;
    if (this.filtro === 'PENDIENTE_IDENTIFICACION') {
      lista = lista.filter((h) => h.estado === 'PENDIENTE_IDENTIFICACION');
    } else if (this.filtro) {
      lista = lista.filter((h) => h.rolDetectado === this.filtro);
    }
    const termino = this.terminoBusqueda.trim().toLowerCase();
    if (termino) {
      lista = lista.filter(
        (h) =>
          h.nombreEncontrado?.toLowerCase().includes(termino) ||
          h.numeroIdentificacion?.toLowerCase().includes(termino),
      );
    }
    this.visibles = lista;
  }

  contarPorEstado(estado: string): number {
    return this.hallazgos.filter((h) => h.estado === estado).length;
  }

  contarPorRol(rol: string): number {
    return this.hallazgos.filter((h) => h.rolDetectado === rol).length;
  }

  claseEstado(estado: string): string {
    if (estado === 'PENDIENTE_IDENTIFICACION') return 'badge-alerta';
    if (estado === 'REVISADO') return 'badge-revisado';
    if (estado === 'DESCARTADO') return 'badge-descartado';
    return 'badge-pendiente';
  }

  protected get prefijo(): string {
    return this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
  }

  irADetalle(id: number): void {
    this.router.navigate([this.prefijo, 'hallazgos-reconciliacion', id]);
  }
}
