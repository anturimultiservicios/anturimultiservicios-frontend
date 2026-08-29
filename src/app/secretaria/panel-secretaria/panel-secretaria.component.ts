import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CalculadoraComponent } from '../../compartido/calculadora/calculadora.component';
import { TemaServicio } from '../../nucleo/servicios/tema.servicio';
import { IdiomaServicio } from '../../nucleo/servicios/idioma.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';
import { SolicitudesServicio } from '../../nucleo/servicios/solicitudes.servicio';
import { Subject, takeUntil, catchError, of, interval } from 'rxjs';

@Component({
  selector: 'anturi-panel-secretaria',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    CalculadoraComponent,
  ],
  template: `
    <div class="escritorio" [class.barra-contraida]="!barraExpandida">

      <!-- Barra lateral -->
      <aside class="barra-lateral" [class.contraida]="!barraExpandida">
        <!-- Logo -->
        <div class="barra-lateral__logo">
          <img src="/assets/imagenes/logo.png" alt="Anturi" class="barra-lateral__logo-img">
          <div class="barra-lateral__logo-texto" *ngIf="barraExpandida">
            <span class="barra-lateral__logo-nombre">ANTURI</span>
            <span class="barra-lateral__logo-sub">MULTISERVICIOS</span>
          </div>
        </div>
        <hr class="separador">
        <nav class="barra-lateral__nav">
          <ul>
            <li>
              <a routerLink="/secretaria/resumen" routerLinkActive="activo" class="barra-lateral__item" [title]="!barraExpandida ? 'Resumen' : ''">
                <span class="barra-lateral__icono">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                </span>
                <span class="barra-lateral__etiqueta" *ngIf="barraExpandida">Resumen</span>
              </a>
            </li>
            <li>
              <a routerLink="/secretaria/afiliados" routerLinkActive="activo" class="barra-lateral__item" [title]="!barraExpandida ? 'Afiliados' : ''">
                <span class="barra-lateral__icono">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </span>
                <span class="barra-lateral__etiqueta" *ngIf="barraExpandida">Afiliados</span>
              </a>
            </li>
            <li>
              <a routerLink="/secretaria/sucursales" routerLinkActive="activo" class="barra-lateral__item" [title]="!barraExpandida ? 'Sucursales' : ''">
                <span class="barra-lateral__icono">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 21h18"></path>
                    <path d="M5 21V7l8-4v18"></path>
                    <path d="M19 21V11l-6-4"></path>
                  </svg>
                </span>
                <span class="barra-lateral__etiqueta" *ngIf="barraExpandida">Sucursales</span>
              </a>
            </li>
            <li>
              <a routerLink="/secretaria/mis-solicitudes" routerLinkActive="activo" class="barra-lateral__item" [title]="!barraExpandida ? 'Mis solicitudes' : ''">
                <span class="barra-lateral__icono" style="position: relative;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <span *ngIf="solicitudesPendientes > 0" class="badge-nav">{{ solicitudesPendientes }}</span>
                </span>
                <span class="barra-lateral__etiqueta" *ngIf="barraExpandida">
                  Mis solicitudes
                  <span *ngIf="solicitudesPendientes > 0" class="badge-nav-texto">{{ solicitudesPendientes }}</span>
                </span>
              </a>
            </li>
            <li>
              <a routerLink="/secretaria/configuracion" routerLinkActive="activo" class="barra-lateral__item" [title]="!barraExpandida ? 'Configuración' : ''">
                <span class="barra-lateral__icono">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </span>
                <span class="barra-lateral__etiqueta" *ngIf="barraExpandida">Configuración</span>
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      <!-- Contenido principal -->
      <div class="escritorio__contenido">
        <!-- Barra superior -->
        <header class="barra-superior">
          <button class="boton-icono barra-superior__menu" (click)="barraExpandida = !barraExpandida">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <div class="barra-superior__derecha">
            <!-- Tiempo de sesión -->
            <div class="sesion-tiempo" title="Tiempo de sesión activa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>{{ tiempoSesion }}</span>
            </div>

            <!-- Tema -->
            <button class="boton-tema" (click)="temaServicio.alternar()">
              <svg *ngIf="!temaServicio.esOscuro" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icono-tema">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
              <svg *ngIf="temaServicio.esOscuro" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icono-tema">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
              </svg>
            </button>

            <!-- Perfil -->
            <div class="perfil-menu" [class.abierto]="menuPerfil">
              <button class="perfil-menu__boton" (click)="menuPerfil = !menuPerfil">
                <div class="perfil-avatar">
                  <img
                    *ngIf="auth.usuarioActual?.fotoPerfil"
                    [src]="auth.usuarioActual?.fotoPerfil"
                    alt="Foto de perfil"
                    class="perfil-avatar__img"
                  >
                  <span *ngIf="!auth.usuarioActual?.fotoPerfil" class="perfil-avatar__inicial">
                    {{ auth.usuarioActual?.nombre?.charAt(0) }}
                  </span>
                </div>
                <div class="perfil-info">
                  <span class="perfil-nombre">{{ nombreCompleto }}</span>
                  <span class="perfil-rol">Secretaria</span>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="selector-idioma__flecha">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <div class="perfil-menu__lista" *ngIf="menuPerfil">
                <a class="perfil-menu__opcion" routerLink="/secretaria/configuracion" (click)="menuPerfil = false">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                  Mi configuración
                </a>
                <hr class="separador">
                <button class="perfil-menu__opcion perfil-menu__opcion-cerrar" (click)="cerrarSesion()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </header>

        <!-- Área de contenido principal -->
        <main class="escritorio__main">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- Calculadora flotante -->
      <anturi-calculadora></anturi-calculadora>

      <!-- Overlay -->
      <div class="escritorio__overlay" *ngIf="menuPerfil" (click)="menuPerfil = false"></div>
    </div>
  `,
  styles: [`
    /* Layout escritorio */
    .escritorio { display: flex; height: 100vh; overflow: hidden; background: var(--fondo-principal, #f1f5f9); }
    .escritorio__contenido { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
    .escritorio__main { flex: 1; overflow-y: auto; padding: var(--espacio-6); }
    .escritorio__overlay { position: fixed; inset: 0; z-index: 99; }

    /* Barra lateral */
    .barra-lateral { width: var(--ancho-barra-lateral, 240px); height: 100vh; position: sticky; top: 0; background: var(--fondo-barra-lateral, #fff); border-right: 1px solid var(--borde-color, #e5e7eb); display: flex; flex-direction: column; overflow: hidden; transition: width 0.25s; flex-shrink: 0; }
    .barra-lateral.contraida { width: var(--ancho-barra-lateral-mini, 64px); }
    .barra-lateral__logo { display: flex; align-items: center; gap: var(--espacio-3); padding: var(--espacio-5) var(--espacio-4); overflow: hidden; flex-shrink: 0; }
    .barra-lateral__logo-img { width: 38px; height: 38px; object-fit: contain; flex-shrink: 0; }
    .barra-lateral__logo-texto { display: flex; flex-direction: column; line-height: 1.1; white-space: nowrap; }
    .barra-lateral__logo-nombre { font-size: var(--tamano-sm); font-weight: 800; color: var(--color-primario); letter-spacing: 0.05em; }
    .barra-lateral__logo-sub { font-size: 0.55rem; font-weight: 600; color: var(--color-secundario); letter-spacing: 0.1em; }
    .barra-lateral__nav { flex: 1; overflow-y: auto; padding: var(--espacio-3); }
    .barra-lateral__nav ul { list-style: none; display: flex; flex-direction: column; gap: var(--espacio-1); }
    .barra-lateral__item { display: flex; align-items: center; gap: var(--espacio-3); padding: var(--espacio-3); border-radius: var(--radio-lg); color: var(--texto-terciario); text-decoration: none; font-size: var(--tamano-sm); font-weight: 500; transition: all 0.15s; white-space: nowrap; overflow: hidden; }
    .barra-lateral__item:hover { background: var(--fondo-tarjeta-hover, rgba(0,0,0,0.04)); color: var(--color-primario); }
    .barra-lateral__item.activo { background: rgba(27,50,112,0.1); color: var(--color-primario); font-weight: 600; position: relative; }
    .barra-lateral__item.activo::before { content: ''; position: absolute; left: 0; top: 25%; bottom: 25%; width: 3px; background: var(--color-primario); border-radius: 0 3px 3px 0; }
    .barra-lateral__icono { display: flex; align-items: center; justify-content: center; width: 22px; flex-shrink: 0; position: relative; }
    .barra-lateral__icono svg { width: 20px; height: 20px; }
    .barra-lateral__etiqueta { white-space: nowrap; display: flex; align-items: center; gap: var(--espacio-2); }
    .barra-lateral.contraida .barra-lateral__item { justify-content: center; padding: var(--espacio-3); }
    .barra-lateral.contraida .barra-lateral__logo { justify-content: center; padding: var(--espacio-5) var(--espacio-3); }

    /* Badges nav */
    .badge-nav { position: absolute; top: -4px; right: -6px; background: var(--color-error); color: white; font-size: 0.6rem; font-weight: 700; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .badge-nav-texto { background: var(--color-error); color: white; font-size: 0.65rem; font-weight: 700; padding: 1px 5px; border-radius: 10px; }

    /* Barra superior */
    .barra-superior { display: flex; align-items: center; padding: 0 var(--espacio-5); height: 60px; background: var(--fondo-barra-superior, #fff); border-bottom: 1px solid var(--borde-color, #e5e7eb); flex-shrink: 0; gap: var(--espacio-3); }
    .barra-superior__menu { margin-right: auto; }
    .barra-superior__derecha { display: flex; align-items: center; gap: var(--espacio-3); margin-left: auto; }
    .boton-icono { background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: var(--espacio-2); border-radius: var(--radio-md); color: var(--texto-secundario); transition: var(--transicion-base); }
    .boton-icono:hover { background: var(--fondo-tarjeta-hover, rgba(0,0,0,0.04)); color: var(--color-primario); }
    .boton-icono svg { width: 20px; height: 20px; }
    .sesion-tiempo { display: flex; align-items: center; gap: var(--espacio-2); font-size: var(--tamano-sm); color: var(--texto-terciario); font-variant-numeric: tabular-nums; }
    .sesion-tiempo svg { width: 14px; height: 14px; }
    .boton-tema { background: none; border: none; cursor: pointer; display: flex; align-items: center; padding: var(--espacio-2); border-radius: var(--radio-md); color: var(--texto-secundario); transition: var(--transicion-base); }
    .boton-tema:hover { background: var(--fondo-tarjeta-hover, rgba(0,0,0,0.04)); color: var(--color-primario); }
    .icono-tema { width: 18px; height: 18px; }

    /* Perfil menú */
    .perfil-menu { position: relative; }
    .perfil-menu__boton { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-2) var(--espacio-3); border-radius: var(--radio-lg); border: none; background: none; cursor: pointer; transition: var(--transicion-base); }
    .perfil-menu__boton:hover { background: var(--fondo-tarjeta-hover, rgba(0,0,0,0.04)); }
    .perfil-avatar { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: rgba(27,50,112,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .perfil-avatar__img { width: 100%; height: 100%; object-fit: cover; }
    .perfil-avatar__inicial { font-size: var(--tamano-sm); font-weight: 700; color: var(--color-primario); }
    .perfil-info { display: flex; flex-direction: column; text-align: left; line-height: 1.2; }
    .perfil-nombre { font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-principal); white-space: nowrap; }
    .perfil-rol { font-size: 0.7rem; color: var(--texto-terciario); }
    .selector-idioma__flecha { width: 14px; height: 14px; color: var(--texto-terciario); }
    .perfil-menu__lista { position: absolute; right: 0; top: calc(100% + var(--espacio-2)); background: var(--fondo-tarjeta, #fff); border: 1px solid var(--borde-color, #e5e7eb); border-radius: var(--radio-xl); box-shadow: var(--sombra-md); min-width: 200px; padding: var(--espacio-2); z-index: 100; }
    .perfil-menu__opcion { display: flex; align-items: center; gap: var(--espacio-3); width: 100%; padding: var(--espacio-2) var(--espacio-3); border-radius: var(--radio-md); background: none; border: none; cursor: pointer; font-size: var(--tamano-sm); color: var(--texto-principal); text-decoration: none; transition: var(--transicion-base); }
    .perfil-menu__opcion:hover { background: var(--fondo-tarjeta-hover, rgba(0,0,0,0.04)); color: var(--color-primario); }
    .perfil-menu__opcion svg { width: 16px; height: 16px; flex-shrink: 0; }
    .perfil-menu__opcion-cerrar { color: var(--color-error); }
    .perfil-menu__opcion-cerrar:hover { background: rgba(239,68,68,0.08); color: var(--color-error); }
  `]
})
export class PanelSecretariaComponent implements OnInit, OnDestroy {
  barraExpandida = true;
  menuPerfil = false;
  tiempoSesion = '';
  solicitudesPendientes = 0;

