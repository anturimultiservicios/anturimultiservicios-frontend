import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, finalize } from 'rxjs';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';
import { UsuariosServicio } from '../../nucleo/servicios/usuarios.servicio';
import { ConfigSistemaServicio, ConfigSistema, ResumenAvisosCobro } from '../../nucleo/servicios/config-sistema.servicio';

import { TemaServicio } from '../../nucleo/servicios/tema.servicio';
import { CodigoIngresoComponent } from './codigo-ingreso.component';
@Component({
  selector: 'anturi-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule, CodigoIngresoComponent],
  template: `
    <div class="config-contenedor">
      <h2 class="pagina-titulo">Configuración</h2>

      <!-- 2026-10-09: seguridad del Super Admin (código de Google Authenticator al ingresar) -->
      <anturi-codigo-ingreso *ngIf="auth.usuarioActual?.rol === 'SUPER_ADMIN'"></anturi-codigo-ingreso>

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
          <!-- 2026-10-09: foto opcional - si no hay, queda la inicial -->
          <div class="avatar-acciones">
            <label class="boton boton-secundario boton-sm avatar-subir">
              {{ subiendoFoto ? 'Guardando...' : (auth.usuarioActual?.fotoPerfil ? 'Cambiar foto' : 'Subir foto') }}
              <input type="file" accept="image/png,image/jpeg,image/webp" (change)="elegirFoto($event)" [disabled]="subiendoFoto" hidden>
            </label>
            <button *ngIf="auth.usuarioActual?.fotoPerfil" type="button" class="boton boton-texto boton-sm" (click)="quitarFoto()" [disabled]="subiendoFoto">Quitar</button>
          </div>
          <div *ngIf="errorFoto" class="mensaje-error">{{ errorFoto }}</div>
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
              <label class="campo-etiqueta">Usuario para entrar</label>
              <input
                type="email"
                class="campo-input"
                [value]="auth.usuarioActual?.correo || ''"
                readonly
                style="background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.04)); cursor: not-allowed;"
              >
              <span class="campo-ayuda">Este es su usuario de ingreso y no cambia.</span>
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

      <!-- 2026-10-09: modo oscuro en blanco y negro (preferencia de cada persona) -->
      <div class="tarjeta config-seccion">
        <h3 class="seccion-titulo">Apariencia</h3>
        <label class="permiso-check">
          <input type="checkbox" [checked]="tema.blancoNegro" (change)="tema.blancoNegro = $any($event.target).checked">
          Modo oscuro (luna) en blanco y negro
        </label>
        <p class="campo-ayuda">Fondo negro y letras blancas; el rojo queda solo para alertas y el bot sigue a color. Se activa con la luna de arriba.</p>
      </div>

      <!-- Sección: correo para recuperar la contraseña (2026-10-09) -->
      <div class="tarjeta config-seccion">
        <h3 class="seccion-titulo">Correo para recuperar la contraseña</h3>
        <p class="campo-ayuda" style="margin-bottom: var(--espacio-3);">
          Si olvida la contraseña, el enlace para recuperarla llega a este correo personal.
        </p>
        <div *ngIf="errorCorreoRec" class="alerta-error">{{ errorCorreoRec }}</div>
        <div *ngIf="exitoCorreoRec" class="alerta-exito">{{ exitoCorreoRec }}</div>
        <form (ngSubmit)="guardarCorreoRecuperacion()">
          <div class="campo-grupo">
            <label class="campo-etiqueta">Correo personal</label>
            <input type="email" class="campo-input" [(ngModel)]="correoRecuperacion" name="correoRecuperacion" placeholder="nombre@gmail.com" autocomplete="email">
          </div>
          <div class="seccion-acciones">
            <button type="submit" class="boton boton-primario" [disabled]="guardandoCorreoRec || !correoRecuperacion.trim()">
              {{ guardandoCorreoRec ? 'Guardando...' : 'Guardar correo' }}
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

      <!-- Sección: Configuración del sistema (solo ADMIN/SUPER_ADMIN) -->
      <div *ngIf="esAdmin" class="tarjeta config-seccion">
        <h3 class="seccion-titulo">Correos de cobro</h3>
        <div *ngIf="cargandoConfig" class="estado-carga-inline">Cargando...</div>
        <div *ngIf="errorConfig" class="alerta-error">{{ errorConfig }}</div>
        <div *ngIf="!cargandoConfig && configSistema">
          <!-- 2026-10-09: interruptor claro. Apagado = no sale ningún correo de cobro ni recordatorio de llamada. -->
          <div class="cobro-estado" [class.cobro-estado--activo]="configSistema.enviarCorreosCobro">
            <div>
              <strong>{{ configSistema.enviarCorreosCobro ? 'Envío de cobros ACTIVO' : 'Envío de cobros APAGADO' }}</strong>
              <p class="campo-ayuda">
                Solo a afiliados activos que no han pagado el mes, con el valor a pagar, 8, 5, 3 y 1 días antes de su fecha
                límite PILA, el mismo día y 1 día después. Nunca a todos a la vez: a cada uno le llega en su fecha.
                Quien no tiene correo aparece en Llamadas.
              </p>
            </div>
            <button type="button" class="boton" [ngClass]="configSistema.enviarCorreosCobro ? 'boton-secundario' : 'boton-primario'"
              (click)="alternarCobros()" [disabled]="cambiandoCobros">
              {{ cambiandoCobros ? 'Un momento...' : (configSistema.enviarCorreosCobro ? 'Apagar envío' : 'Activar envío') }}
            </button>
          </div>

          <div *ngIf="resultadoEnvio" class="alerta-exito" style="margin-top: var(--espacio-3);">{{ resultadoEnvio }}</div>

          <div class="cobro-hoy">
            <div class="cobro-hoy__cabecera">
              <strong>A quién le toca hoy</strong>
              <button type="button" class="boton boton-texto boton-sm" (click)="cargarAvisosHoy()" [disabled]="cargandoAvisos">Actualizar</button>
            </div>
            <div *ngIf="cargandoAvisos" class="estado-carga-inline">Cargando...</div>
            <p *ngIf="!cargandoAvisos && avisosHoy && avisosHoy.lista.length === 0" class="campo-ayuda">Hoy no le toca aviso a nadie.</p>
            <!-- 2026-10-09 (Cristopher): solo el resumen; la lista completa queda detrás de un botón -->
            <div *ngIf="!cargandoAvisos && avisosHoy && avisosHoy.lista.length > 0" class="cobro-resumen">
              <div><b>{{ avisosHoy.lista.length }}</b><span>afiliados</span></div>
              <div><b>{{ porCorreo }}</b><span>por correo</span></div>
              <div><b>{{ porLlamada }}</b><span>por llamada</span></div>
              <div><b>{{ totalAvisos | currency:'COP':'symbol-narrow':'1.0-0' }}</b><span>por cobrar</span></div>
            </div>
            <button *ngIf="!cargandoAvisos && avisosHoy && avisosHoy.lista.length > 0" type="button" class="boton boton-texto boton-sm" (click)="verListaAvisos = !verListaAvisos">
              {{ verListaAvisos ? 'Ocultar la lista' : 'Ver la lista (' + avisosHoy.lista.length + ')' }}
            </button>
            <div *ngIf="verListaAvisos && !cargandoAvisos && avisosHoy && avisosHoy.lista.length > 0" class="tabla-scroll">
              <table class="tabla-cobro">
                <thead><tr><th>Afiliado</th><th>Vence</th><th>Valor</th><th>Por</th></tr></thead>
                <tbody>
                  <tr *ngFor="let a of avisosHoy.lista">
                    <td>{{ a.nombre }}<br><small>{{ a.documento }}</small></td>
                    <td>{{ a.fechaLimite | date:'dd/MM' }} <small>({{ textoDias(a.diasParaPagar) }})</small></td>
                    <td>{{ a.valor | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                    <td>{{ a.canal === 'CORREO' ? a.correo : 'Llamada (sin correo)' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p class="campo-ayuda" style="margin-top: var(--espacio-4);">El correo de prueba va solo a: {{ configSistema.correoTestDestinatario }}</p>
          <div class="seccion-acciones">
            <button class="boton boton-secundario" (click)="probarCorreo()" [disabled]="probandoCorreo">
              <span *ngIf="probandoCorreo" class="spinner-inline"></span>
              {{ probandoCorreo ? 'Enviando...' : 'Enviar correo de prueba' }}
            </button>
          </div>
          <div *ngIf="mensajeExitoConfig" class="alerta-exito" style="margin-top: var(--espacio-3);">{{ mensajeExitoConfig }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cobro-estado { display: flex; gap: var(--espacio-4); align-items: center; justify-content: space-between; flex-wrap: wrap; padding: var(--espacio-4); border-radius: var(--radio-md); border: 1px solid var(--borde-color); background: rgba(0,0,0,0.02); }
    .cobro-estado--activo { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.08); }
    .cobro-estado > div { flex: 1 1 260px; }
    .cobro-hoy { margin-top: var(--espacio-4); }
    .cobro-resumen { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--espacio-2); margin-bottom: var(--espacio-2); }
    .cobro-resumen div { background: var(--fondo-tarjeta-hover, #f3f5f9); border-radius: var(--radio-md); padding: 10px 12px; display: flex; flex-direction: column; }
    .cobro-resumen b { font-size: var(--tamano-lg); color: var(--texto-principal); }
    .cobro-resumen span { font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .cobro-hoy__cabecera { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espacio-2); }
    .tabla-scroll { overflow-x: auto; }
    .tabla-cobro { width: 100%; border-collapse: collapse; font-size: var(--tamano-sm); }
    .tabla-cobro th, .tabla-cobro td { padding: var(--espacio-2); border-bottom: 1px solid var(--borde-color); text-align: left; vertical-align: top; }
    .tabla-cobro th { color: var(--texto-secundario); font-weight: 600; white-space: nowrap; }
    .tabla-cobro small { color: var(--texto-terciario); }
    .config-contenedor { display: flex; flex-direction: column; gap: var(--espacio-6); max-width: 700px; }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }

    /* Avatar perfil */
    .config-perfil { display: flex; align-items: center; gap: var(--espacio-5); padding: var(--espacio-6); }
    .perfil-avatar-grande { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: var(--espacio-2); }
    .avatar-acciones { display: flex; gap: var(--espacio-1); flex-wrap: wrap; justify-content: center; }
    .avatar-subir { cursor: pointer; }
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

    .permiso-check { display: flex; align-items: center; gap: var(--espacio-2); font-size: var(--tamano-sm); color: var(--texto-principal); margin-bottom: var(--espacio-2); cursor: pointer; }
    .permiso-check input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-primario); }
    .estado-carga-inline { color: var(--texto-terciario); font-size: var(--tamano-sm); }
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

  configSistema: ConfigSistema | null = null;
  cargandoConfig = false;
  errorConfig = '';
  mensajeExitoConfig = '';
  probandoCorreo = false;

  private destruir$ = new Subject<void>();

  constructor(
    public auth: AutenticacionServicio,
    public tema: TemaServicio,
    private usuariosServicio: UsuariosServicio,
    private configSistemaServicio: ConfigSistemaServicio,
  ) {}

  get esAdmin(): boolean {
    return this.auth.tieneRol(['ADMIN', 'SUPER_ADMIN']);
  }

  // ── Foto de perfil (opcional) ──
  subiendoFoto = false;
  errorFoto = '';

  elegirFoto(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    if (!/^image\/(png|jpeg|webp)$/.test(archivo.type)) {
      this.errorFoto = 'Use una imagen PNG, JPG o WEBP.';
      return;
    }
    this.errorFoto = '';
    this.subiendoFoto = true;
    this.reducirImagen(archivo, 256)
      .then((dataUrl) => this.guardarFoto(dataUrl))
      .catch(() => { this.subiendoFoto = false; this.errorFoto = 'No se pudo leer la imagen.'; });
  }

  quitarFoto(): void {
    this.subiendoFoto = true;
    this.guardarFoto('');
  }

  private guardarFoto(fotoPerfil: string): void {
    this.usuariosServicio.actualizarPerfil({ fotoPerfil }).pipe(
      catchError((err) => { this.errorFoto = err?.error?.message || 'No se pudo guardar la foto.'; return of(null); }),
      finalize(() => { this.subiendoFoto = false; }),
      takeUntil(this.destruir$),
    ).subscribe((u) => {
      if (u) this.auth.actualizarUsuarioLocal({ fotoPerfil: u.fotoPerfil || undefined });
    });
  }

  // La foto se recorta al centro (cuadrada) y se reduce a 256 px en el
  // navegador: pesa unos pocos KB y se ve nítida en el círculo.
  private reducirImagen(archivo: File, lado: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => {
        const corte = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = lado;
        canvas.height = lado;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); reject(); return; }
        ctx.drawImage(img, (img.width - corte) / 2, (img.height - corte) / 2, corte, corte, 0, 0, lado, lado);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }

  // ── Correo de recuperación ──
  correoRecuperacion = '';
  guardandoCorreoRec = false;
  errorCorreoRec = '';
  exitoCorreoRec = '';

  private cargarCorreoRecuperacion(): void {
    this.usuariosServicio.obtenerCorreoRecuperacion().pipe(
      catchError(() => of(null)),
      takeUntil(this.destruir$),
    ).subscribe((r) => { this.correoRecuperacion = r?.correoRecuperacion ?? ''; });
  }

  guardarCorreoRecuperacion(): void {
    const correo = this.correoRecuperacion.trim();
    if (!correo) return;
    this.guardandoCorreoRec = true;
    this.errorCorreoRec = '';
    this.exitoCorreoRec = '';
    this.usuariosServicio.registrarCorreoRecuperacion(correo).pipe(
      catchError((err) => {
        const m = err?.error?.message;
        this.errorCorreoRec = (Array.isArray(m) ? m[0] : m) || 'No se pudo guardar el correo.';
        return of(null);
      }),
      finalize(() => { this.guardandoCorreoRec = false; }),
      takeUntil(this.destruir$),
    ).subscribe((r) => {
      if (r) {
        this.correoRecuperacion = r.correoRecuperacion;
        this.exitoCorreoRec = 'Correo de recuperación actualizado.';
        setTimeout(() => { this.exitoCorreoRec = ''; }, 4000);
      }
    });
  }

  ngOnInit(): void {
    this.cargarCorreoRecuperacion();
    const u = this.auth.usuarioActual;
    if (u) {
      this.formPerfil.nombre = u.nombre;
      this.formPerfil.apellido = u.apellido;
    }
    if (this.esAdmin) {
      this.cargarConfigSistema();
    }
  }

  cargarConfigSistema(): void {
    this.cargandoConfig = true;
    this.errorConfig = '';
    this.configSistemaServicio.obtener().pipe(
      catchError(() => { this.errorConfig = 'Error al cargar la configuración del sistema.'; return of(null); }),
      finalize(() => { this.cargandoConfig = false; }),
      takeUntil(this.destruir$),
    ).subscribe((cfg) => { this.configSistema = cfg; });
    this.cargarAvisosHoy();
  }

  // ── Correos de cobro: vista previa y activación ──
  avisosHoy: ResumenAvisosCobro | null = null;
  verListaAvisos = false;

  get porCorreo(): number { return this.avisosHoy?.lista.filter((a) => a.canal === 'CORREO').length ?? 0; }
  get porLlamada(): number { return (this.avisosHoy?.lista.length ?? 0) - this.porCorreo; }
  get totalAvisos(): number { return (this.avisosHoy?.lista ?? []).reduce((t, a) => t + (Number(a.valor) || 0), 0); }
  cargandoAvisos = false;
  cambiandoCobros = false;
  resultadoEnvio = '';

  cargarAvisosHoy(): void {
    this.cargandoAvisos = true;
    this.configSistemaServicio.avisosCobroHoy().pipe(
      catchError(() => of(null)),
      finalize(() => { this.cargandoAvisos = false; }),
      takeUntil(this.destruir$),
    ).subscribe((r) => { this.avisosHoy = r; });
  }

  textoDias(d: number): string {
    if (d === 0) return 'hoy';
    if (d === -1) return 'venció ayer';
    return d === 1 ? 'falta 1 día' : `faltan ${d} días`;
  }

  alternarCobros(): void {
    if (!this.configSistema) return;
    const activar = !this.configSistema.enviarCorreosCobro;
    if (activar) {
      const n = this.avisosHoy?.lista.filter((a) => a.canal === 'CORREO').length ?? 0;
      const ok = confirm(`¿Activar el envío de cobros?\n\nHoy saldrían ${n} correo(s) a quienes les toca según su fecha. Desde mañana se envían solos cada día a las 8 a. m.`);
      if (!ok) return;
    }
    this.cambiandoCobros = true;
    this.errorConfig = '';
    this.resultadoEnvio = '';
    this.configSistemaServicio.actualizar(activar).pipe(
      catchError((err) => { this.errorConfig = err?.error?.message || 'No se pudo cambiar el envío.'; return of(null); }),
      takeUntil(this.destruir$),
    ).subscribe((cfg) => {
      if (!cfg) { this.cambiandoCobros = false; return; }
      this.configSistema = cfg;
      if (!activar) {
        this.cambiandoCobros = false;
        this.resultadoEnvio = 'Envío de cobros apagado. No saldrá ningún correo de cobro.';
        return;
      }
      // Recién activado: se envían ya los de hoy (los que ya salieron no se repiten).
      this.configSistemaServicio.ejecutarAvisosCobro().pipe(
        catchError(() => of(null)),
        finalize(() => { this.cambiandoCobros = false; }),
        takeUntil(this.destruir$),
      ).subscribe((r) => {
        this.resultadoEnvio = r
          ? `Envío activado. Hoy: ${r.correosEnviados} correo(s) enviado(s)` +
            (r.yaEnviados ? `, ${r.yaEnviados} ya se habían enviado` : '') +
            (r.sinCorreo ? `, ${r.sinCorreo} sin correo (quedan en Llamadas)` : '') +
            (r.errores ? `, ${r.errores} no se pudieron enviar (se reintenta)` : '') + '.'
          : 'Envío activado. Los correos de hoy se enviarán en el próximo ciclo.';
        this.cargarAvisosHoy();
      });
    });
  }

  guardarConfigSistema(): void {
    if (!this.configSistema) return;
    this.errorConfig = '';
    this.configSistemaServicio.actualizar(this.configSistema.enviarCorreosCobro).pipe(
      catchError((err) => {
        this.errorConfig = err?.error?.message || 'Error al guardar la configuración.';
        if (this.configSistema) this.configSistema.enviarCorreosCobro = !this.configSistema.enviarCorreosCobro;
        return of(null);
      }),
      takeUntil(this.destruir$),
    ).subscribe((cfg) => {
      if (cfg) {
        this.configSistema = cfg;
        this.mensajeExitoConfig = 'Configuración guardada correctamente.';
        setTimeout(() => { this.mensajeExitoConfig = ''; }, 4000);
      }
    });
  }

  probarCorreo(): void {
    this.probandoCorreo = true;
    this.errorConfig = '';
    this.configSistemaServicio.enviarCorreoTest().pipe(
      catchError((err) => { this.errorConfig = err?.error?.message || 'Error al enviar el correo de prueba.'; return of(null); }),
      finalize(() => { this.probandoCorreo = false; }),
      takeUntil(this.destruir$),
    ).subscribe((res) => {
      if (res) {
        this.mensajeExitoConfig = res.mensaje;
        setTimeout(() => { this.mensajeExitoConfig = ''; }, 5000);
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
      SECRETARIA: 'Asistente',
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
        this.errorPerfil = err?.error?.message || 'Error al actualizar el perfil. Intente nuevamente.';
        return of(null);
      }),
      finalize(() => { this.guardandoPerfil = false; }),
      takeUntil(this.destruir$)
    ).subscribe(usuario => {
      if (usuario) {
        this.auth.actualizarUsuarioLocal({ nombre: usuario.nombre, apellido: usuario.apellido });
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
        this.errorContrasena = err?.error?.message || 'Error al cambiar la contraseña. Verifique la contraseña actual.';
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
