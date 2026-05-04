import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, finalize } from 'rxjs';
import { SolicitudesServicio, SolicitudCambio } from '../../nucleo/servicios/solicitudes.servicio';

type TabActiva = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

@Component({
  selector: 'anturi-solicitudes-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pagina-solicitudes">
      <!-- Encabezado -->
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Solicitudes de cambio</h2>
        <button class="boton boton-secundario" (click)="cargarSolicitudes()" [disabled]="cargando">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Actualizar
        </button>
      </div>

      <!-- Alertas -->
      <div *ngIf="mensajeExito" class="alerta-exito">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>
        {{ mensajeExito }}
      </div>
      <div *ngIf="mensajeError" class="alerta-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        {{ mensajeError }}
      </div>

      <!-- Tabs -->
      <div class="tabs-contenedor">
        <button
          class="tab-boton"
          [class.tab-activo]="tabActiva === 'PENDIENTE'"
          (click)="cambiarTab('PENDIENTE')"
        >
          Pendientes
          <span *ngIf="contarPorEstado('PENDIENTE') > 0" class="tab-badge">{{ contarPorEstado('PENDIENTE') }}</span>
        </button>
        <button
          class="tab-boton"
          [class.tab-activo]="tabActiva === 'APROBADA'"
          (click)="cambiarTab('APROBADA')"
        >
          Aprobadas
          <span *ngIf="contarPorEstado('APROBADA') > 0" class="tab-badge tab-badge--aprobado">{{ contarPorEstado('APROBADA') }}</span>
        </button>
        <button
          class="tab-boton"
          [class.tab-activo]="tabActiva === 'RECHAZADA'"
          (click)="cambiarTab('RECHAZADA')"
        >
          Rechazadas
          <span *ngIf="contarPorEstado('RECHAZADA') > 0" class="tab-badge tab-badge--rechazado">{{ contarPorEstado('RECHAZADA') }}</span>
        </button>
      </div>

      <!-- Cargando -->
      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando solicitudes...</p>
      </div>

      <!-- Error -->
      <div *ngIf="errorCarga && !cargando" class="tarjeta estado-vacio">
        <p style="color: var(--color-error);">{{ errorCarga }}</p>
        <button class="boton boton-secundario" (click)="cargarSolicitudes()">Reintentar</button>
      </div>

      <!-- Lista vacía -->
      <div *ngIf="!cargando && !errorCarga && solicitudesFiltradas().length === 0" class="tarjeta estado-vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="color: var(--texto-terciario);">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        <p style="color: var(--texto-terciario); font-size: var(--tamano-lg);">
          No hay solicitudes {{ textoTab(tabActiva).toLowerCase() }}
        </p>
      </div>

      <!-- Lista de solicitudes -->
      <div *ngIf="!cargando && !errorCarga && solicitudesFiltradas().length > 0" class="solicitudes-lista">
        <div *ngFor="let sol of solicitudesFiltradas()" class="tarjeta solicitud-item">
          <!-- Cabecera de la solicitud -->
          <div class="solicitud-header" (click)="toggleExpandir(sol.id)">
            <div class="solicitud-header__izq">
              <span class="badge-tipo" [ngClass]="claseBadgeTipo(sol.tipo)">{{ sol.tipo }}</span>
              <div class="solicitud-info">
                <span class="solicitud-tabla">Tabla: <strong>{{ sol.tabla }}</strong></span>
                <span class="solicitud-motivo">{{ sol.motivo }}</span>
              </div>
            </div>
            <div class="solicitud-header__der">
              <div class="solicitud-meta">
                <span class="solicitud-autor">{{ sol.creadoPor.nombre }} {{ sol.creadoPor.apellido }}</span>
                <span class="solicitud-fecha">{{ sol.creadoEn | date:'dd/MM/yyyy HH:mm' }}</span>
              </div>
              <div class="solicitud-acciones" *ngIf="sol.estado === 'PENDIENTE'" (click)="$event.stopPropagation()">
                <button class="boton boton-sm boton-exito" (click)="abrirModalAprobar(sol)" title="Aprobar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Aprobar
                </button>
                <button class="boton boton-sm boton-peligro" (click)="abrirModalRechazar(sol)" title="Rechazar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  Rechazar
                </button>
              </div>
              <span *ngIf="sol.estado !== 'PENDIENTE'" class="badge-estado" [ngClass]="claseBadgeEstado(sol.estado)">
                {{ sol.estado }}
              </span>
              <svg
                class="icono-expandir"
                [class.expandido]="expandidos.has(sol.id)"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>

          <!-- Contenido expandido -->
          <div *ngIf="expandidos.has(sol.id)" class="solicitud-detalle">
            <!-- Comentario del admin -->
            <div *ngIf="sol.comentarioAdmin" class="detalle-comentario">
              <strong>Comentario del administrador:</strong> {{ sol.comentarioAdmin }}
            </div>
            <div *ngIf="sol.revisadoPor" class="detalle-meta-revision">
              Revisado por <strong>{{ sol.revisadoPor.nombre }} {{ sol.revisadoPor.apellido }}</strong>
              el {{ sol.revisadoEn | date:'dd/MM/yyyy HH:mm' }}
            </div>

            <!-- Datos originales y nuevos -->
            <div class="detalle-datos-grid">
              <div *ngIf="sol.datosOriginales" class="detalle-bloque">
                <h4 class="detalle-bloque__titulo">Datos originales</h4>
                <pre class="json-viewer">{{ parsearJson(sol.datosOriginales) }}</pre>
              </div>
              <div *ngIf="sol.datosNuevos" class="detalle-bloque">
                <h4 class="detalle-bloque__titulo">Datos nuevos (propuestos)</h4>
                <pre class="json-viewer json-viewer--nuevo">{{ parsearJson(sol.datosNuevos) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: Aprobar -->
    <div *ngIf="modalAprobar" class="modal-overlay" (click)="cerrarModales()">
      <div class="modal-confirm" (click)="$event.stopPropagation()">
        <h3 class="modal-confirm__titulo">Aprobar solicitud</h3>
        <p class="modal-confirm__texto">Está a punto de aprobar la solicitud de <strong>{{ solicitudActual?.creadoPor?.nombre }}</strong>.</p>
        <div class="campo-grupo" style="margin: var(--espacio-4) 0;">
          <label class="campo-etiqueta">Comentario (opcional)</label>
          <textarea class="campo-input" [(ngModel)]="comentarioModal" rows="3" placeholder="Agregue un comentario opcional..."></textarea>
        </div>
        <div class="modal-confirm__acciones">
          <button class="boton boton-secundario" (click)="cerrarModales()" [disabled]="procesandoSolicitud">Cancelar</button>
          <button class="boton boton-exito" (click)="confirmarAprobar()" [disabled]="procesandoSolicitud">
            <span *ngIf="procesandoSolicitud" class="spinner-inline"></span>
            {{ procesandoSolicitud ? 'Aprobando...' : 'Confirmar aprobación' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: Rechazar -->
    <div *ngIf="modalRechazar" class="modal-overlay" (click)="cerrarModales()">
      <div class="modal-confirm" (click)="$event.stopPropagation()">
        <h3 class="modal-confirm__titulo">Rechazar solicitud</h3>
        <p class="modal-confirm__texto">Está a punto de rechazar la solicitud de <strong>{{ solicitudActual?.creadoPor?.nombre }}</strong>.</p>
        <div class="campo-grupo" style="margin: var(--espacio-4) 0;">
          <label class="campo-etiqueta">Motivo del rechazo <span style="color: var(--color-error);">*</span></label>
          <textarea
            class="campo-input"
            [(ngModel)]="comentarioModal"
            rows="3"
            placeholder="Explique por qué rechaza esta solicitud..."
          ></textarea>
          <span *ngIf="errorComentarioModal" class="mensaje-error">{{ errorComentarioModal }}</span>
        </div>
        <div class="modal-confirm__acciones">
          <button class="boton boton-secundario" (click)="cerrarModales()" [disabled]="procesandoSolicitud">Cancelar</button>
          <button class="boton boton-peligro" (click)="confirmarRechazar()" [disabled]="procesandoSolicitud">
            <span *ngIf="procesandoSolicitud" class="spinner-inline"></span>
            {{ procesandoSolicitud ? 'Rechazando...' : 'Confirmar rechazo' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pagina-solicitudes { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-3); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); text-align: center; }
    .spinner { width: 36px; height: 36px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }

    /* Tabs */
    .tabs-contenedor { display: flex; gap: var(--espacio-1); border-bottom: 2px solid var(--borde-color, #e5e7eb); }
    .tab-boton { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; cursor: pointer; font-size: var(--tamano-sm); font-weight: 500; color: var(--texto-terciario); transition: var(--transicion-base); }
    .tab-boton:hover { color: var(--texto-principal); }
    .tab-activo { color: var(--color-primario) !important; border-bottom-color: var(--color-primario) !important; font-weight: 600; }
    .tab-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: var(--color-advertencia); color: white; font-size: 0.7rem; font-weight: 700; }
    .tab-badge--aprobado { background: #15803d; }
    .tab-badge--rechazado { background: var(--color-error); }

    /* Solicitudes */
    .solicitudes-lista { display: flex; flex-direction: column; gap: var(--espacio-3); }
    .solicitud-item { padding: 0; overflow: hidden; }
    .solicitud-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--espacio-4); padding: var(--espacio-4) var(--espacio-5); cursor: pointer; transition: var(--transicion-base); flex-wrap: wrap; }
    .solicitud-header:hover { background: var(--fondo-tarjeta-hover, rgba(0,0,0,0.02)); }
    .solicitud-header__izq { display: flex; align-items: flex-start; gap: var(--espacio-3); flex: 1; min-width: 0; }
    .solicitud-header__der { display: flex; align-items: center; gap: var(--espacio-3); flex-shrink: 0; flex-wrap: wrap; }
    .solicitud-info { display: flex; flex-direction: column; gap: var(--espacio-1); min-width: 0; }
    .solicitud-tabla { font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .solicitud-motivo { font-size: var(--tamano-sm); color: var(--texto-principal); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px; }
    .solicitud-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .solicitud-autor { font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-principal); }
    .solicitud-fecha { font-size: 0.72rem; color: var(--texto-terciario); }
    .solicitud-acciones { display: flex; gap: var(--espacio-2); }
    .icono-expandir { transition: transform 0.2s; flex-shrink: 0; }
    .icono-expandir.expandido { transform: rotate(180deg); }

    /* Detalle expandido */
    .solicitud-detalle { padding: var(--espacio-4) var(--espacio-5); border-top: 1px solid var(--borde-color, #e5e7eb); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.02)); }
    .detalle-comentario { padding: var(--espacio-3); background: rgba(249,115,22,0.08); border-radius: var(--radio-sm); font-size: var(--tamano-sm); color: var(--texto-secundario); margin-bottom: var(--espacio-3); }
    .detalle-meta-revision { font-size: var(--tamano-sm); color: var(--texto-terciario); margin-bottom: var(--espacio-3); }
    .detalle-datos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--espacio-4); }
    .detalle-bloque { display: flex; flex-direction: column; gap: var(--espacio-2); }
    .detalle-bloque__titulo { font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-secundario); margin: 0; text-transform: uppercase; letter-spacing: 0.06em; }
    .json-viewer { background: var(--fondo-codigo, #1e293b); color: #e2e8f0; border-radius: var(--radio-md); padding: var(--espacio-3); font-size: 0.72rem; line-height: 1.5; overflow: auto; max-height: 300px; margin: 0; white-space: pre-wrap; word-break: break-word; }
    .json-viewer--nuevo { background: #052e16; color: #bbf7d0; }

    /* Badges */
    .badge-tipo { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; flex-shrink: 0; }
    .badge-edicion { background: rgba(37,99,235,0.12); color: #1d4ed8; }
    .badge-eliminacion { background: rgba(239,68,68,0.12); color: #b91c1c; }
    .badge-creacion { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-estado { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-pendiente { background: rgba(245,158,11,0.12); color: #b45309; }
    .badge-aprobada { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-rechazada { background: rgba(239,68,68,0.12); color: #b91c1c; }

    /* Botones pequeños */
    .boton-sm { font-size: var(--tamano-sm); padding: var(--espacio-1) var(--espacio-3); display: inline-flex; align-items: center; gap: var(--espacio-1); }
    .boton-exito { background: #15803d; color: white; border: none; border-radius: var(--radio-md); cursor: pointer; font-weight: 600; transition: var(--transicion-base); }
    .boton-exito:hover { background: #166534; }
    .boton-exito:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Modales */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: var(--espacio-4); }
    .modal-confirm { background: var(--fondo-tarjeta, #fff); border-radius: var(--radio-xl); padding: var(--espacio-6); width: 100%; max-width: 500px; box-shadow: var(--sombra-md); }
    .modal-confirm__titulo { font-size: var(--tamano-xl); font-weight: 700; color: var(--texto-principal); margin: 0 0 var(--espacio-3); }
    .modal-confirm__texto { color: var(--texto-secundario); margin: 0; }
    .modal-confirm__acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); margin-top: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .mensaje-error { font-size: var(--tamano-sm); color: var(--color-error); }

    .alerta-exito { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: var(--radio-md); color: #15803d; font-size: var(--tamano-sm); }
    .alerta-error { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radio-md); color: var(--color-error); font-size: var(--tamano-sm); }
    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }
  `]
})
export class SolicitudesAdminComponent implements OnInit, OnDestroy {
  solicitudes: SolicitudCambio[] = [];
  tabActiva: TabActiva = 'PENDIENTE';
  cargando = false;
  errorCarga = '';
  mensajeExito = '';
  mensajeError = '';

  expandidos = new Set<number>();

  // Modales
  modalAprobar = false;
  modalRechazar = false;
  solicitudActual: SolicitudCambio | null = null;
  comentarioModal = '';
  errorComentarioModal = '';
  procesandoSolicitud = false;

  private destruir$ = new Subject<void>();

  constructor(private solicitudesServicio: SolicitudesServicio) {}

  ngOnInit(): void {
    this.cargarSolicitudes();
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  cargarSolicitudes(): void {
    this.cargando = true;
    this.errorCarga = '';
    this.solicitudesServicio.listar().pipe(
      catchError(() => {
        this.errorCarga = 'Error al cargar las solicitudes. Verifique la conexión.';
        return of([]);
      }),
      takeUntil(this.destruir$)
    ).subscribe(lista => {
      this.solicitudes = lista;
      this.cargando = false;
    });
  }

  cambiarTab(tab: TabActiva): void {
    this.tabActiva = tab;
    this.expandidos.clear();
  }

  solicitudesFiltradas(): SolicitudCambio[] {
    return this.solicitudes.filter(s => s.estado === this.tabActiva);
  }

  contarPorEstado(estado: string): number {
    return this.solicitudes.filter(s => s.estado === estado).length;
  }

  textoTab(tab: TabActiva): string {
    const mapa: Record<TabActiva, string> = {
      PENDIENTE: 'Pendientes',
      APROBADA: 'Aprobadas',
      RECHAZADA: 'Rechazadas',
    };
    return mapa[tab];
  }

  toggleExpandir(id: number): void {
    if (this.expandidos.has(id)) {
      this.expandidos.delete(id);
    } else {
      this.expandidos.add(id);
    }
  }

  parsearJson(texto: string): string {
    try {
      const obj = JSON.parse(texto);
      return JSON.stringify(obj, null, 2);
    } catch {
      return texto;
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

  // ── APROBAR ───────────────────────────────────────────────
  abrirModalAprobar(sol: SolicitudCambio): void {
    this.solicitudActual = sol;
    this.comentarioModal = '';
    this.errorComentarioModal = '';
    this.modalAprobar = true;
  }

  confirmarAprobar(): void {
    if (!this.solicitudActual) return;
    this.procesandoSolicitud = true;
    this.mensajeError = '';

    this.solicitudesServicio.aprobar(this.solicitudActual.id, this.comentarioModal || undefined).pipe(
      catchError(err => {
        this.mensajeError = err?.error?.mensaje || 'Error al aprobar la solicitud.';
        return of(null);
      }),
      finalize(() => { this.procesandoSolicitud = false; this.modalAprobar = false; })
    ).subscribe(res => {
      if (res) {
        this.mensajeExito = 'Solicitud aprobada correctamente.';
        this.cargarSolicitudes();
        setTimeout(() => { this.mensajeExito = ''; }, 4000);
      }
    });
  }

  // ── RECHAZAR ──────────────────────────────────────────────
  abrirModalRechazar(sol: SolicitudCambio): void {
    this.solicitudActual = sol;
    this.comentarioModal = '';
    this.errorComentarioModal = '';
    this.modalRechazar = true;
  }

  confirmarRechazar(): void {
    if (!this.comentarioModal.trim()) {
      this.errorComentarioModal = 'El motivo del rechazo es obligatorio.';
      return;
    }
    if (!this.solicitudActual) return;
    this.procesandoSolicitud = true;
    this.mensajeError = '';

    this.solicitudesServicio.rechazar(this.solicitudActual.id, this.comentarioModal).pipe(
      catchError(err => {
        this.mensajeError = err?.error?.mensaje || 'Error al rechazar la solicitud.';
        return of(null);
      }),
      finalize(() => { this.procesandoSolicitud = false; this.modalRechazar = false; })
    ).subscribe(res => {
      if (res) {
        this.mensajeExito = 'Solicitud rechazada.';
        this.cargarSolicitudes();
        setTimeout(() => { this.mensajeExito = ''; }, 4000);
      }
    });
  }

  cerrarModales(): void {
    this.modalAprobar = false;
    this.modalRechazar = false;
    this.solicitudActual = null;
    this.comentarioModal = '';
    this.errorComentarioModal = '';
  }
}