  private timerSesion: ReturnType<typeof setInterval> | null = null;
  private inicioSesion = new Date();
  private destruir$ = new Subject<void>();

  constructor(
    public temaServicio: TemaServicio,
    public idiomaServicio: IdiomaServicio,
    public auth: AutenticacionServicio,
    private solicitudesServicio: SolicitudesServicio
  ) {}

  ngOnInit(): void {
    this.timerSesion = setInterval(() => {
      const diff = Date.now() - this.inicioSesion.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      this.tiempoSesion = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, 1000);

    // Cargar conteo de solicitudes propias pendientes
    this.cargarSolicitudesPropias();
  }

  ngOnDestroy(): void {
    if (this.timerSesion) clearInterval(this.timerSesion);
    this.destruir$.next();
    this.destruir$.complete();
  }

  private cargarSolicitudesPropias(): void {
    this.solicitudesServicio.listar(undefined, true).pipe(
      catchError(() => of([])),
      takeUntil(this.destruir$)
    ).subscribe(lista => {
      this.solicitudesPendientes = lista.filter(s => s.estado === 'PENDIENTE').length;
    });
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }

  get nombreCompleto(): string {
    const u = this.auth.usuarioActual;
    return u ? `${u.nombre} ${u.apellido}` : '';
  }
}
