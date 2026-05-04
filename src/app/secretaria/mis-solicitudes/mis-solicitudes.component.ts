import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { SolicitudesServicio, SolicitudCambio } from '../../nucleo/servicios/solicitudes.servicio';

@Component({
  selector: 'anturi-mis-solicitudes',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pagina-lista">
      <!-- Encabezado -->
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Mis solicitudes</h2>
        <button class="boton boton-secundario" (click)="cargar()" [disabled]="cargando">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Actualizar
        </button>
      </div>

      <!-- Resumen de estados -->
      <div class="resumen-estados" *ngIf="!cargando && solicitudes.length > 0">
        <div class="estado-chip estado-chip--pendiente">
          <span class="estado-chip__num">{{ contar('PENDIENTE') }}</span>
          <span>Pendiente{{ contar('PENDIENTE') !== 1 ? 's' : '' }}</span>
        </div>
        <div class="estado-chip estado-chip--aprobada">
          <span class="estado-chip__num">{{ contar('APROBADA') }}</span>
          <span>Aprobada{{ contar('APROBADA') !== 1 ? 's' : '' }}</span>
        </div>
        <div class="estado-chip estado-chip--rechazada">
          <span class="estado-chip__num">{{ contar('RECHAZADA') }}</span>
          <span>Rechazada{{ contar('RECHAZADA') !== 1 ? 's' : '' }}</span>
        </div>
      </div>

      <!-- Cargando -->
      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando sus solicitudes...</p>
      </div>

      <!-- Error -->
      <div *ngIf="errorCarga && !cargando" class="tarjeta estado-vacio">
        <p style="color: var(--color-error);">{{ errorCarga }}</p>
        <button class="boton boton-secundario" (click)="cargar()">Reintentar</button>
      </div>

      <!-- Lista vacía -->
      <div *ngIf="!cargando && !errorCarga && solicitudes.length === 0" class="tarjeta estado-vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="color: var(--texto-terciario);">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        <p style="color: var(--texto-terciario); font-size: var(--tamano-lg);">Aún no ha enviado solicitudes de cambio</p>
        <p style="color: var(--texto-terciario); font-size: var(--tamano-sm);">
          Al editar o eliminar un afiliado, se generará una solicitud automáticamente.
        </p>
      </div>

      <!-- Lista de solicitudes -->
      <div *ngIf="!cargando && !errorCarga && solicitudes.length > 0" class="solicitudes-lista">
        <div *ngFor="let sol of solicitudes" class="tarjeta solicitud-item">
          <div class="solicitud-header" (click)="toggleExpandir(sol.id)" style="cursor: pointer;">
            <div class="solicitud-izq">
              <span class="badge-tipo" [ngClass]="claseBadgeTipo(sol.tipo)">{{ sol.tipo }}</span>
              <div class="solicitud-info">
                <span class="solicitud-tabla">Tabla: <strong>{{ sol.tabla }}</strong></span>
                <span class="solicitud-motivo">{{ sol.motivo }}</span>
              </div>
            </div>
            <div class="solicitud-der">
              <span class="solicitud-fecha">{{ sol.creadoEn | date:'dd/MM/yyyy HH:mm' }}</span>
              <span class="badge-estado" [ngClass]="claseBadgeEstado(sol.estado)">{{ sol.estado }}</span>
              <svg
                class="icono-expandir"
                [class.expandido]="expandidos.has(sol.id)"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>

          <!-- Detalle expandido -->
          <div *ngIf="expandidos.has(sol.id)" class="solicitud-detalle">
            <div *ngIf="sol.estado !== 'PENDIENTE' && sol.comentarioAdmin" class="detalle-comentario" [ngClass]="sol.estado === 'APROBADA' ? 'detalle-comentario--aprobado' : 'detalle-comentario--rechazado'">
              <strong>Respuesta del administrador:</strong> {{ sol.comentarioAdmin }}
            </div>
            <div *ngIf="sol.estado === 'PENDIENTE'" class="detalle-aviso">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              Esta solicitud está pendiente de revisión por el administrador.
            </div>
            <div *ngIf="sol.revisadoPor && sol.revisadoEn" class="detalle-revision">
              Revisada por <strong>{{ sol.revisadoPor.nombre }} {{ sol.revisadoPor.apellido }}</strong>
              el {{ sol.revisadoEn | date:'dd/MM/yyyy HH:mm' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-3); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }

    .resumen-estados { display: flex; gap: var(--espacio-3); flex-wrap: wrap; }
    .estado-chip { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-2) var(--espacio-4); border-radius: var(--radio-xl); font-size: var(--tamano-sm); font-weight: 500; }
    .estado-chip__num { font-size: var(--tamano-xl); font-weight: 800; line-height: 1; }
    .estado-chip--pendiente { background: rgba(245,158,11,0.1); color: #b45309; }
    .estado-chip--aprobada { background: rgba(34,197,94,0.1); color: #15803d; }
    .estado-chip--rechazada { background: rgba(239,68,68,0.08); color: #b91c1c; }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); text-align: center; }
    .spinner { width: 36px; height: 36px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }

    .solicitudes-lista { display: flex; flex-direction: column; gap: var(--espacio-3); }
    .solicitud-item { padding: 0; overflow: hidden; }
    .solicitud-header { display: flex; align-items: center; justify-content: space-between; gap: var(--espacio-4); padding: var(--espacio-4) var(--espacio-5); flex-wrap: wrap; transition: var(--transicion-base); }
    .solicitud-header:hover { background: var(--fondo-tarjeta-hover, rgba(0,0,0,0.02)); }
    .solicitud-izq { display: flex; align-items: flex-start; gap: var(--espacio-3); flex: 1; min-width: 0; }
    .solicitud-der { display: flex; align-items: center; gap: var(--espacio-3); flex-shrink: 0; flex-wrap: wrap; }
    .solicitud-info { display: flex; flex-direction: column; gap: var(--espacio-1); min-width: 0; }
    .solicitud-tabla { font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .solicitud-motivo { font-size: var(--tamano-sm); color: var(--texto-principal); font-weight: 500; }
    .solicitud-fecha { font-size: 0.72rem; color: var(--texto-terciario); }
    .icono-expandir { transition: transform 0.2s; }
    .icono-expandir.expandido { transform: rotate(180deg); }

    /* Detalle */
    .solicitud-detalle { border-top: 1px solid var(--borde-color, #e5e7eb); padding: var(--espacio-4) var(--espacio-5); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.02)); display: flex; flex-direction: column; gap: var(--espacio-3); }
    .detalle-comentario { padding: var(--espacio-3); border-radius: var(--radio-sm); font-size: var(--tamano-sm); }
    .detalle-comentario--aprobado { background: rgba(34,197,94,0.08); color: #15803d; }
    .detalle-comentario--rechazado { background: rgba(239,68,68,0.08); color: #b91c1c; }
    .detalle-aviso { display: flex; align-items: center; gap: var(--espacio-2); font-size: var(--tamano-sm); color: #b45309; background: rgba(245,158,11,0.08); padding: var(--espacio-2) var(--espacio-3); border-radius: var(--radio-sm); }
    .detalle-revision { font-size: var(--tamano-sm); color: var(--texto-terciario); }

    /* Badges */
    .badge-tipo { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; flex-shrink: 0; }
    .badge-edicion { background: rgba(37,99,235,0.12); color: #1d4ed8; }
    .badge-eliminacion { background: rgba(239,68,68,0.12); color: #b91c1c; }
    .badge-creacion { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-estado { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-pendiente { background: rgba(245,158,11,0.12); color: #b45309; }
    .badge-aprobada { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-rechazada { background: rgba(239,68,68,0.12); color: #b91c1c; }
  `]
})
export class MisSolicitudesComponent implements OnInit, OnDestroy {
  solicitudes: SolicitudCambio[] = [];
  cargando = false;
  errorCarga = '';
  expandidos = new Set<number>();

  private destruir$ = new Subject<void>();

  constructor(private solicitudesServicio: SolicitudesServicio) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.errorCarga = '';
    this.solicitudesServicio.listar(undefined, true).pipe(
      catchError(() => {
        this.errorCarga = 'Error al cargar sus solicitudes. Verifique la conexión.';
        return of([]);
      }),
      takeUntil(this.destruir$)
    ).subscribe(lista => {
      this.solicitudes = lista.sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
      this.cargando = false;
    });
  }

  contar(estado: string): number {
    return this.solicitudes.filter(s => s.estado === estado).length;
  }

  toggleExpandir(id: number): void {
    if (this.expandidos.has(id)) {
      this.expandidos.delete(id);
    } else {
      this.expandidos.add(id);
    }
  }

  claseBadgeTipo(tipo: string): string {
    const mapa: Record<string, string> = {
      EDICION: 'badge-edicion',
      ELIMINACION: 'badge-eliminacion',
      CREACION: 'badge-creacion',
    };
    return mapa[tipo] ?? '';
  }

  claseBadgeEstado(estado: string): string {
    const mapa: Record<string, string> = {
      PENDIENTE: 'badge-pendiente',
      APROBADA: 'badge-aprobada',
      RECHAZADA: 'badge-rechazada',
    };
    return mapa[estado] ?? '';
  }
}
