import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, finalize } from 'rxjs';
import { UsuariosServicio, UsuarioSistema, CrearUsuarioDto } from '../../nucleo/servicios/usuarios.servicio';
import { PermisoSecretaria } from '../../nucleo/modelos/usuario.modelo';

interface FormUsuario {
  nombre: string;
  apellido: string;
  correo: string;
  contrasena: string;
  rol: 'ADMIN' | 'SECRETARIA';
}

@Component({
  selector: 'anturi-usuarios-sistema',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pagina-lista">
      <!-- Encabezado -->
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Usuarios del sistema</h2>
        <button class="boton boton-primario" (click)="abrirModalCrear()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Nuevo usuario
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

      <!-- Cargando -->
      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando usuarios...</p>
      </div>

      <!-- Lista vacía -->
      <div *ngIf="!cargando && usuarios.length === 0 && !errorCarga" class="tarjeta estado-vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="color: var(--texto-terciario);">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
        <p style="color: var(--texto-terciario); font-size: var(--tamano-lg);">No hay usuarios registrados</p>
        <button class="boton boton-primario" (click)="abrirModalCrear()">Crear primer usuario</button>
      </div>

      <!-- Error -->
      <div *ngIf="errorCarga && !cargando" class="tarjeta estado-vacio">
        <p style="color: var(--color-error);">{{ errorCarga }}</p>
        <button class="boton boton-secundario" (click)="cargarUsuarios()">Reintentar</button>
      </div>

      <!-- Tabla -->
      <div *ngIf="!cargando && usuarios.length > 0" class="tarjeta tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Registrado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of usuarios" class="fila-tabla">
              <td>
                <div class="celda-usuario">
                  <div class="avatar-inicial">{{ (u.nombre || '?').charAt(0).toUpperCase() }}</div>
                  <div>
                    <div class="usuario-nombre">{{ u.nombre }} {{ u.apellido }}</div>
                  </div>
                </div>
              </td>
              <td class="celda-correo">{{ u.correo }}</td>
              <td>
                <span class="badge-rol" [ngClass]="claseBadgeRol(u.rol)">{{ u.rol }}</span>
              </td>
              <td>
                <span class="badge-estado" [ngClass]="u.activo ? 'badge-activo' : 'badge-inactivo'">
                  {{ u.activo ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td class="celda-fecha">{{ u.creadoEn | date:'dd/MM/yyyy' }}</td>
              <td class="celda-acciones">
                <button class="boton boton-icono" title="Editar" (click)="abrirModalEditar(u)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button
                  *ngIf="u.rol === 'SECRETARIA'"
                  class="boton boton-icono"
                  title="Gestionar permisos"
                  (click)="abrirModalPermisos(u)"
                  style="color: var(--color-info);"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                </button>
                <button
                  class="boton boton-icono"
                  [class.boton-peligro-suave]="u.activo"
                  [class.boton-exito-suave]="!u.activo"
                  [title]="u.activo ? 'Desactivar usuario' : 'Activar usuario'"
                  (click)="toggleEstado(u)"
                  [disabled]="cambiandoEstadoId === u.id"
                >
                  <svg *ngIf="u.activo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  <svg *ngIf="!u.activo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="tabla-pie">
          <span class="tabla-pie__total">{{ usuarios.length }} usuario{{ usuarios.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>
    </div>

    <!-- MODAL: Crear / Editar usuario -->
    <div *ngIf="modalUsuario" class="modal-overlay" (click)="cerrarModalUsuario()">
      <div class="modal-form" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-titulo">{{ modoEditar ? 'Editar usuario' : 'Nuevo usuario' }}</h3>
          <button class="boton boton-icono" (click)="cerrarModalUsuario()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-cuerpo">
          <div *ngIf="errorModal" class="alerta-error" style="margin-bottom: var(--espacio-4);">{{ errorModal }}</div>
          <div class="campos-grid-modal">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Nombre <span class="requerido">*</span></label>
              <input type="text" class="campo-input" [(ngModel)]="formUsuario.nombre" placeholder="Nombre">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Apellido <span class="requerido">*</span></label>
              <input type="text" class="campo-input" [(ngModel)]="formUsuario.apellido" placeholder="Apellido">
            </div>
            <div class="campo-grupo campo-grupo--ancho">
              <label class="campo-etiqueta">Correo electrónico <span class="requerido">*</span></label>
              <input type="email" class="campo-input" [(ngModel)]="formUsuario.correo" placeholder="correo@ejemplo.com">
            </div>
            <div class="campo-grupo campo-grupo--ancho">
              <label class="campo-etiqueta">{{ modoEditar ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *' }}</label>
              <input type="password" class="campo-input" [(ngModel)]="formUsuario.contrasena" placeholder="••••••••">
            </div>
            <div class="campo-grupo campo-grupo--ancho">
              <label class="campo-etiqueta">Rol <span class="requerido">*</span></label>
              <select class="campo-input" [(ngModel)]="formUsuario.rol">
                <option value="ADMIN">Administrador</option>
                <option value="SECRETARIA">Secretaria</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-pie">
          <button class="boton boton-secundario" (click)="cerrarModalUsuario()" [disabled]="guardandoUsuario">Cancelar</button>
          <button class="boton boton-primario" (click)="guardarUsuario()" [disabled]="guardandoUsuario">
            <span *ngIf="guardandoUsuario" class="spinner-inline"></span>
            {{ guardandoUsuario ? 'Guardando...' : (modoEditar ? 'Guardar cambios' : 'Crear usuario') }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: Permisos de secretaria -->
    <div *ngIf="modalPermisos" class="modal-overlay" (click)="cerrarModalPermisos()">
      <div class="modal-form" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-titulo">Permisos de {{ usuarioEditando?.nombre }} {{ usuarioEditando?.apellido }}</h3>
          <button class="boton boton-icono" (click)="cerrarModalPermisos()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-cuerpo">
          <div class="permisos-grupo">
            <h4 class="permisos-grupo__titulo">Afiliados</h4>
            <label class="permiso-check"><input type="checkbox" [(ngModel)]="formPermisos.puedeCrearAfiliados"> Puede crear afiliados</label>
            <label class="permiso-check"><input type="checkbox" [(ngModel)]="formPermisos.puedeEditarAfiliados"> Puede editar afiliados (solicitud)</label>
            <label class="permiso-check"><input type="checkbox" [(ngModel)]="formPermisos.puedeEliminarAfiliados"> Puede eliminar afiliados (solicitud)</label>
          </div>
          <div class="permisos-grupo">
            <h4 class="permisos-grupo__titulo">Empresas</h4>
            <label class="permiso-check"><input type="checkbox" [(ngModel)]="formPermisos.puedeCrearEmpresas"> Puede crear empresas</label>
            <label class="permiso-check"><input type="checkbox" [(ngModel)]="formPermisos.puedeEditarEmpresas"> Puede editar empresas</label>
          </div>
          <div class="permisos-grupo">
            <h4 class="permisos-grupo__titulo">Documentos y pagos</h4>
            <label class="permiso-check"><input type="checkbox" [(ngModel)]="formPermisos.puedeSubirDocumentos"> Puede subir documentos</label>
            <label class="permiso-check"><input type="checkbox" [(ngModel)]="formPermisos.puedeVerPagos"> Puede ver pagos</label>
            <label class="permiso-check"><input type="checkbox" [(ngModel)]="formPermisos.puedeRegistrarPagos"> Puede registrar pagos</label>
          </div>
        </div>
        <div class="modal-pie">
          <button class="boton boton-secundario" (click)="cerrarModalPermisos()" [disabled]="guardandoPermisos">Cancelar</button>
          <button class="boton boton-primario" (click)="guardarPermisos()" [disabled]="guardandoPermisos">
            <span *ngIf="guardandoPermisos" class="spinner-inline"></span>
            {{ guardandoPermisos ? 'Guardando...' : 'Guardar permisos' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: Confirmar cambio de estado -->
    <div *ngIf="modalConfirmEstado" class="modal-overlay" (click)="modalConfirmEstado = false">
      <div class="modal-confirm" (click)="$event.stopPropagation()">
        <h3 class="modal-confirm__titulo">
          {{ usuarioEstado?.activo ? 'Desactivar usuario' : 'Activar usuario' }}
        </h3>
        <p class="modal-confirm__texto">
          ¿Está seguro que desea {{ usuarioEstado?.activo ? 'desactivar' : 'activar' }} la cuenta de
          <strong>{{ usuarioEstado?.nombre }} {{ usuarioEstado?.apellido }}</strong>?
        </p>
        <div class="modal-confirm__acciones">
          <button class="boton boton-secundario" (click)="modalConfirmEstado = false">Cancelar</button>
          <button
            class="boton"
            [class.boton-peligro]="usuarioEstado?.activo"
            [class.boton-primario]="!usuarioEstado?.activo"
            (click)="confirmarCambioEstado()"
            [disabled]="cambiandoEstadoId !== null"
          >
            {{ usuarioEstado?.activo ? 'Desactivar' : 'Activar' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-3); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); text-align: center; }
    .spinner { width: 36px; height: 36px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }

    .tabla-contenedor { padding: 0; overflow: hidden; }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla thead th { padding: var(--espacio-3) var(--espacio-4); text-align: left; font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-secundario); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); border-bottom: 1px solid var(--borde-color, #e5e7eb); white-space: nowrap; }
    .tabla tbody td { padding: var(--espacio-3) var(--espacio-4); border-bottom: 1px solid var(--borde-color, #e5e7eb); font-size: var(--tamano-sm); color: var(--texto-principal); vertical-align: middle; }
    .fila-tabla:last-child td { border-bottom: none; }
    .tabla-pie { padding: var(--espacio-3) var(--espacio-4); border-top: 1px solid var(--borde-color, #e5e7eb); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.02)); }
    .tabla-pie__total { font-size: var(--tamano-sm); color: var(--texto-terciario); }

    .celda-usuario { display: flex; align-items: center; gap: var(--espacio-3); }
    .avatar-inicial { width: 34px; height: 34px; border-radius: 50%; background: rgba(27,50,112,0.12); color: var(--color-primario); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: var(--tamano-sm); flex-shrink: 0; }
    .usuario-nombre { font-weight: 600; color: var(--texto-principal); }
    .celda-correo { color: var(--texto-secundario); }
    .celda-fecha { color: var(--texto-terciario); font-size: var(--tamano-sm); }
    .celda-acciones { white-space: nowrap; display: flex; gap: var(--espacio-1); align-items: center; }

    .badge-estado, .badge-rol { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-activo { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-inactivo { background: rgba(156,163,175,0.2); color: #6b7280; }
    .badge-admin { background: rgba(27,50,112,0.12); color: var(--color-primario); }
    .badge-secretaria { background: rgba(139,92,246,0.12); color: #7c3aed; }
    .badge-super { background: rgba(245,158,11,0.12); color: #b45309; }
    .boton-peligro-suave { color: var(--color-error); }
    .boton-peligro-suave:hover { background: rgba(239,68,68,0.08); }
    .boton-exito-suave { color: #15803d; }
    .boton-exito-suave:hover { background: rgba(34,197,94,0.08); }

    /* Modales */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: var(--espacio-4); }
    .modal-form { background: var(--fondo-tarjeta, #fff); border-radius: var(--radio-xl); width: 100%; max-width: 520px; display: flex; flex-direction: column; box-shadow: var(--sombra-md); max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--espacio-5); border-bottom: 1px solid var(--borde-color, #e5e7eb); }
    .modal-titulo { font-size: var(--tamano-xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .modal-cuerpo { padding: var(--espacio-5); }
    .modal-pie { display: flex; justify-content: flex-end; gap: var(--espacio-3); padding: var(--espacio-4) var(--espacio-5); border-top: 1px solid var(--borde-color, #e5e7eb); }
    .campos-grid-modal { display: grid; grid-template-columns: 1fr 1fr; gap: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .campo-grupo--ancho { grid-column: 1 / -1; }
    .requerido { color: var(--color-error); }

    /* Permisos */
    .permisos-grupo { margin-bottom: var(--espacio-5); }
    .permisos-grupo__titulo { font-size: var(--tamano-sm); font-weight: 700; color: var(--texto-secundario); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 var(--espacio-3); }
    .permiso-check { display: flex; align-items: center; gap: var(--espacio-2); font-size: var(--tamano-sm); color: var(--texto-principal); margin-bottom: var(--espacio-2); cursor: pointer; }
    .permiso-check input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-primario); }

    /* Confirm modal */
    .modal-confirm { background: var(--fondo-tarjeta, #fff); border-radius: var(--radio-xl); padding: var(--espacio-6); width: 100%; max-width: 420px; box-shadow: var(--sombra-md); }
    .modal-confirm__titulo { font-size: var(--tamano-xl); font-weight: 700; color: var(--texto-principal); margin: 0 0 var(--espacio-3); }
    .modal-confirm__texto { color: var(--texto-secundario); margin: 0; }
    .modal-confirm__acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); margin-top: var(--espacio-5); }

    .alerta-exito { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: var(--radio-md); color: #15803d; font-size: var(--tamano-sm); }
    .alerta-error { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radio-md); color: var(--color-error); font-size: var(--tamano-sm); }
    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }
  `]
})
export class UsuariosSistemaComponent implements OnInit, OnDestroy {
  usuarios: UsuarioSistema[] = [];
  cargando = false;
  errorCarga = '';
  mensajeExito = '';
  mensajeError = '';

  // Modal usuario
  modalUsuario = false;
  modoEditar = false;
  usuarioEditando: UsuarioSistema | null = null;
  guardandoUsuario = false;
  errorModal = '';
  formUsuario: FormUsuario = this.formVacio();

  // Modal permisos
  modalPermisos = false;
  guardandoPermisos = false;
  formPermisos: Partial<PermisoSecretaria> = this.permisosVacios();

  // Modal estado
  modalConfirmEstado = false;
  usuarioEstado: UsuarioSistema | null = null;
  cambiandoEstadoId: number | null = null;

  private destruir$ = new Subject<void>();

  constructor(private usuariosServicio: UsuariosServicio) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  cargarUsuarios(): void {
    this.cargando = true;
    this.errorCarga = '';
    this.usuariosServicio.listar().pipe(
      catchError(() => {
        this.errorCarga = 'Error al cargar usuarios. Verifique la conexión.';
        return of([]);
      }),
      takeUntil(this.destruir$)
    ).subscribe(lista => {
      this.usuarios = lista;
      this.cargando = false;
    });
  }

  claseBadgeRol(rol: string): string {
    const mapa: Record<string, string> = {
      ADMIN: 'badge-admin',
      SECRETARIA: 'badge-secretaria',
      SUPER_ADMIN: 'badge-super',
    };
    return mapa[rol] ?? '';
  }

  // ── MODAL USUARIO ─────────────────────────────────────────
  abrirModalCrear(): void {
    this.modoEditar = false;
    this.usuarioEditando = null;
    this.formUsuario = this.formVacio();
    this.errorModal = '';
    this.modalUsuario = true;
  }

  abrirModalEditar(u: UsuarioSistema): void {
    this.modoEditar = true;
    this.usuarioEditando = u;
    this.formUsuario = {
      nombre: u.nombre,
      apellido: u.apellido,
      correo: u.correo,
      contrasena: '',
      rol: u.rol === 'ADMIN' || u.rol === 'SECRETARIA' ? u.rol : 'SECRETARIA',
    };
    this.errorModal = '';
    this.modalUsuario = true;
  }

  cerrarModalUsuario(): void {
    this.modalUsuario = false;
    this.errorModal = '';
  }

  guardarUsuario(): void {
    if (!this.formUsuario.nombre.trim() || !this.formUsuario.apellido.trim() || !this.formUsuario.correo.trim()) {
      this.errorModal = 'Nombre, apellido y correo son obligatorios.';
      return;
    }
    if (!this.modoEditar && !this.formUsuario.contrasena.trim()) {
      this.errorModal = 'La contraseña es obligatoria para usuarios nuevos.';
      return;
    }

    this.guardandoUsuario = true;
    this.errorModal = '';

    if (this.modoEditar && this.usuarioEditando) {
      const dto: any = {
        nombre: this.formUsuario.nombre,
        apellido: this.formUsuario.apellido,
        correo: this.formUsuario.correo,
        rol: this.formUsuario.rol,
      };
      if (this.formUsuario.contrasena.trim()) {
        dto.contrasena = this.formUsuario.contrasena;
      }
      this.usuariosServicio.actualizar(this.usuarioEditando.id, dto).pipe(
        catchError(err => {
          this.errorModal = err?.error?.mensaje || 'Error al actualizar el usuario.';
          return of(null);
        }),
        finalize(() => { this.guardandoUsuario = false; })
      ).subscribe(u => {
        if (u) {
          this.modalUsuario = false;
          this.mensajeExito = 'Usuario actualizado correctamente.';
          this.cargarUsuarios();
          setTimeout(() => { this.mensajeExito = ''; }, 4000);
        }
      });
    } else {
      const dto: CrearUsuarioDto = {
        nombre: this.formUsuario.nombre,
        apellido: this.formUsuario.apellido,
        correo: this.formUsuario.correo,
        contrasena: this.formUsuario.contrasena,
        rol: this.formUsuario.rol,
      };
      this.usuariosServicio.crear(dto).pipe(
        catchError(err => {
          this.errorModal = err?.error?.mensaje || 'Error al crear el usuario.';
          return of(null);
        }),
        finalize(() => { this.guardandoUsuario = false; })
      ).subscribe(u => {
        if (u) {
          this.modalUsuario = false;
          this.mensajeExito = `Usuario ${u.nombre} creado correctamente.`;
          this.cargarUsuarios();
          setTimeout(() => { this.mensajeExito = ''; }, 4000);
        }
      });
    }
  }

  // ── PERMISOS ──────────────────────────────────────────────
  abrirModalPermisos(u: UsuarioSistema): void {
    this.usuarioEditando = u;
    this.formPermisos = {
      ...this.permisosVacios(),
      ...(u.permisos || {}),
    };
    this.modalPermisos = true;
  }

  cerrarModalPermisos(): void {
    this.modalPermisos = false;
  }

  guardarPermisos(): void {
    if (!this.usuarioEditando) return;
    this.guardandoPermisos = true;
    // HALLAZGO 2026-08-22: this.formPermisos se arma con `...(u.permisos || {})`,
    // que trae el registro completo de PermisoSecretaria desde el backend
    // (incluye id/usuarioId/actualizadoEn). El backend valida con
    // forbidNonWhitelisted:true - enviar esos campos de más rechaza el
    // request entero. Se arma acá un payload explícito con solo los 10
    // campos reales del DTO.
    const payload = {
      puedeCrearAfiliados: this.formPermisos.puedeCrearAfiliados,
      puedeEditarAfiliados: this.formPermisos.puedeEditarAfiliados,
      puedeEliminarAfiliados: this.formPermisos.puedeEliminarAfiliados,
      puedeCrearEmpresas: this.formPermisos.puedeCrearEmpresas,
      puedeEditarEmpresas: this.formPermisos.puedeEditarEmpresas,
      puedeEliminarEmpresas: this.formPermisos.puedeEliminarEmpresas,
      puedeSubirDocumentos: this.formPermisos.puedeSubirDocumentos,
      puedeEliminarDocumentos: this.formPermisos.puedeEliminarDocumentos,
      puedeVerPagos: this.formPermisos.puedeVerPagos,
      puedeRegistrarPagos: this.formPermisos.puedeRegistrarPagos,
    };
    this.usuariosServicio.actualizarPermisos(this.usuarioEditando.id, payload).pipe(
      catchError(err => {
        this.mensajeError = err?.error?.mensaje || 'Error al guardar los permisos.';
        return of(null);
      }),
      finalize(() => { this.guardandoPermisos = false; })
    ).subscribe(res => {
      if (res !== null) {
        this.modalPermisos = false;
        this.mensajeExito = 'Permisos actualizados correctamente.';
        this.cargarUsuarios();
        setTimeout(() => { this.mensajeExito = ''; }, 4000);
      }
    });
  }

  // ── ESTADO ────────────────────────────────────────────────
  toggleEstado(u: UsuarioSistema): void {
    this.usuarioEstado = u;
    this.modalConfirmEstado = true;
  }

  confirmarCambioEstado(): void {
    if (!this.usuarioEstado) return;
    this.cambiandoEstadoId = this.usuarioEstado.id;
    const operacion = this.usuarioEstado.activo
      ? this.usuariosServicio.desactivar(this.usuarioEstado.id)
      : this.usuariosServicio.activar(this.usuarioEstado.id);

    operacion.pipe(
      catchError(err => {
        this.mensajeError = err?.error?.mensaje || 'Error al cambiar el estado del usuario.';
        return of(null);
      }),
      finalize(() => { this.cambiandoEstadoId = null; this.modalConfirmEstado = false; })
    ).subscribe(res => {
      if (res !== null) {
        const nombre = this.usuarioEstado?.activo ? 'desactivado' : 'activado';
        this.mensajeExito = `Usuario ${nombre} correctamente.`;
        this.cargarUsuarios();
        setTimeout(() => { this.mensajeExito = ''; }, 4000);
      }
    });
  }

  private formVacio(): FormUsuario {
    return { nombre: '', apellido: '', correo: '', contrasena: '', rol: 'SECRETARIA' };
  }

  private permisosVacios(): Partial<PermisoSecretaria> {
    return {
      puedeCrearAfiliados: false,
      puedeEditarAfiliados: false,
      puedeEliminarAfiliados: false,
      puedeCrearEmpresas: false,
      puedeEditarEmpresas: false,
      puedeSubirDocumentos: false,
      puedeVerPagos: false,
      puedeRegistrarPagos: false,
    };
  }
}
