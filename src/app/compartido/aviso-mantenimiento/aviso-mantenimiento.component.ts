import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MantenimientoServicio, EstadoMantenimiento } from '../../nucleo/servicios/mantenimiento.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

const CLAVE_INGRESO_ADMIN = 'anturi_mantenimiento_ingreso';
const CLAVE_AVISO_VISTO = 'anturi_mantenimiento_aviso_visto';

// 2026-10-23 (Cristopher): letrero de mantenimiento para TODA la página
// (también la parte pública) y, antes, una franja avisando la hora. Vive en
// AppComponent, afuera del router-outlet. El Super Admin sigue trabajando;
// desde el letrero puede ir al ingreso con "Ingreso de administrador".
@Component({
  selector: 'anturi-aviso-mantenimiento',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="franja-mantenimiento" *ngIf="avisoPrevio">
      🛠️ {{ avisoPrevio }}
    </div>

    <!-- A la hora del aviso: ventana encima de lo que estén haciendo, una sola vez -->
    <div class="ventana-aviso" *ngIf="mostrarVentanaAviso" role="dialog" aria-modal="true">
      <div class="ventana-aviso__tarjeta">
        <div class="ventana-aviso__icono">🛠️</div>
        <h2>Mantenimiento programado</h2>
        <p>Les informamos que <b>{{ cuandoTexto }}</b> la página entrará en mantenimiento para reforzar la seguridad y dejar listos los arreglos pendientes.</p>
        <p>Durante ese tiempo no se podrá ingresar. Por favor guarden su trabajo antes de esa hora.</p>
        <p class="ventana-aviso__firma">Lamentamos los inconvenientes: estamos trabajando para ustedes. ¡Gracias por su comprensión!</p>
        <button type="button" class="boton boton-primario" (click)="cerrarVentanaAviso()">Entendido</button>
      </div>
    </div>

    <div class="pantalla-mantenimiento" *ngIf="mostrarLetrero">
      <div class="pantalla-mantenimiento__tarjeta">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
        <h1>Página en mantenimiento</h1>
        <p>Lamentamos los inconvenientes. Estamos trabajando para ustedes y muy pronto volveremos a estar en servicio.</p>
        <p class="pantalla-mantenimiento__firma">Gracias por su paciencia — Anturi Multiservicios</p>
        <button type="button" class="pantalla-mantenimiento__admin" (click)="ingresoAdministrador()">Ingreso de administrador</button>
      </div>
    </div>
  `,
  styles: [`
    .franja-mantenimiento {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: var(--z-modal);
      background: var(--color-advertencia);
      color: white;
      padding: var(--espacio-2) var(--espacio-4);
      text-align: center;
      font-size: var(--tamano-sm);
      font-weight: 600;
    }

    .ventana-aviso {
      position: fixed;
      inset: 0;
      z-index: 2050;
      background: rgba(15, 23, 42, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--espacio-4);
    }

    .ventana-aviso__tarjeta {
      background: var(--fondo-tarjeta);
      border-radius: var(--radio-2xl);
      padding: var(--espacio-8);
      max-width: 460px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--espacio-3);
      box-shadow: var(--sombra-xl);
    }

    .ventana-aviso__icono { font-size: 48px; }
    .ventana-aviso__tarjeta h2 { margin: 0; color: var(--texto-principal); }
    .ventana-aviso__tarjeta p { margin: 0; color: var(--texto-secundario); line-height: 1.5; }
    .ventana-aviso__firma { font-weight: 600; color: var(--color-primario) !important; }

    .pantalla-mantenimiento {
      position: fixed;
      inset: 0;
      z-index: 2100;
      background: var(--color-primario-oscuro);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--espacio-6);
    }

    .pantalla-mantenimiento__tarjeta {
      background: var(--fondo-tarjeta);
      border-radius: var(--radio-2xl);
      padding: var(--espacio-10);
      max-width: 460px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--espacio-3);
      box-shadow: var(--sombra-xl);
    }

    .pantalla-mantenimiento__tarjeta svg { color: var(--color-secundario); }
    .pantalla-mantenimiento__tarjeta h1 { margin: 0; font-size: var(--tamano-2xl); color: var(--texto-principal); }
    .pantalla-mantenimiento__tarjeta p { margin: 0; color: var(--texto-secundario); line-height: 1.5; }
    .pantalla-mantenimiento__firma { font-weight: 600; color: var(--color-primario) !important; }
    .pantalla-mantenimiento__admin {
      margin-top: var(--espacio-4);
      background: none;
      border: none;
      color: var(--texto-terciario);
      font-size: var(--tamano-xs, 12px);
      text-decoration: underline;
      cursor: pointer;
    }
  `],
})
export class AvisoMantenimientoComponent implements OnInit, OnDestroy {
  mostrarLetrero = false;
  avisoPrevio = '';
  mostrarVentanaAviso = false;
  cuandoTexto = '';

  private estado: EstadoMantenimiento | null = null;
  private destruir$ = new Subject<void>();
  private intervalo: any;

  constructor(
    private mantenimiento: MantenimientoServicio,
    private auth: AutenticacionServicio,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.mantenimiento.estado$.pipe(takeUntil(this.destruir$)).subscribe((e) => {
      this.estado = e;
      this.actualizar();
    });
    this.consultar();
    // Cada minuto: así a las 7:00 en punto aparece el letrero aunque nadie toque nada.
    this.intervalo = setInterval(() => this.consultar(), 60000);
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
    clearInterval(this.intervalo);
  }

  private consultar(): void {
    this.mantenimiento.consultar().subscribe({
      error: () => {
        this.mantenimiento.sinRespuesta();
        this.actualizar();
      },
    });
  }

  private actualizar(): void {
    const e = this.estado;
    const ahora = Date.now();
    const desde = e?.desde ? new Date(e.desde).getTime() : null;
    const activo = !!e && (e.activo || (desde !== null && desde <= ahora));
    const esSuperAdmin = this.auth.usuarioActual?.rol === 'SUPER_ADMIN';
    let ingresoAdmin = false;
    try { ingresoAdmin = sessionStorage.getItem(CLAVE_INGRESO_ADMIN) === '1'; } catch {}
    if (!activo) {
      try { sessionStorage.removeItem(CLAVE_INGRESO_ADMIN); } catch {}
    }
    this.mostrarLetrero = activo && !esSuperAdmin && !ingresoAdmin;

    const aviso = e?.avisoDesde ? new Date(e.avisoDesde).getTime() : null;
    this.avisoPrevio = !activo && desde !== null && desde > ahora && (aviso === null || aviso <= ahora)
      ? `Hoy a las ${this.hora(new Date(desde))} la página entrará en mantenimiento. Por favor guarde su trabajo antes de esa hora.`
      : '';

    // La ventana sale una vez por cada mantenimiento programado (por su hora de inicio).
    let visto = '';
    try { visto = localStorage.getItem(CLAVE_AVISO_VISTO) || ''; } catch {}
    this.mostrarVentanaAviso = !!this.avisoPrevio && !!this.auth.usuarioActual && visto !== e?.desde;
    if (this.mostrarVentanaAviso && desde !== null) {
      const f = new Date(desde);
      const dia = f.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
      this.cuandoTexto = `hoy ${dia} a las ${this.hora(f)}`;
    }
  }

  private hora(f: Date): string {
    const h = f.getHours();
    const m = String(f.getMinutes()).padStart(2, '0');
    if (h === 12 && m === '00') return '12:00 m.';
    return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  }

  cerrarVentanaAviso(): void {
    try { localStorage.setItem(CLAVE_AVISO_VISTO, this.estado?.desde || ''); } catch {}
    this.mostrarVentanaAviso = false;
  }

  ingresoAdministrador(): void {
    try { sessionStorage.setItem(CLAVE_INGRESO_ADMIN, '1'); } catch {}
    this.mostrarLetrero = false;
    this.router.navigate(['/ingresar']);
  }
}
