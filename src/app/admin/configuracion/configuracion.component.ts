import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, finalize } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';
import { UsuariosServicio } from '../../nucleo/servicios/usuarios.servicio';
import { entorno } from '../../../environments/entorno';

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
          <div class="avatar-wrap" (click)="inputFoto.click()" title="Cambiar foto de perfil">
            <img
              *ngIf="auth.usuarioActual?.fotoPerfil"
              [src]="auth.usuarioActual!.fotoPerfil"
              [alt]="auth.usuarioActual?.nombre"
              class="avatar-imagen"
            >
            <div *ngIf="!auth.usuarioActual?.fotoPerfil" class="avatar-inicial-grande">
              {{ (auth.usuarioActual?.nombre || '?').charAt(0).toUpperCase() }}
            </div>
            <div class="avatar-overlay">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              <span>{{ subiendoFoto ? 'Subiendo...' : 'Cambiar foto' }}</span>
            </div>
          </div>
          <input #inputFoto type="file" accept="image/png,image/jpeg,image/webp" style="display:none" (change)="onFotoSeleccionada($event)">
          <p *ngIf="errorFoto" class="foto-error">{{ errorFoto }}</p>
        </div>
        <div class="perfil-info">
          <h3 class="perfil-nombre">
            {{ auth.usuarioActual?.rol === 'SUPER_ADMIN' ? auth.usuarioActual?.nombre : (auth.usuarioActual?.nombre + ' ' + auth.usuarioActual?.apellido) }}
          </h3>
          <p class="perfil-correo">{{ auth.usuarioActual?.correo }}</p>
          <span *ngIf="auth.usuarioActual?.rol !== 'SUPER_ADMIN'" class="badge-rol" [ngClass]="claseBadgeRol(auth.usuarioActual?.rol || '')">
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

      <!-- Sección: Notificaciones de cobro -->
      <div class="tarjeta config-seccion">
        <h3 class="seccion-titulo">Notificaciones de cobro</h3>
        <p class="seccion-desc">
          Cuando está activo, el sistema envía automáticamente correos de recordatorio de pago
          a los afiliados según su fecha de pago. Si no está marcado, no se envía ningún correo.
        </p>
        <div class="toggle-fila">
          <label class="toggle-etiqueta" for="toggleCorreos">
            <span class="toggle-icono" [class.activo]="enviarCorreosCobro">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85A16 16 0 0 0 16 17l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </span>
            <span>
              <strong>{{ enviarCorreosCobro ? 'Correos de cobro ACTIVOS' : 'Correos de cobro INACTIVOS' }}</strong><br>
              <span class="toggle-sub">{{ enviarCorreosCobro ? 'Se están enviando recordatorios según fechas de pago.' : 'No se está enviando ningún correo de cobro.' }}</span>
            </span>
          </label>
          <div class="toggle-control">
            <input
              type="checkbox"
              id="toggleCorreos"
              class="toggle-checkbox"
              [(ngModel)]="enviarCorreosCobro"
              (change)="guardarToggleCorreos()"
            >
            <label for="toggleCorreos" class="toggle-slider" [class.activo]="enviarCorreosCobro"></label>
          </div>
        </div>
        <div class="toggle-acciones">
          <button class="boton boton-secundario" (click)="enviarCorreoTest()" [disabled]="enviandoTest">
            <span *ngIf="enviandoTest" class="spinner-inline" style="border-top-color: var(--color-primario);"></span>
            {{ enviandoTest ? 'Enviando...' : 'Enviar correo de prueba a mi correo' }}
          </button>
          <span *ngIf="mensajeTest" class="texto-exito">{{ mensajeTest }}</span>
          <span *ngIf="errorTest" class="texto-error">{{ errorTest }}</span>
        </div>
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
    .perfil-avatar-grande { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: var(--espacio-2); }
    .avatar-wrap { position: relative; cursor: pointer; border-radius: 50%; overflow: hidden; }
    .avatar-wrap:hover .avatar-overlay { opacity: 1; }
    .avatar-imagen { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid var(--color-primario); display: block; }
    .avatar-inicial-grande { width: 80px; height: 80px; border-radius: 50%; background: rgba(27,50,112,0.12); color: var(--color-primario); display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 800; border: 3px solid rgba(27,50,112,0.2); }
    .avatar-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.55); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: white; font-size: 0.65rem; font-weight: 600; opacity: 0; transition: opacity 0.2s; }
    .foto-error { font-size: 0.7rem; color: var(--color-error); text-align: center; margin: 0; }
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

    /* Toggle correos */
    .seccion-desc { font-size: var(--tamano-sm); color: var(--texto-secundario); margin: 0 0 var(--espacio-4); line-height: 1.6; }
    .toggle-fila { display: flex; align-items: center; justify-content: space-between; gap: var(--espacio-4); padding: var(--espacio-4); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); border-radius: var(--radio-md); }
    .toggle-etiqueta { display: flex; align-items: center; gap: var(--espacio-3); cursor: pointer; flex: 1; }
    .toggle-icono { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.06); color: var(--texto-terciario); flex-shrink: 0; transition: background 0.2s, color 0.2s; }
    .toggle-icono.activo { background: rgba(34,197,94,0.15); color: #16a34a; }
    .toggle-sub { font-size: var(--tamano-sm); color: var(--texto-terciario); font-weight: 400; }
    .toggle-control { display: flex; align-items: center; flex-shrink: 0; }
    .toggle-checkbox { display: none; }
    .toggle-slider { position: relative; display: inline-block; width: 48px; height: 26px; background: #d1d5db; border-radius: 13px; cursor: pointer; transition: background 0.25s; }
    .toggle-slider::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; background: white; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.25s; }
    .toggle-slider.activo { background: #22c55e; }
    .toggle-slider.activo::after { transform: translateX(22px); }
    .toggle-acciones { display: flex; align-items: center; gap: var(--espacio-3); margin-top: var(--espacio-4); flex-wrap: wrap; }
    .boton-secundario { background: transparent; border: 1px solid var(--borde-color, #d1d5db); color: var(--texto-principal); padding: 8px 16px; border-radius: var(--radio-md); cursor: pointer; font-size: var(--tamano-sm); font-weight: 500; display: flex; align-items: center; gap: var(--espacio-2); transition: background 0.15s; }
    .boton-secundario:hover:not(:disabled) { background: rgba(0,0,0,0.04); }
    .boton-secundario:disabled { opacity: 0.6; cursor: not-allowed; }
    .texto-exito { font-size: var(--tamano-sm); color: #16a34a; font-weight: 500; }
    .texto-error { font-size: var(--tamano-sm); color: var(--color-error); font-weight: 500; }
  `]
})
export class ConfiguracionComponent implements OnInit, OnDestroy {
  formPerfil = { nombre: '', apellido: '' };
  formContrasena = { actual: '', nueva: '', confirmar: '' };

  guardandoPerfil = false;
  guardandoContrasena = false;
  subiendoFoto = false;
  errorPerfil = '';
  errorContrasena = '';
  errorFoto = '';
  mensajeExitoPerfil = '';
  mensajeExitoContrasena = '';

  // Toggle correos de cobro
  enviarCorreosCobro = false;
  enviandoTest = false;
  mensajeTest = '';
  errorTest = '';

  private destruir$ = new Subject<void>();
  private readonly api = entorno.urlApi;

  constructor(
    public auth: AutenticacionServicio,
    private usuariosServicio: UsuariosServicio,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    const u = this.auth.usuarioActual;
    if (u) {
      this.formPerfil.nombre = u.nombre;
      this.formPerfil.apellido = u.apellido;
    }
    this.cargarConfigSistema();
  }

  cargarConfigSistema(): void {
    this.http.get<{ enviarCorreosCobro: boolean }>(`${this.api}/config-sistema`)
      .pipe(takeUntil(this.destruir$), catchError(() => of(null)))
      .subscribe(cfg => {
        if (cfg) this.enviarCorreosCobro = cfg.enviarCorreosCobro;
      });
  }

  guardarToggleCorreos(): void {
    this.http.patch(`${this.api}/config-sistema`, { enviarCorreosCobro: this.enviarCorreosCobro })
      .pipe(takeUntil(this.destruir$), catchError(() => of(null)))
      .subscribe();
  }

  enviarCorreoTest(): void {
    this.enviandoTest = true;
    this.mensajeTest = '';
    this.errorTest = '';
    this.http.get<{ mensaje: string }>(`${this.api}/config-sistema/test-correo`)
      .pipe(
        finalize(() => { this.enviandoTest = false; }),
        catchError(err => {
          this.errorTest = err?.error?.message || 'Error al enviar el correo de prueba.';
          return of(null);
        }),
        takeUntil(this.destruir$),
      )
      .subscribe(res => {
        if (res) {
          this.mensajeTest = '✓ Correo enviado. Revisa tu bandeja de entrada.';
          setTimeout(() => { this.mensajeTest = ''; }, 6000);
        }
      });
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

  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    if (archivo.size > 2 * 1024 * 1024) {
      this.errorFoto = 'La imagen no puede superar 2 MB.';
      return;
    }
    this.errorFoto = '';
    this.subiendoFoto = true;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.usuariosServicio.actualizarPerfil({ fotoPerfil: base64 }).pipe(
        catchError(() => { this.errorFoto = 'Error al subir la foto.'; return of(null); }),
        finalize(() => { this.subiendoFoto = false; input.value = ''; }),
        takeUntil(this.destruir$)
      ).subscribe(u => {
        if (u) {
          this.mensajeExitoPerfil = 'Foto de perfil actualizada.';
          setTimeout(() => { this.mensajeExitoPerfil = ''; }, 4000);
        }
      });
    };
    reader.readAsDataURL(archivo);
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
