import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, finalize } from 'rxjs';
import { EmpresasServicio, Empresa } from '../../../nucleo/servicios/empresas.servicio';
import { SucursalesServicio, Sucursal } from '../../../nucleo/servicios/sucursales.servicio';
import { SolicitudesServicio } from '../../../nucleo/servicios/solicitudes.servicio';
import { AutenticacionServicio } from '../../../nucleo/servicios/autenticacion.servicio';

// 2026-10-07: dejó de ser de solo lectura - editar/activar/desactivar
// (ADMIN/SUPER_ADMIN directo, Secretaria vía SolicitudCambio, mismo
// patrón ya usado en detalle-afiliado.component.ts) + gestión real de
// sucursales (crear/editar, directo para ambos roles con permiso
// granular - sucursales no pasa por SolicitudCambio, a diferencia de
// Empresa, ver empresas.controlador.ts/sucursales.controlador.ts reales).
@Component({
  selector: 'anturi-detalle-empresa',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="detalle-contenedor">
      <div class="detalle-encabezado">
        <a routerLink="/admin/empresas" class="boton boton-icono" title="Volver a empresas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </a>
        <div class="detalle-encabezado__info">
          <h2 class="pagina-titulo" *ngIf="empresa">{{ empresa.razonSocial }}</h2>
          <h2 class="pagina-titulo" *ngIf="!empresa && !cargando">Detalle de empresa</h2>
          <span *ngIf="empresa" class="badge-estado" [ngClass]="empresa.activa ? 'badge-activo' : 'badge-inactivo'">
            {{ empresa.activa ? 'ACTIVA' : 'INACTIVA' }}
          </span>
        </div>
        <div class="detalle-acciones" *ngIf="empresa && !modoEdicion">
          <button class="boton boton-secundario" (click)="activarEdicion()">{{ esSecretaria ? 'Pedir edición' : 'Editar' }}</button>
          <button class="boton" [class.boton-peligro-suave]="empresa.activa" [class.boton-exito-suave]="!empresa.activa" (click)="abrirCambiarEstado()">
            {{ empresa.activa ? (esSecretaria ? 'Pedir desactivar' : 'Desactivar') : (esSecretaria ? 'Pedir activar' : 'Activar') }}
          </button>
        </div>
      </div>

      <div *ngIf="mensajeExito" class="alerta-exito">{{ mensajeExito }}</div>
      <div *ngIf="mensajeError" class="alerta-error">{{ mensajeError }}</div>

      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando datos de la empresa...</p>
      </div>

      <div *ngIf="error && !cargando" class="tarjeta estado-vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40" style="color: var(--color-error);">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>{{ error }}</p>
        <button class="boton boton-secundario" (click)="cargar()">Reintentar</button>
      </div>

      <ng-container *ngIf="empresa && !cargando && !modoEdicion">
        <div class="tarjeta seccion-datos">
          <h3 class="seccion-titulo">Datos de la empresa</h3>
          <div class="datos-grid">
            <div class="dato-item">
              <span class="dato-etiqueta">NIT</span>
              <span class="dato-valor">{{ empresa.nit }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Correo</span>
              <span class="dato-valor">{{ empresa.correo || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Teléfono</span>
              <span class="dato-valor">{{ empresa.telefono || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Municipio</span>
              <span class="dato-valor">{{ empresa.municipio || empresa.ciudad || '—' }}</span>
            </div>
            <div class="dato-item dato-item--ancho">
              <span class="dato-etiqueta">Dirección</span>
              <span class="dato-valor">{{ empresa.direccion || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Clase aportante</span>
              <span class="dato-valor">{{ empresa.claseAportante || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Días de pago</span>
              <span class="dato-valor">{{ empresa.diasPago ?? '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Asopagos</span>
              <span class="dato-valor">{{ empresa.asopagos || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Registrada</span>
              <span class="dato-valor">{{ empresa.creadoEn | date:'d MMM y' }}</span>
            </div>
          </div>
        </div>

        <div class="tarjeta seccion-datos">
          <div class="seccion-titulo-fila">
            <h3 class="seccion-titulo">Sucursales ({{ sucursales.length }})</h3>
            <button class="boton boton-secundario boton-sm" (click)="activarCrearSucursal()">+ Agregar sucursal</button>
          </div>
          <div *ngIf="sucursales.length === 0" style="color: var(--texto-terciario); font-size: var(--tamano-sm);">Sin sucursales registradas.</div>
          <div class="tabla-contenedor" *ngIf="sucursales.length > 0">
            <table class="tabla">
              <thead>
                <tr><th>Nombre</th><th>Ciudad</th><th>Afiliados</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of sucursales">
                  <td>{{ s.nombre }}</td>
                  <td>{{ s.ciudad || '—' }}</td>
                  <td>{{ s._count?.afiliados ?? '—' }}</td>
                  <td><span class="badge-estado" [ngClass]="s.activa ? 'badge-activo' : 'badge-inactivo'">{{ s.activa ? 'ACTIVA' : 'INACTIVA' }}</span></td>
                  <td><button class="boton boton-texto boton-sm" (click)="activarEditarSucursal(s)">Editar</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>

      <!-- MODO EDICIÓN DE LA EMPRESA -->
      <div class="tarjeta seccion-datos" *ngIf="empresa && modoEdicion">
        <h3 class="seccion-titulo">Editar {{ empresa.razonSocial }}</h3>
        <div *ngIf="esSecretaria" class="aviso-secretaria">Este cambio queda pendiente de aprobación de un Admin/Super Admin.</div>
        <div class="campos-grid-modal">
          <div class="campo-grupo">
            <label class="campo-etiqueta">Razón social</label>
            <input type="text" class="campo-input" [(ngModel)]="edicionForm.razonSocial" name="edit-razonSocial">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">NIT</label>
            <input type="text" class="campo-input" [(ngModel)]="edicionForm.nit" name="edit-nit">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Correo</label>
            <input type="email" class="campo-input" [(ngModel)]="edicionForm.correo" name="edit-correo">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Teléfono</label>
            <input type="tel" class="campo-input" [(ngModel)]="edicionForm.telefono" name="edit-telefono">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Municipio</label>
            <input type="text" class="campo-input" [(ngModel)]="edicionForm.municipio" name="edit-municipio">
          </div>
          <div class="campo-grupo campo-grupo--ancho">
            <label class="campo-etiqueta">Dirección</label>
            <input type="text" class="campo-input" [(ngModel)]="edicionForm.direccion" name="edit-direccion">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Clase aportante</label>
            <input type="text" class="campo-input" [(ngModel)]="edicionForm.claseAportante" name="edit-claseAportante">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Días de pago</label>
            <input type="number" class="campo-input" [(ngModel)]="edicionForm.diasPago" name="edit-diasPago">
          </div>
          <div class="campo-grupo campo-grupo--ancho" *ngIf="esSecretaria">
            <label class="campo-etiqueta">Motivo del cambio <span class="requerido">*</span></label>
            <input type="text" class="campo-input" [(ngModel)]="motivoEdicion" placeholder="Por qué se hace este cambio">
          </div>
        </div>
        <div class="form-acciones">
          <button class="boton boton-secundario" (click)="cancelarEdicion()" [disabled]="guardandoEdicion">Cancelar</button>
          <button class="boton boton-primario" (click)="guardarEdicion()" [disabled]="guardandoEdicion">
            <span *ngIf="guardandoEdicion" class="spinner-inline"></span>
            {{ guardandoEdicion ? 'Guardando...' : (esSecretaria ? 'Enviar solicitud' : 'Guardar cambios') }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: cambiar estado (activar/desactivar) -->
    <div *ngIf="modalEstado" class="modal-overlay" (click)="modalEstado = false">
      <div class="modal-form" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-titulo">{{ empresa?.activa ? 'Desactivar' : 'Activar' }} {{ empresa?.razonSocial }}</h3>
          <button class="boton boton-icono" (click)="modalEstado = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-cuerpo">
          <div class="campo-grupo">
            <label class="campo-etiqueta">Motivo <span class="requerido">*</span></label>
            <input type="text" class="campo-input" [(ngModel)]="motivoEstado" placeholder="Por qué se activa/desactiva">
          </div>
        </div>
        <div class="modal-pie">
          <button class="boton boton-secundario" (click)="modalEstado = false" [disabled]="guardandoEstado">Cancelar</button>
          <button class="boton boton-primario" (click)="confirmarCambiarEstado()" [disabled]="guardandoEstado || !motivoEstado.trim()">
            {{ guardandoEstado ? 'Guardando...' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: crear/editar sucursal -->
    <div *ngIf="modalSucursal" class="modal-overlay" (click)="modalSucursal = false">
      <div class="modal-form" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-titulo">{{ sucursalEditando ? 'Editar sucursal' : 'Nueva sucursal' }}</h3>
          <button class="boton boton-icono" (click)="modalSucursal = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-cuerpo">
          <div *ngIf="errorModalSucursal" class="alerta-error" style="margin-bottom: var(--espacio-4);">{{ errorModalSucursal }}</div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Nombre <span class="requerido">*</span></label>
            <input type="text" class="campo-input" [(ngModel)]="formSucursal.nombre">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Ciudad</label>
            <input type="text" class="campo-input" [(ngModel)]="formSucursal.ciudad">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Dirección</label>
            <input type="text" class="campo-input" [(ngModel)]="formSucursal.direccion">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Teléfono</label>
            <input type="tel" class="campo-input" [(ngModel)]="formSucursal.telefono">
          </div>
          <div class="campo-grupo" *ngIf="sucursalEditando">
            <label class="permiso-check"><input type="checkbox" [(ngModel)]="formSucursal.activa"> Activa</label>
          </div>
        </div>
        <div class="modal-pie">
          <button class="boton boton-secundario" (click)="modalSucursal = false" [disabled]="guardandoSucursal">Cancelar</button>
          <button class="boton boton-primario" (click)="guardarSucursal()" [disabled]="guardandoSucursal || !formSucursal.nombre?.trim()">
            {{ guardandoSucursal ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .detalle-contenedor { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .detalle-encabezado { display: flex; align-items: center; gap: var(--espacio-3); flex-wrap: wrap; }
    .detalle-encabezado__info { display: flex; align-items: center; gap: var(--espacio-3); flex: 1; flex-wrap: wrap; }
    .detalle-acciones { display: flex; gap: var(--espacio-2); margin-left: auto; flex-wrap: wrap; }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .boton-peligro-suave { color: var(--color-error); }
    .boton-exito-suave { color: #15803d; }
    .aviso-secretaria { display: flex; align-items: center; gap: var(--espacio-2); font-size: var(--tamano-sm); color: var(--color-advertencia); background: rgba(249,115,22,0.08); padding: var(--espacio-2) var(--espacio-3); border-radius: var(--radio-sm); margin-bottom: var(--espacio-4); }
    .alerta-exito { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: var(--radio-md); color: #15803d; font-size: var(--tamano-sm); }
    .alerta-error { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radio-md); color: var(--color-error); font-size: var(--tamano-sm); }
    .form-acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); margin-top: var(--espacio-4); }
    .campos-grid-modal { display: grid; grid-template-columns: 1fr 1fr; gap: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .campo-grupo--ancho { grid-column: 1 / -1; }
    .requerido { color: var(--color-error); }
    .permiso-check { display: flex; align-items: center; gap: var(--espacio-2); font-size: var(--tamano-sm); color: var(--texto-principal); cursor: pointer; }
    .seccion-titulo-fila { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espacio-4); }
    .seccion-titulo-fila .seccion-titulo { margin: 0; }
    .boton-sm { font-size: var(--tamano-sm); padding: var(--espacio-1) var(--espacio-3); }
    .boton-texto { background: none; border: none; color: var(--color-primario); cursor: pointer; }
    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: var(--espacio-4); }
    .modal-form { background: var(--fondo-tarjeta, #fff); border-radius: var(--radio-xl); width: 100%; max-width: 480px; display: flex; flex-direction: column; box-shadow: var(--sombra-md); max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--espacio-5); border-bottom: 1px solid var(--borde-color, #e5e7eb); }
    .modal-titulo { font-size: var(--tamano-xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .modal-cuerpo { padding: var(--espacio-5); display: flex; flex-direction: column; gap: var(--espacio-3); }
    .modal-pie { display: flex; justify-content: flex-end; gap: var(--espacio-3); padding: var(--espacio-4) var(--espacio-5); border-top: 1px solid var(--borde-color, #e5e7eb); }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .spinner { width: 40px; height: 40px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }
    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); text-align: center; }

    .seccion-datos { padding: var(--espacio-5); }
    .seccion-titulo { font-size: var(--tamano-lg); font-weight: 600; color: var(--texto-principal); margin: 0 0 var(--espacio-4); }
    .datos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--espacio-4); }
    .dato-item { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .dato-item--ancho { grid-column: 1 / -1; }
    .dato-etiqueta { font-size: var(--tamano-sm); color: var(--texto-terciario); font-weight: 500; }
    .dato-valor { font-size: var(--tamano-base); color: var(--texto-principal); font-weight: 500; }

    .badge-estado { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-activo { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-inactivo { background: rgba(239,68,68,0.12); color: #b91c1c; }

    .tabla-contenedor { overflow: hidden; }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla thead th { padding: var(--espacio-3) var(--espacio-4); text-align: left; font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-secundario); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); border-bottom: 1px solid var(--borde-color, #e5e7eb); }
    .tabla tbody td { padding: var(--espacio-3) var(--espacio-4); border-bottom: 1px solid var(--borde-color, #e5e7eb); font-size: var(--tamano-sm); color: var(--texto-principal); }
    .tabla tbody tr:last-child td { border-bottom: none; }
  `]
})
export class DetalleEmpresaComponent implements OnInit {
  empresa: Empresa | null = null;
  sucursales: Sucursal[] = [];
  cargando = false;
  error = '';
  private id!: number;

  mensajeExito = '';
  mensajeError = '';

  // ── Edición de empresa ──
  modoEdicion = false;
  edicionForm: Partial<Empresa> = {};
  motivoEdicion = '';
  guardandoEdicion = false;

  // ── Activar/desactivar ──
  modalEstado = false;
  motivoEstado = '';
  guardandoEstado = false;

  // ── Sucursales ──
  modalSucursal = false;
  sucursalEditando: Sucursal | null = null;
  formSucursal: Partial<Sucursal> = {};
  errorModalSucursal = '';
  guardandoSucursal = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private empresasServicio: EmpresasServicio,
    private sucursalesServicio: SucursalesServicio,
    private solicitudesServicio: SolicitudesServicio,
    private auth: AutenticacionServicio,
  ) {}

  get esSecretaria(): boolean {
    return this.auth.tieneRol(['SECRETARIA']);
  }

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.empresasServicio.obtener(this.id).pipe(
      catchError(() => {
        this.error = 'Error al cargar la empresa. Verifique la conexión.';
        return of(null);
      })
    ).subscribe(resp => {
      this.empresa = resp;
      this.cargando = false;
      if (resp) this.cargarSucursales();
    });
  }

  private cargarSucursales(): void {
    this.sucursalesServicio.listarPorEmpresa(this.id).pipe(
      catchError(() => of([] as Sucursal[])),
    ).subscribe((lista) => { this.sucursales = lista; });
  }

  // ── EDICIÓN ──────────────────────────────────────────────
  activarEdicion(): void {
    if (!this.empresa) return;
    this.edicionForm = { ...this.empresa };
    this.motivoEdicion = '';
    this.modoEdicion = true;
    this.mensajeExito = '';
    this.mensajeError = '';
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.edicionForm = {};
  }

  guardarEdicion(): void {
    if (this.esSecretaria && !this.motivoEdicion.trim()) {
      this.mensajeError = 'Debe indicar el motivo del cambio para enviar la solicitud.';
      return;
    }
    this.guardandoEdicion = true;
    this.mensajeError = '';

    // Payload explícito, solo los campos editables reales - mandar
    // sucursales/id/creadoEn de más rechazaría el request entero
    // (forbidNonWhitelisted:true), mismo patrón ya usado en afiliados.
    const datos = {
      razonSocial: this.edicionForm.razonSocial,
      nit: this.edicionForm.nit,
      correo: this.edicionForm.correo || undefined,
      telefono: this.edicionForm.telefono,
      direccion: this.edicionForm.direccion,
      municipio: this.edicionForm.municipio,
      claseAportante: this.edicionForm.claseAportante,
      diasPago: this.edicionForm.diasPago,
    };

    if (this.esSecretaria) {
      this.solicitudesServicio.crear({
        tipo: 'EDICION',
        tabla: 'empresas',
        registroId: this.id,
        motivo: this.motivoEdicion,
        datosOriginales: this.empresa,
        datosNuevos: datos,
      }).pipe(
        catchError(() => { this.mensajeError = 'Error al enviar la solicitud. Intente nuevamente.'; return of(null); }),
        finalize(() => { this.guardandoEdicion = false; }),
      ).subscribe((res) => {
        if (res) {
          this.mensajeExito = 'Solicitud de cambio enviada correctamente. Pendiente de aprobación.';
          this.modoEdicion = false;
          setTimeout(() => { this.mensajeExito = ''; }, 5000);
        }
      });
    } else {
      const motivo = this.motivoEdicion || 'Actualización desde panel de administración';
      this.empresasServicio.actualizar(this.id, datos, motivo).pipe(
        catchError((err) => { this.mensajeError = err?.error?.message || 'Error al guardar los cambios.'; return of(null); }),
        finalize(() => { this.guardandoEdicion = false; }),
      ).subscribe((emp) => {
        if (emp) {
          this.empresa = emp;
          this.modoEdicion = false;
          this.mensajeExito = 'Datos actualizados correctamente.';
          setTimeout(() => { this.mensajeExito = ''; }, 4000);
        }
      });
    }
  }

  // ── ACTIVAR/DESACTIVAR ───────────────────────────────────
  abrirCambiarEstado(): void {
    this.motivoEstado = '';
    this.modalEstado = true;
  }

  confirmarCambiarEstado(): void {
    if (!this.empresa || !this.motivoEstado.trim()) return;
    this.guardandoEstado = true;
    const nuevoEstado = !this.empresa.activa;

    if (this.esSecretaria) {
      this.solicitudesServicio.crear({
        tipo: nuevoEstado ? 'RESTAURACION' : 'ELIMINACION',
        tabla: 'empresas',
        registroId: this.id,
        motivo: this.motivoEstado,
      }).pipe(
        catchError(() => { this.mensajeError = 'Error al enviar la solicitud.'; return of(null); }),
        finalize(() => { this.guardandoEstado = false; }),
      ).subscribe((res) => {
        if (res) {
          this.mensajeExito = 'Solicitud enviada correctamente. Pendiente de aprobación.';
          this.modalEstado = false;
          setTimeout(() => { this.mensajeExito = ''; }, 5000);
        }
      });
    } else {
      this.empresasServicio.cambiarEstado(this.id, nuevoEstado, this.motivoEstado).pipe(
        catchError((err) => { this.mensajeError = err?.error?.message || 'Error al cambiar el estado.'; return of(null); }),
        finalize(() => { this.guardandoEstado = false; }),
      ).subscribe((emp) => {
        if (emp) {
          this.empresa = emp;
          this.modalEstado = false;
          this.mensajeExito = `Empresa ${nuevoEstado ? 'activada' : 'desactivada'} correctamente.`;
          setTimeout(() => { this.mensajeExito = ''; }, 4000);
        }
      });
    }
  }

  // ── SUCURSALES (directo, sin SolicitudCambio - ver nota de cabecera) ──
  activarCrearSucursal(): void {
    this.sucursalEditando = null;
    this.formSucursal = { activa: true };
    this.errorModalSucursal = '';
    this.modalSucursal = true;
  }

  activarEditarSucursal(s: Sucursal): void {
    this.sucursalEditando = s;
    this.formSucursal = { ...s };
    this.errorModalSucursal = '';
    this.modalSucursal = true;
  }

  guardarSucursal(): void {
    if (!this.formSucursal.nombre?.trim()) return;
    this.guardandoSucursal = true;
    this.errorModalSucursal = '';

    if (this.sucursalEditando) {
      const { id, empresaId, creadoEn, _count, ...datos } = this.formSucursal as any;
      this.sucursalesServicio.actualizar(this.sucursalEditando.id, datos, 'Actualización desde ficha de empresa').pipe(
        catchError((err) => { this.errorModalSucursal = err?.error?.message || 'Error al guardar.'; return of(null); }),
        finalize(() => { this.guardandoSucursal = false; }),
      ).subscribe((res) => {
        if (res) { this.modalSucursal = false; this.cargarSucursales(); }
      });
    } else {
      this.sucursalesServicio.crear({
        nombre: this.formSucursal.nombre!,
        empresaId: this.id,
        direccion: this.formSucursal.direccion,
        telefono: this.formSucursal.telefono,
        ciudad: this.formSucursal.ciudad,
      }).pipe(
        catchError((err) => { this.errorModalSucursal = err?.error?.message || 'Error al crear la sucursal.'; return of(null); }),
        finalize(() => { this.guardandoSucursal = false; }),
      ).subscribe((res) => {
        if (res) { this.modalSucursal = false; this.cargarSucursales(); }
      });
    }
  }
}
