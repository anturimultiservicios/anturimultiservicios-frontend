import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of } from 'rxjs';
import { RecordatoriosLlamadaServicio, RecordatorioLlamada } from '../../nucleo/servicios/recordatorios-llamada.servicio';

// 2026-10-07: primera pantalla real para esta cola de tareas (ver
// AUDITORIA-CONECTIVIDAD-FRONTEND-BACKEND-2026-10-06.md) - el backend ya
// generaba las tareas solo (cron T-3/T-1/T-0 + reaviso cada 2h) y tenía los
// 2 endpoints completos, sin ningún consumidor. Compartida entre Secretaria
// (dueña real) y Admin/SuperAdmin, mismo componente (reusa el patrón
// `prefijo` del resto del proyecto solo para volver al panel correcto si
// hiciera falta, pero esta pantalla no navega a otro lado).
@Component({
  selector: 'anturi-recordatorios-llamada',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pagina-lista">
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Llamadas y mensajes pendientes</h2>
        <button class="boton boton-secundario" (click)="cargar()" [disabled]="cargando">Actualizar</button>
      </div>

      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando tareas...</p>
      </div>

      <div *ngIf="error && !cargando" class="tarjeta estado-vacio">
        <p>{{ error }}</p>
        <button class="boton boton-secundario" (click)="cargar()">Reintentar</button>
      </div>

      <div *ngIf="!cargando && !error && tareas.length === 0" class="tarjeta estado-vacio">
        <p>No hay tareas pendientes en este momento. 🎉</p>
      </div>

      <div *ngFor="let t of tareas" class="tarjeta tarea">
        <div class="tarea-encabezado">
          <span class="badge-canal" [ngClass]="t.canal === 'SMS' ? 'badge-sms' : 'badge-llamada'">
            {{ t.canal === 'SMS' ? 'Mensaje de texto' : 'Llamada' }}
          </span>
          <span class="badge-dia" [ngClass]="t.diaRelativo === 0 ? 'badge-hoy' : 'badge-futuro'">
            {{ t.diaRelativo === 0 ? 'Vence HOY' : 'Vence en ' + t.diaRelativo + ' día(s)' }}
          </span>
        </div>
        <div class="tarea-cuerpo">
          <strong>{{ t.afiliado.nombres }} {{ t.afiliado.apellidos }}</strong>
          <span class="tarea-dato">Cédula: {{ t.afiliado.cedula }}</span>
          <span class="tarea-dato" *ngIf="t.afiliado.telefono">Tel: {{ t.afiliado.telefono }}</span>
        </div>

        <div *ngIf="formAbierto !== t.id" class="tarea-acciones">
          <button class="boton boton-primario boton-sm" (click)="abrirForm(t)">Registrar resultado</button>
        </div>

        <div *ngIf="formAbierto === t.id" class="tarea-form">
          <div class="campo-grupo">
            <label class="campo-etiqueta">¿Cuántas veces se intentó? <span class="requerido">*</span></label>
            <input type="number" min="1" class="campo-input" [(ngModel)]="formVecesLlamado">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">¿Va a pagar?</label>
            <select class="campo-input" [(ngModel)]="formVaAPagar">
              <option [ngValue]="undefined">Sin confirmar</option>
              <option [ngValue]="true">Sí, va a pagar</option>
              <option [ngValue]="false">No, dijo que no va a pagar</option>
            </select>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Nota <span class="requerido">*</span></label>
            <textarea class="campo-input" rows="3" [(ngModel)]="formNota" placeholder="Qué pasó con la llamada/mensaje..."></textarea>
          </div>
          <div *ngIf="errorForm" class="alerta-error">{{ errorForm }}</div>
          <div class="tarea-form-acciones">
            <button class="boton boton-secundario boton-sm" (click)="cerrarForm()" [disabled]="guardando">Cancelar</button>
            <button class="boton boton-primario boton-sm" (click)="guardarNota(t)" [disabled]="guardando">
              <span *ngIf="guardando" class="spinner-inline"></span>
              {{ guardando ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>

      <div *ngIf="mensajeExito" class="alerta-exito">{{ mensajeExito }}</div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-4); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-3); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .tarjeta { background: var(--fondo-tarjeta); border: 1px solid var(--borde-color); border-radius: var(--radio-md); padding: var(--espacio-4); }
    .estado-vacio { text-align: center; color: var(--texto-secundario); padding: var(--espacio-6); }
    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-3); padding: var(--espacio-6); color: var(--texto-secundario); }
    .spinner { width: 32px; height: 32px; border: 3px solid var(--borde-color); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    .spinner-inline { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: 6px; }
    @keyframes girar { to { transform: rotate(360deg); } }

    .tarea { display: flex; flex-direction: column; gap: var(--espacio-3); }
    .tarea-encabezado { display: flex; gap: var(--espacio-2); }
    .badge-canal, .badge-dia { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-llamada { background: rgba(27,50,112,0.12); color: var(--color-primario); }
    .badge-sms { background: rgba(139,92,246,0.12); color: #7c3aed; }
    .badge-hoy { background: rgba(239,68,68,0.1); color: #991b1b; }
    .badge-futuro { background: rgba(156,163,175,0.2); color: #6b7280; }
    .tarea-cuerpo { display: flex; flex-direction: column; gap: 2px; }
    .tarea-dato { font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .tarea-acciones, .tarea-form-acciones { display: flex; justify-content: flex-end; gap: var(--espacio-2); }
    .tarea-form { display: flex; flex-direction: column; gap: var(--espacio-3); padding-top: var(--espacio-3); border-top: 1px solid var(--borde-color); }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .requerido { color: var(--color-error); }
    .boton-sm { padding: 6px 12px; font-size: var(--tamano-sm); }
    .alerta-exito { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: var(--radio-md); padding: var(--espacio-3); }
    .alerta-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: var(--radio-md); padding: var(--espacio-3); font-size: var(--tamano-sm); }
  `],
})
export class RecordatoriosLlamadaComponent implements OnInit {
  tareas: RecordatorioLlamada[] = [];
  cargando = false;
  error = '';
  mensajeExito = '';

  formAbierto: number | null = null;
  formNota = '';
  formVecesLlamado = 1;
  formVaAPagar: boolean | undefined = undefined;
  errorForm = '';
  guardando = false;

  constructor(private servicio: RecordatoriosLlamadaServicio) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.servicio.listarPendientes().pipe(
      catchError(() => { this.error = 'Error al cargar las tareas pendientes. Verifique la conexión.'; return of([]); }),
      finalize(() => { this.cargando = false; }),
    ).subscribe((lista) => { this.tareas = lista; });
  }

  abrirForm(t: RecordatorioLlamada): void {
    this.formAbierto = t.id;
    this.formNota = '';
    this.formVecesLlamado = 1;
    this.formVaAPagar = undefined;
    this.errorForm = '';
  }

  cerrarForm(): void {
    this.formAbierto = null;
  }

  guardarNota(t: RecordatorioLlamada): void {
    if (!this.formNota.trim()) {
      this.errorForm = 'La nota es obligatoria - debe indicar qué pasó.';
      return;
    }
    if (!this.formVecesLlamado || this.formVecesLlamado < 1) {
      this.errorForm = 'Debe indicar al menos 1 intento.';
      return;
    }
    this.guardando = true;
    this.errorForm = '';
    this.servicio.agregarNota(t.id, this.formNota.trim(), this.formVecesLlamado, this.formVaAPagar).pipe(
      catchError((err) => { this.errorForm = err?.error?.message || 'Error al guardar.'; return of(null); }),
      finalize(() => { this.guardando = false; }),
    ).subscribe((res) => {
      if (res) {
        this.tareas = this.tareas.filter((x) => x.id !== t.id);
        this.formAbierto = null;
        this.mensajeExito = `Registrado: ${t.afiliado.nombres} ${t.afiliado.apellidos}.`;
        setTimeout(() => { this.mensajeExito = ''; }, 4000);
      }
    });
  }
}
