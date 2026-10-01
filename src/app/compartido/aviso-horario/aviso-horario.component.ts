import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { HorarioAccesoServicio } from '../../nucleo/servicios/horario-acceso.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

// 2026-10-01 (decisión de Cristopher, seguridad): banner de aviso 5
// minutos antes del cierre + pantalla completa cuando el cierre ya es
// real (detectado por el interceptor en cualquier request, o por este
// mismo sondeo al llegar a 0). Vive en AppComponent, afuera del
// router-outlet, para que se vea sin importar en qué pantalla esté
// Admin/Secretaria en ese momento.
@Component({
  selector: 'anturi-aviso-horario',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Banner: faltan 5 minutos o menos -->
    <div class="aviso-banner" *ngIf="minutosParaCierre !== null && minutosParaCierre <= 5 && minutosParaCierre > 0">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      Esta página se cerrará en {{ minutosParaCierre }} minuto{{ minutosParaCierre === 1 ? '' : 's' }} por el horario de acceso. Guardá lo que estés haciendo.
    </div>

    <!-- Pantalla completa: cierre ya ocurrió -->
    <div class="aviso-pantalla" *ngIf="mensajeCierre">
      <div class="aviso-pantalla__tarjeta">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="56" height="56">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <h2>Sesión cerrada por horario</h2>
        <p>{{ mensajeCierre }}</p>
        <p class="aviso-pantalla__despedida">Feliz noche le desea Anturi Multiservicios 🌙</p>
        <button class="boton boton-primario" (click)="volverAlLogin()">Entendido</button>
      </div>
    </div>
  `,
  styles: [`
    .aviso-banner {
      position: fixed;
      top: var(--altura-barra-nav, 72px);
      left: 0;
      right: 0;
      z-index: var(--z-modal);
      background: var(--color-advertencia);
      color: white;
      padding: var(--espacio-3) var(--espacio-4);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--espacio-2);
      font-size: var(--tamano-sm);
      font-weight: 600;
      text-align: center;
    }

    .aviso-pantalla {
      position: fixed;
      inset: 0;
      z-index: 2000;
      background: var(--color-primario-oscuro);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--espacio-6);
    }

    .aviso-pantalla__tarjeta {
      background: var(--fondo-tarjeta);
      border-radius: var(--radio-2xl);
      padding: var(--espacio-10);
      max-width: 420px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--espacio-3);
      box-shadow: var(--sombra-xl);
    }

    .aviso-pantalla__tarjeta svg { color: var(--color-secundario); }
    .aviso-pantalla__tarjeta h2 { margin: 0; color: var(--texto-principal); }
    .aviso-pantalla__tarjeta p { margin: 0; color: var(--texto-secundario); }
    .aviso-pantalla__despedida { font-weight: 600; color: var(--color-primario); }
  `],
})
export class AvisoHorarioComponent implements OnInit, OnDestroy {
  minutosParaCierre: number | null = null;
  mensajeCierre: string | null = null;

  private destruir$ = new Subject<void>();
  private intervalo: any;

  constructor(
    private horarioServicio: HorarioAccesoServicio,
    private auth: AutenticacionServicio,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.horarioServicio.minutosParaCierre$.pipe(takeUntil(this.destruir$))
      .subscribe((min) => (this.minutosParaCierre = min));

    this.horarioServicio.cierreForzado$.pipe(takeUntil(this.destruir$))
      .subscribe((mensaje) => (this.mensajeCierre = mensaje));

    // Sondeo cada 30s mientras haya sesión - suficiente para el aviso de
    // 5 minutos sin recargar el servidor de preguntas.
    this.consultar();
    this.intervalo = setInterval(() => this.consultar(), 30000);
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
    clearInterval(this.intervalo);
  }

  private consultar(): void {
    if (!this.auth.obtenerToken()) return;
    this.horarioServicio.consultarEstado().subscribe({
      next: (estado) => this.horarioServicio.actualizarMinutosParaCierre(estado.minutosParaCierre),
      error: () => {}, // el interceptor ya maneja el 401 real de corte
    });
  }

  volverAlLogin(): void {
    this.horarioServicio.limpiarAvisos();
    this.router.navigate(['/ingresar']);
  }
}
