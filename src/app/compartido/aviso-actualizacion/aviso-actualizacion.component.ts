import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { VersionServicio } from '../../nucleo/servicios/version.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

// 2026-10-09 (idea de Cristopher): cuando se publica una versión nueva, el
// bot aparece en la mitad de la pantalla y saluda por el nombre ("¡Hola,
// Anyi! Buenos días...") pidiendo recargar. Se puede arrastrar a un lado
// para terminar lo que se está haciendo, y al recargar desaparece solo.
// NO le sale al Super Admin (es quien publica). Para verlo de prueba:
// abrir cualquier pantalla con ?probar-aviso al final de la dirección.
const AVISO_SUPER_VISTO = 'anturi_aviso_actualizacion_super_visto';

@Component({
  selector: 'anturi-aviso-actualizacion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible" class="aviso" [class.aviso--arrastrando]="arrastrando" [class.aviso--esquina]="enEsquina"
      [style.left.px]="x" [style.top.px]="y" (pointerdown)="iniciarArrastre($event)" role="dialog" aria-live="polite">
      <div class="aviso__bot">
        <video #videoAviso src="/assets/bot/bot-anturi.mp4" poster="/assets/bot/bot-anturi-poster.jpg"
          autoplay loop muted playsinline disablepictureinpicture [muted]="true"
          (loadedmetadata)="iniciarVideo(videoAviso)" (canplay)="iniciarVideo(videoAviso)"></video>
      </div>

      <div class="aviso__nube">
        <p class="aviso__saludo">¡Hola, {{ nombre }}! {{ saludo }} 👋</p>
        <ng-container *ngIf="!enEsquina && debeVolverAEntrar">
          <p class="aviso__texto">Hay una <b>nueva actualización</b>. Esta vez, por favor <b>cierre sesión y vuelva a entrar</b> con su contraseña: así la página queda lista para seguir trabajando aunque se vaya el internet.</p>
          <p class="aviso__nota">Solo esta vez; las próximas actualizaciones son solo recargar. Si está en medio de algo, puede arrastrarme a un lado y hacerlo cuando termine. ¡{{ despedida }}!</p>
        </ng-container>
        <ng-container *ngIf="!enEsquina && !debeVolverAEntrar">
          <p class="aviso__texto">Hay una <b>nueva actualización</b> de la plataforma. Por favor recargue la página para tenerla.</p>
          <p class="aviso__nota">Si está en medio de algo, puede arrastrarme a un lado y recargar cuando termine. ¡{{ despedida }}!</p>
        </ng-container>
        <p *ngIf="enEsquina" class="aviso__texto">{{ debeVolverAEntrar ? 'Recuerde cerrar sesión y volver a entrar 😊' : 'Recuerde recargar la página 😊' }}</p>
        <div class="aviso__acciones">
          <button *ngIf="debeVolverAEntrar" type="button" class="aviso__btn aviso__btn--recargar" (pointerdown)="$event.stopPropagation()" (click)="cerrarYEntrar()">
            Cerrar sesión y volver a entrar
          </button>
          <button *ngIf="!debeVolverAEntrar" type="button" class="aviso__btn aviso__btn--recargar" (pointerdown)="$event.stopPropagation()" (click)="recargar()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
              <polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            Recargar ahora
          </button>
          <button *ngIf="!enEsquina" type="button" class="aviso__btn aviso__btn--lado" (pointerdown)="$event.stopPropagation()" (click)="moverALaEsquina()">
            Moverme a un lado
          </button>
          <button *ngIf="enEsquina" type="button" class="aviso__btn aviso__btn--lado" (pointerdown)="$event.stopPropagation()" (click)="centrar()">
            Ver aviso
          </button>
        </div>
      </div>
      <span class="aviso__agarre" title="Arrástreme a donde quiera">⋮⋮</span>
    </div>
  `,
  styles: [`
    .aviso {
      position: fixed;
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 14px;
      width: min(500px, calc(100vw - 24px));
      padding: 16px 18px 16px 16px;
      background: var(--fondo-tarjeta, #fff);
      border: 2px solid var(--color-primario, #1B3270);
      border-radius: 22px;
      box-shadow: 0 24px 60px rgba(27, 50, 112, 0.35), 0 0 0 6px rgba(232, 87, 12, 0.12);
      cursor: grab;
      touch-action: none;
      user-select: none;
      animation: avisoEntrar 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
    }
    .aviso--arrastrando { cursor: grabbing; box-shadow: 0 30px 70px rgba(27, 50, 112, 0.45); }
    .aviso--esquina { width: min(320px, calc(100vw - 24px)); padding: 10px 14px 10px 10px; }

    .aviso__bot {
      flex-shrink: 0;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--color-secundario, #E8570C);
      transform: translateZ(0);
    }
    .aviso--esquina .aviso__bot { width: 64px; height: 64px; }
    .aviso__bot video { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }

    .aviso__nube {
      position: relative;
      flex: 1;
      min-width: 0;
      padding: 12px 14px;
      background: rgba(27, 50, 112, 0.05);
      border-radius: 16px 16px 16px 4px;
    }
    /* colita de la nube apuntando al bot */
    .aviso__nube::before {
      content: '';
      position: absolute;
      left: -10px;
      top: 24px;
      border-style: solid;
      border-width: 8px 10px 8px 0;
      border-color: transparent rgba(27, 50, 112, 0.05) transparent transparent;
    }
    .aviso__saludo { margin: 0 0 6px; font-size: 18px; font-weight: 800; color: var(--color-primario, #1B3270); line-height: 1.25; }
    .aviso--esquina .aviso__saludo { font-size: 14px; margin-bottom: 2px; }
    .aviso__texto { margin: 0 0 6px; font-size: 14px; color: var(--texto-principal, #1f2937); line-height: 1.45; }
    .aviso__texto b { color: var(--color-secundario, #E8570C); }
    .aviso__nota { margin: 0 0 10px; font-size: 12.5px; color: var(--texto-secundario, #6b7280); line-height: 1.4; }
    .aviso__acciones { display: flex; gap: 8px; flex-wrap: wrap; }
    .aviso__btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 700; cursor: pointer;
      border: 2px solid transparent; transition: transform 0.15s, background 0.15s;
    }
    .aviso__btn:hover { transform: translateY(-1px); }
    .aviso__btn--recargar { background: var(--color-secundario, #E8570C); color: #fff; }
    .aviso__btn--recargar:hover { background: #c94a08; }
    .aviso__btn--lado { background: transparent; color: var(--color-primario, #1B3270); border-color: var(--color-primario, #1B3270); }
    .aviso--esquina .aviso__btn { padding: 6px 10px; font-size: 12px; }
    .aviso__agarre { position: absolute; top: 6px; right: 10px; font-size: 14px; letter-spacing: -2px; color: var(--texto-terciario, #9ca3af); }

    @keyframes avisoEntrar {
      from { opacity: 0; transform: scale(0.85) translateY(20px); }
      to { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) { .aviso { animation: none; } }

    @media (max-width: 480px) {
      .aviso { flex-direction: column; text-align: center; }
      .aviso__bot { width: 96px; height: 96px; }
      .aviso__nube { border-radius: 16px; }
      .aviso__nube::before { left: 50%; top: -10px; margin-left: -8px; border-width: 0 8px 10px 8px; border-color: transparent transparent rgba(27, 50, 112, 0.05) transparent; }
      .aviso__acciones { justify-content: center; }
      .aviso--esquina { flex-direction: row; text-align: left; }
      .aviso--esquina .aviso__nube::before { display: none; }
    }
  `],
})
export class AvisoActualizacionComponent implements OnInit, OnDestroy {
  visible = false;
  enEsquina = false;
  x = 0;
  y = 0;
  arrastrando = false;
  private offX = 0;
  private offY = 0;
  private sub?: Subscription;

  constructor(private version: VersionServicio, private auth: AutenticacionServicio, private host: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    const prueba = /[?&]probar-aviso\b/.test(window.location.search);
    this.sub = this.version.versionNueva$.subscribe((nueva) => {
      const u = this.auth.usuarioActual;
      // Al Super Admin no le sale (es quien publica), salvo en modo prueba.
      // 2026-10-09: excepción de UNA sola vez para que Cristopher lo vea en
      // vivo - después de verlo queda marcado y no le vuelve a salir.
      const unaVezSuper = !!u && u.rol === 'SUPER_ADMIN' && !this.leer(AVISO_SUPER_VISTO);
      const corresponde = !!u && this.auth.estaAutenticado && (u.rol !== 'SUPER_ADMIN' || unaVezSuper);
      if ((nueva && corresponde) || (prueba && !!u)) {
        if (nueva && unaVezSuper) this.guardar(AVISO_SUPER_VISTO);
        this.mostrar();
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private leer(clave: string): string | null {
    try { return localStorage.getItem(clave); } catch { return null; }
  }

  private guardar(clave: string): void {
    try { localStorage.setItem(clave, '1'); } catch { /* sin almacenamiento */ }
  }

  get nombre(): string {
    const n = (this.auth.usuarioActual?.nombre || '').trim().split(/\s+/)[0] || '';
    if (/^crist[oó]pher$/i.test(n)) return 'Cris'; // así le gusta que lo saluden
    return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : '';
  }

  get saludo(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  get despedida(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Que tenga un buen día' : h < 19 ? 'Que tenga una buena tarde' : 'Que tenga una buena noche';
  }

  iniciarVideo(v: HTMLVideoElement): void {
    v.muted = true;
    if (v.paused) v.play().catch(() => undefined);
  }

  private mostrar(): void {
    if (this.visible) return;
    this.visible = true;
    this.centrar();
  }

  centrar(): void {
    this.enEsquina = false;
    const ancho = Math.min(500, window.innerWidth - 24);
    this.x = Math.max(12, (window.innerWidth - ancho) / 2);
    this.y = Math.max(12, window.innerHeight / 2 - 110);
    setTimeout(() => {
      const el = this.host.nativeElement.querySelector<HTMLElement>('.aviso');
      if (el) this.y = Math.max(12, (window.innerHeight - el.offsetHeight) / 2);
    });
  }

  moverALaEsquina(): void {
    this.enEsquina = true;
    const ancho = Math.min(320, window.innerWidth - 24);
    this.x = 12;
    this.y = Math.max(12, window.innerHeight - 160);
    if (ancho > window.innerWidth) this.x = 0;
    // ya en tamaño pequeño, se mide de verdad y se pega abajo sin cortarse
    setTimeout(() => this.ajustarDentro(true));
  }

  private ajustarDentro(pegarAbajo = false): void {
    const el = this.host.nativeElement.querySelector<HTMLElement>('.aviso');
    if (!el) return;
    const alto = el.offsetHeight, ancho = el.offsetWidth;
    if (pegarAbajo) this.y = window.innerHeight - alto - 12;
    this.x = Math.max(0, Math.min(this.x, window.innerWidth - ancho));
    this.y = Math.max(0, Math.min(this.y, window.innerHeight - alto));
  }

  recargar(): void {
    this.version.recargar();
  }

  // 2026-10-09: la copia para trabajar sin internet se protege con la
  // contraseña al entrar - quien todavía no la tiene en este equipo debe
  // volver a entrar una vez (después, siempre es solo recargar).
  get debeVolverAEntrar(): boolean {
    const u = this.auth.usuarioActual;
    if (!u?.id || u.rol === 'SUPER_ADMIN') return false; // el Super Admin no guarda copia sin internet
    try { return !localStorage.getItem(`anturi_llave_local_${u.id}`); } catch { return false; }
  }

  cerrarYEntrar(): void {
    this.auth.cerrarSesion();
    setTimeout(() => this.version.recargar(), 300);
  }

  iniciarArrastre(e: PointerEvent): void {
    this.arrastrando = true;
    this.offX = e.clientX - this.x;
    this.offY = e.clientY - this.y;
    e.preventDefault();
  }

  @HostListener('document:pointermove', ['$event'])
  mover(e: PointerEvent): void {
    if (!this.arrastrando) return;
    this.x = Math.max(0, Math.min(e.clientX - this.offX, window.innerWidth - 120));
    this.y = Math.max(0, Math.min(e.clientY - this.offY, window.innerHeight - 80));
  }

  @HostListener('document:pointerup')
  soltar(): void {
    if (!this.arrastrando) return;
    this.arrastrando = false;
    this.ajustarDentro();
  }
}
