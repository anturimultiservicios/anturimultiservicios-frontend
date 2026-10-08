import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, forkJoin } from 'rxjs';
import {
  HorarioAccesoServicio,
  ConfiguracionHorarioAcceso,
  ExcepcionHorarioAcceso,
} from '../../nucleo/servicios/horario-acceso.servicio';
import { UsuariosServicio, UsuarioSistema } from '../../nucleo/servicios/usuarios.servicio';

// 2026-10-01 (decisión de Cristopher, seguridad): pantalla exclusiva
// SUPER_ADMIN para administrar el horario de acceso de ADMIN/SECRETARIA
// (7:00-19:00 hora Colombia por defecto) y otorgar excepciones puntuales -
// "yo podré habilitarlos si él me lo pide", nunca automático. El backend
// ya exige SUPER_ADMIN en cada endpoint - esta pantalla es puramente la
// interfaz, no agrega ninguna autorización nueva.
@Component({
  selector: 'anturi-horario-acceso',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pagina-contenedor">
      <h2 class="pagina-titulo">Horario de acceso</h2>
      <p class="pagina-subtitulo">
        Controla cuándo pueden entrar ADMIN y SECRETARIA. Vos (SUPER_ADMIN) nunca estás restringido.
      </p>

      <div *ngIf="cargando" class="estado-carga"><div class="spinner"></div></div>

      <ng-container *ngIf="!cargando && config">
        <!-- Configuración -->
        <div class="tarjeta seccion-datos">
          <h3 class="seccion-titulo">Configuración</h3>

          <div class="campo-grupo campo-grupo--inline">
            <label class="campo-check">
              <input type="checkbox" [(ngModel)]="config.activo">
              Horario activo (si lo apaga, nadie queda restringido)
            </label>
          </div>

          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Lunes a viernes: abre (hora Colombia)</label>
              <select class="campo-input" [(ngModel)]="config.horaInicio">
                <option *ngFor="let h of horas" [ngValue]="h">{{ textoHora(h) }}</option>
              </select>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Lunes a viernes: cierra</label>
              <select class="campo-input" [(ngModel)]="config.horaFin">
                <option *ngFor="let h of horas" [ngValue]="h">{{ textoHora(h) }}</option>
              </select>
            </div>
            <div class="campo-grupo">
              <label class="campo-check"><input type="checkbox" [(ngModel)]="config.sabadoActivo"> Abre los sábados</label>
              <label class="campo-etiqueta" *ngIf="config.sabadoActivo">Sábado: cierra</label>
              <select *ngIf="config.sabadoActivo" class="campo-input" [(ngModel)]="config.sabadoHoraFin">
                <option *ngFor="let h of horas" [ngValue]="h">{{ textoHora(h) }}</option>
              </select>
            </div>
            <div class="campo-grupo">
              <label class="campo-check"><input type="checkbox" [(ngModel)]="config.domingoActivo"> Abre los domingos</label>
              <label class="campo-check"><input type="checkbox" [(ngModel)]="config.bloquearFestivos"> Cerrado los festivos de Colombia</label>
            </div>
          </div>
          <p class="resumen-horario">
            Así queda: <b>{{ resumenHorario() }}</b>. Usted (Super Admin) siempre puede entrar.
          </p>

          <div *ngIf="errorConfig" class="mensaje-error" style="margin-top: var(--espacio-3);">{{ errorConfig }}</div>
          <div *ngIf="exitoConfig" class="alerta-exito" style="margin-top: var(--espacio-3);">Guardado.</div>

          <div class="form-acciones" style="margin-top: var(--espacio-4);">
            <button class="boton boton-primario" (click)="guardarConfiguracion()" [disabled]="guardandoConfig">
              <span *ngIf="guardandoConfig" class="spinner-inline"></span>
              {{ guardandoConfig ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>

        <!-- Otorgar excepción -->
        <div class="tarjeta seccion-datos" style="margin-top: var(--espacio-5);">
          <h3 class="seccion-titulo">Otorgar excepción</h3>
          <p class="campo-ayuda" style="margin-bottom: var(--espacio-4);">
            Habilita a una persona puntual fuera del horario normal, solo si te lo pidió.
          </p>

          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Usuario</label>
              <select class="campo-input" [(ngModel)]="formExcepcion.usuarioId">
                <option [ngValue]="null" disabled>Seleccioná un usuario</option>
                <option *ngFor="let u of usuariosRestringidos" [ngValue]="u.id">
                  {{ u.nombre }} {{ u.apellido }} ({{ u.rol }})
                </option>
              </select>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Vigente hasta</label>
              <input type="datetime-local" class="campo-input" [(ngModel)]="formExcepcion.vigenteHasta">
            </div>
          </div>

          <div class="campo-grupo" style="margin-top: var(--espacio-4);">
            <label class="campo-etiqueta">Motivo <span style="color: var(--color-error);">*</span></label>
            <input type="text" class="campo-input" [(ngModel)]="formExcepcion.motivo" placeholder="Ej: Anturi pidió cerrar un pendiente hoy">
          </div>

          <div *ngIf="errorExcepcion" class="mensaje-error" style="margin-top: var(--espacio-3);">{{ errorExcepcion }}</div>

          <div class="form-acciones" style="margin-top: var(--espacio-4);">
            <button class="boton boton-primario" (click)="otorgarExcepcion()" [disabled]="otorgando">
              <span *ngIf="otorgando" class="spinner-inline"></span>
              {{ otorgando ? 'Otorgando...' : 'Otorgar excepción' }}
            </button>
          </div>
        </div>

        <!-- Excepciones activas -->
        <div class="tarjeta seccion-datos" style="margin-top: var(--espacio-5);">
          <h3 class="seccion-titulo">Excepciones activas</h3>

          <div *ngIf="excepciones.length === 0" class="docs-vacio">No hay excepciones activas en este momento.</div>

          <div *ngIf="excepciones.length > 0" class="tabla-contenedor">
            <div class="tabla-scroll">
              <table class="tabla">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Motivo</th>
                    <th>Vigente hasta</th>
                    <th>Otorgada por</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let e of excepciones">
                    <td>{{ e.usuario.nombre }} {{ e.usuario.apellido }}</td>
                    <td>{{ e.usuario.rol }}</td>
                    <td>{{ e.motivo || '—' }}</td>
                    <td>{{ e.vigenteHasta | date:'dd/MM/yyyy HH:mm' }}</td>
                    <td>{{ e.otorgadaPor.nombre }} {{ e.otorgadaPor.apellido }}</td>
                    <td>
                      <button class="boton boton-icono boton-peligro-suave" title="Revocar" (click)="revocar(e.id)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .resumen-horario { margin: var(--espacio-3) 0 0; font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .pagina-contenedor { display: flex; flex-direction: column; gap: var(--espacio-2); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .pagina-subtitulo { color: var(--texto-secundario); margin: 0 0 var(--espacio-4); }
    .estado-carga { display: flex; justify-content: center; padding: var(--espacio-10); }
    .spinner { width: 36px; height: 36px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }
    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }

    .seccion-datos { padding: var(--espacio-5); }
    .seccion-titulo { font-size: var(--tamano-lg); font-weight: 600; color: var(--texto-principal); margin: 0 0 var(--espacio-4); }
    .campos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .campo-grupo--inline { margin-bottom: var(--espacio-4); }
    .campo-check { display: flex; align-items: center; gap: var(--espacio-2); font-size: var(--tamano-sm); color: var(--texto-principal); cursor: pointer; }
    .campo-ayuda { font-size: var(--tamano-sm); color: var(--texto-terciario); margin: 0; }
    .form-acciones { display: flex; justify-content: flex-end; }
    .mensaje-error { font-size: var(--tamano-sm); color: var(--color-error); }
    .alerta-exito { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: var(--radio-md); color: #15803d; font-size: var(--tamano-sm); }
    .docs-vacio { text-align: center; color: var(--texto-terciario); padding: var(--espacio-6); font-size: var(--tamano-sm); }

    .tabla-contenedor { padding: 0; overflow: hidden; margin-top: var(--espacio-3); border: 1px solid var(--borde-color, #e5e7eb); border-radius: var(--radio-md, 8px); }
    .tabla-scroll { overflow-x: auto; }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla thead th { padding: var(--espacio-2) var(--espacio-3); text-align: left; font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-secundario); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); border-bottom: 1px solid var(--borde-color, #e5e7eb); white-space: nowrap; }
    .tabla tbody td { padding: var(--espacio-2) var(--espacio-3); border-bottom: 1px solid var(--borde-color, #e5e7eb); font-size: var(--tamano-sm); color: var(--texto-principal); }
    .tabla tbody tr:last-child td { border-bottom: none; }
    .boton-peligro-suave { color: var(--color-error); }
    .boton-peligro-suave:hover { background: rgba(239,68,68,0.08); }
  `],
})
export class HorarioAccesoComponent implements OnInit, OnDestroy {
  cargando = true;
  config: ConfiguracionHorarioAcceso | null = null;
  excepciones: ExcepcionHorarioAcceso[] = [];
  usuariosRestringidos: UsuarioSistema[] = [];

  guardandoConfig = false;
  errorConfig = '';
  exitoConfig = false;

  otorgando = false;
  errorExcepcion = '';
  formExcepcion: { usuarioId: number | null; vigenteHasta: string; motivo: string } = {
    usuarioId: null,
    vigenteHasta: '',
    motivo: '',
  };

  private destruir$ = new Subject<void>();

  constructor(
    private horarioServicio: HorarioAccesoServicio,
    private usuariosServicio: UsuariosServicio,
  ) {}

  ngOnInit(): void {
    this.cargarTodo();
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  cargarTodo(): void {
    this.cargando = true;
    forkJoin({
      config: this.horarioServicio.obtenerConfiguracion(),
      excepciones: this.horarioServicio.listarExcepciones(),
      usuarios: this.usuariosServicio.listar(),
    }).pipe(
      catchError(() => of(null)),
      takeUntil(this.destruir$),
    ).subscribe((res) => {
      this.cargando = false;
      if (!res) return;
      this.config = res.config;
      this.excepciones = res.excepciones;
      // Solo ADMIN/SECRETARIA pueden tener una excepción - SUPER_ADMIN
      // nunca la necesita (nunca está restringido).
      this.usuariosRestringidos = res.usuarios.filter((u) => u.rol === 'ADMIN' || u.rol === 'SECRETARIA');
    });
  }

  readonly horas = Array.from({ length: 24 }, (_, i) => i);

  textoHora(h: number): string {
    if (h === 0) return '12:00 a. m.';
    if (h === 12) return '12:00 m.';
    return `${h % 12}:00 ${h < 12 ? 'a. m.' : 'p. m.'}`;
  }

  resumenHorario(): string {
    const c = this.config;
    if (!c) return '';
    if (!c.activo) return 'sin restricción de horario';
    let t = `lunes a viernes de ${this.textoHora(c.horaInicio)} a ${this.textoHora(c.horaFin)}`;
    t += c.sabadoActivo ? `; sábados de ${this.textoHora(c.horaInicio)} a ${this.textoHora(c.sabadoHoraFin)}` : '; sábados cerrado';
    t += c.domingoActivo ? `; domingos de ${this.textoHora(c.horaInicio)} a ${this.textoHora(c.horaFin)}` : '; domingos cerrado';
    if (c.bloquearFestivos) t += '; festivos cerrado';
    return t;
  }

  guardarConfiguracion(): void {
    if (!this.config) return;
    this.guardandoConfig = true;
    this.errorConfig = '';
    this.exitoConfig = false;
    this.horarioServicio.actualizarConfiguracion({
      activo: this.config.activo,
      horaInicio: Number(this.config.horaInicio),
      horaFin: Number(this.config.horaFin),
      sabadoActivo: this.config.sabadoActivo,
      sabadoHoraFin: Number(this.config.sabadoHoraFin),
      domingoActivo: this.config.domingoActivo,
      bloquearFestivos: this.config.bloquearFestivos,
    }).pipe(takeUntil(this.destruir$)).subscribe({
      next: (config) => {
        this.guardandoConfig = false;
        this.config = config;
        this.exitoConfig = true;
        setTimeout(() => (this.exitoConfig = false), 3000);
      },
      error: (err) => {
        this.guardandoConfig = false;
        this.errorConfig = err?.error?.message || 'No se pudo guardar.';
      },
    });
  }

  otorgarExcepcion(): void {
    if (!this.formExcepcion.usuarioId || !this.formExcepcion.vigenteHasta || !this.formExcepcion.motivo.trim()) {
      this.errorExcepcion = 'Completá usuario, vigencia y motivo.';
      return;
    }
    this.otorgando = true;
    this.errorExcepcion = '';
    this.horarioServicio.otorgarExcepcion(
      this.formExcepcion.usuarioId,
      new Date(this.formExcepcion.vigenteHasta).toISOString(),
      this.formExcepcion.motivo.trim(),
    ).pipe(takeUntil(this.destruir$)).subscribe({
      next: () => {
        this.otorgando = false;
        this.formExcepcion = { usuarioId: null, vigenteHasta: '', motivo: '' };
        this.cargarTodo();
      },
      error: (err) => {
        this.otorgando = false;
        this.errorExcepcion = err?.error?.message || 'No se pudo otorgar la excepción.';
      },
    });
  }

  revocar(id: number): void {
    if (!confirm('¿Revocar esta excepción ahora?')) return;
    this.horarioServicio.revocarExcepcion(id).pipe(takeUntil(this.destruir$)).subscribe({
      next: () => this.cargarTodo(),
      error: () => {},
    });
  }
}
