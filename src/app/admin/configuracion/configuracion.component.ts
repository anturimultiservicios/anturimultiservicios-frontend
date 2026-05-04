import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, finalize } from 'rxjs';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';
import { UsuariosServicio } from '../../nucleo/servicios/usuarios.servicio';

@Component({
  selector: 'anturi-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="config-contenedor">
      <h2 class="pagina-titulo">Configuración</h2>

      <!-- Avatar y datos básicos -->
      <div class="tarjeta config-perfil">
        <div class="perfil-avatar-grande">
          <img
            *ngIf="auth.usuarioActual?.fotoPerfil"
            [src]="auth.usuarioActual!.fotoPerfil"
            [alt]="auth.usuarioActual?.nombre"
            class="avatar-imagen"
          >
          <div *ngIf="!auth.usuarioActual?.fotoPerfil" class="avatar-inicial-grande">
            {{ (auth.usuarioActual?.nombre || '?').charAt(0).toUpperCase() }}
          </div>
        </div>
        <div class="perfil-info">
          <h3 class="perfil-nombre">{{ auth.usuarioActual?.nombre }} {{ auth.usuarioActual?.apellido }}</h3>
          <p class="perfil-correo">{{ auth.usuarioActual?.correo }}</p>
          <span class="badge-rol" [ngClass]="claseBadgeRol(auth.usuarioActual?.rol || '')">
            {{ textoRol(auth.usuarioActual?.rol || '') }}
          </span>
        </div>
      </div>

      <!-- Mensajes globales -->
      <div *ngIf="mensajeExitoPerfil" class="alerta-exito">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>
        {{ mensajeExitoPerfil }}
      </div>
      <div *ngIf="mensajeExitoContrasena" class="alerta-exito">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>
        {{ mensajeExitoContrasena }}
      </div>

      <!-- Sección: Editar perfil -->
      <div class="tarjeta config-seccion">
        <h3 class="seccion-titulo">Datos del perfil</h3>
        <div *ngIf="errorPerfil" class="alerta-error">{{ errorPerfil }}</div>
        <form (ngSubmit)="guardarPerfil()">
          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Nombre</label>
              <input
                type="text"
                class="campo-input"
                [(ngModel)]="formPerfil.nombre"
                name="nombre"
                placeholder="Nombre"
              >
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Apellido</label>
              <input
                type="text"
                class="campo-input"
                [(ngModel)]="formPerfil.apellido"
                name="apellido"
                placeholder="Apellido"
              >
            </div>
            <div class="campo-grupo campo-grupo--ancho">
              <label class="campo-etiqueta">Correo electrónico</label>
              <input
                type="email"
                class="campo-input"
                [value]="auth.usuarioActual?.correo || ''"
                readonly
                style="background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.04)); cursor: not-allowed;"
              >
              <span class="campo-ayuda">El correo no puede modificarse desde aquí.</span>
            </div>
          </div>
          <div class="seccion-acciones">
            <button type="submit" class="boton boton-primario" [disabled]="guardandoPerfil">
              <span *ngIf="guardandoPerfil" class="spinner-inline"></span>
              {{ guardandoPerfil ? 'Guardando...' : 'Actualizar perfil' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Sección: Cambiar contraseña -->
      <div class="tarjeta config-seccion">
        <h3 class="seccion-titulo">Cambiar contraseña</h3>
        <div *ngIf="errorContrasena" class="alerta-error">{{ errorContrasena }}</div>
        <form (ngSubmit)="cambiarContrasena()">
          <div class="campos-col">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Contraseña actual</label>
              <input
                type="password"
                class="campo-input"
                [(ngModel)]="formContrasena.actual"
                name="actual"
                placeholder="••••••••"
                autocomplete="current-password"
              >
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Nueva contraseña</label>
              <input
                type="password"
                class="campo-input"
                [(ngModel)]="formContrasena.nueva"
                name="nueva"
                placeholder="••••••••"
                autocomplete="new-password"
              >
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Confirmar nueva contraseña</label>
              <input
                type="password"
                class="campo-input"
                [class.campo-error]="formContrasena.nueva && formContrasena.confirmar && formContrasena.nueva !== formContrasena.confirmar"
                [(ngModel)]="formContrasena.confirmar"
                name="confirmar"
                placeholder="••••••••"
                autocomplete="new-password"
              >
              <span
                *ngIf="formContrasena.nueva && formContrasena.confirmar && formContrasena.nueva !== formContrasena.confirmar"
                class="mensaje-error"
              >
                Las contraseñas no coinciden.
              </span>
            </div>
          </div>
          <div class="seccion-acciones">
            <button
              type="submit"
              class="boton boton-primario"
              [disabled]="guardandoContrasena || (!!formContrasena.nueva && !!formContrasena.confirmar && formContrasena.nueva !== formContrasena.confirmar)"
            >
              <span *ngIf="guardandoContrasena" class="spinner-inline"></span>
              {{ guardandoContrasena ? 'Cambiando...' : 'Cambiar contraseña' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .config-contenedor { display: flex; flex-direction: column; gap: var(--espacio-6); max-width: 700px; }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }

    /* Avatar perfil */
    .config-perfil { display: flex; align-items: center; gap: var(--espacio-5); padding: var(--espacio-6); }
    .perfil-avatar-grande { flex-shrink: 0; }
    .avatar-imagen { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid var(--color-primario); }
    .avatar-inicial-grande { width: 80px; height: 80px; border-radius: 50%; background: rgba(27,50,112,0.12); color: var(--color-primario); display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 800; border: 3px solid rgba(27,50,112,0.2); }
    .perfil-info { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .perfil-nombre { font-size: var(--tamano-xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .perfil-correo { font-size: var(--tamano-sm); color: var(--texto-terciario); margin: 0; }

    /* Secciones */
    .config-seccion { padding: var(--espacio-5); }
    .seccion-titulo { font-size: var(--tamano-lg); font-weight: 600; color: var(--texto-principal); margin: 0 0 var(--espacio-4); padding-bottom: var(--espacio-3); border-bottom: 1px solid var(--borde-color, #e5e7eb); }
    .campos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--espacio-4); margin-bottom: var(--espacio-4); }
    .campos-col { display: flex; flex-direction: column; gap: var(--espacio-4); margin-bottom: var(--espacio-4); max-width: 480px; }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .campo-grupo--ancho { grid-column: 1 / -1; }
    .campo-ayuda { font-size: var(--tamano-sm); color: var(--texto-terciario); }
    .campo-error { border-color: var(--color-error) !important; }
    .mensaje-error { font-size: var(--tamano-sm); color: var(--color-error); }
    .seccion-acciones { display: flex; justify-content: flex-start; }

    /* Badges */
    .badge-rol { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; width: fit-content; }
    .badge-admin { background: rgba(27,50,112,0.12); color: var(--color-primario); }
    .badge-secretaria { background: rgba(139,92,246,0.12); color: #7c3aed; }
    .badge-super { background: rgba(245,158,11,0.12); color: #b45309; }

    /* Alertas */
    .alerta-exito { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: var(--radio-md); color: #15803d; font-size: var(--tamano-sm); }
    .alerta-error { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radio-md); color: var(--color-error); font-size: var(--tamano-sm); margin-bottom: var(--espacio-3); }

    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }
    @keyframes girar { to { transform: rotate(360deg); } }
  `]
})
export class ConfiguracionComponent implements OnInit, OnDestroy {
  formPerfil = { nombre: '', apellido: '' };
  formContrasena = { actual: '', nueva: '', confirmar: '' };

  guardandoPerfil = false;
  guardandoContrasena = false;
  errorPerfil = '';
  errorContrasena = '';
  mensajeExitoPerfil = '';
  mensajeExitoContrasena = '';

  private destruir$ = new Subject<void>();

  constructor(
    public auth: AutenticacionServicio,
    private usuariosServicio: UsuariosServicio
  ) {}

  ngOnInit(): void {
    const u = this.auth.usuarioActual;
    if (u) {
      this.formPerfil.nombre = u.nombre;
      this.formPerfil.apellido = u.apellido;
    }
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  claseBadgeRol(rol: string): string {
    const mapa: Record<string, string> = {
      ADMIN: 'badge-admin',
      SECRETARIA: 'badge-secretaria',
      SUPER_ADMIN: 'badge-super',
    };
    return mapa[rol] ?? '';
  }

  textoRol(rol: string): string {
    const mapa: Record<string, string> = {
      ADMIN: 'Administrador',
      SECRETARIA: 'Secretaria',
      SUPER_ADMIN: 'Super Administrador',
    };
    return mapa[rol] ?? rol;
  }

  guardarPerfil(): void {
    if (!this.formPerfil.nombre.trim() || !this.formPerfil.apellido.trim()) {
      this.errorPerfil = 'El nombre y apellido no pueden estar vacíos.';
      return;
    }

    this.guardandoPerfil = true;
    this.errorPerfil = '';
    this.mensajeExitoPerfil = '';

    this.usuariosServicio.actualizarPerfil({
      nombre: this.formPerfil.nombre.trim(),
      apellido: this.formPerfil.apellido.trim(),
    }).pipe(
      catchError(err => {
        this.errorPerfil = err?.error?.mensaje || 'Error al actualizar el perfil. Intente nuevamente.';
        return of(null);
      }),
      finalize(() => { this.guardandoPerfil = false; }),
      takeUntil(this.destruir$)
    ).subscribe(usuario => {
      if (usuario) {
        this.mensajeExitoPerfil = 'Perfil actualizado correctamente.';
        setTimeout(() => { this.mensajeExitoPerfil = ''; }, 4000);
      }
    });
  }

  cambiarContrasena(): void {
    if (!this.formContrasena.actual.trim() || !this.formContrasena.nueva.trim()) {
      this.errorContrasena = 'Todos los campos de contraseña son obligatorios.';
      return;
    }
    if (this.formContrasena.nueva !== this.formContrasena.confirmar) {
      this.errorContrasena = 'La nueva contraseña y su confirmación no coinciden.';
      return;
    }
    if (this.formContrasena.nueva.length < 6) {
      this.errorContrasena = 'La nueva contraseña debe tener al menos 6 caracteres.';
      return;
    }

    this.guardandoContrasena = true;
    this.errorContrasena = '';
    this.mensajeExitoContrasena = '';

    this.usuariosServicio.cambiarContrasena(
      this.formContrasena.actual,
      this.formContrasena.nueva
    ).pipe(
      catchError(err => {
        this.errorContrasena = err?.error?.mensaje || 'Error al cambiar la contraseña. Verifique la contraseña actual.';
        return of(null);
      }),
      finalize(() => { this.guardandoContrasena = false; }),
      takeUntil(this.destruir$)
    ).subscribe(res => {
      if (res !== null) {
        this.mensajeExitoContrasena = 'Contraseña cambiada exitosamente.';
        this.formContrasena = { actual: '', nueva: '', confirmar: '' };
        setTimeout(() => { this.mensajeExitoContrasena = ''; }, 5000);
      }
    });
  }
}
