import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, finalize, of } from 'rxjs';
import { BackupServicio, BackupArchivo } from '../../nucleo/servicios/backup.servicio';

// 2026-10-07: primera pantalla real (ver AUDITORIA-CONECTIVIDAD-FRONTEND-
// BACKEND-2026-10-06.md) - el backend ya corría los backups diario/semanal
// solo (cron) y tenía los 2 endpoints completos, sin ningún consumidor.
// SUPER_ADMIN-only, mismo criterio que el backend.
@Component({
  selector: 'anturi-backup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pagina-lista">
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Backups</h2>
        <button class="boton boton-primario" (click)="ejecutarBackup()" [disabled]="ejecutando">
          <span *ngIf="ejecutando" class="spinner-inline"></span>
          {{ ejecutando ? 'Ejecutando...' : 'Ejecutar backup ahora' }}
        </button>
      </div>

      <p class="nota">Backup automático diario a las 2:00 a.m. y semanal los domingos a las 3:00 a.m. Se conservan los últimos 14.</p>

      <div *ngIf="mensajeExito" class="alerta-exito">{{ mensajeExito }}</div>
      <div *ngIf="mensajeError" class="alerta-error">{{ mensajeError }}</div>

      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando backups...</p>
      </div>

      <div *ngIf="!cargando && backups.length === 0" class="tarjeta estado-vacio">
        <p>No hay backups registrados todavía.</p>
      </div>

      <div *ngIf="!cargando && backups.length > 0" class="tarjeta">
        <table class="tabla">
          <thead>
            <tr><th>Archivo</th><th>Tamaño</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let b of backups">
              <td>{{ b.nombre }}</td>
              <td>{{ b.tamanioKb | number }} KB</td>
              <td>{{ b.fecha | date:'dd/MM/yyyy HH:mm' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-4); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-3); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .nota { color: var(--texto-secundario); font-size: var(--tamano-sm); margin: 0; }
    .tarjeta { background: var(--fondo-tarjeta); border: 1px solid var(--borde-color); border-radius: var(--radio-md); padding: var(--espacio-4); }
    .estado-vacio { text-align: center; color: var(--texto-secundario); padding: var(--espacio-6); }
    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-3); padding: var(--espacio-6); color: var(--texto-secundario); }
    .spinner { width: 32px; height: 32px; border: 3px solid var(--borde-color); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    .spinner-inline { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: 6px; }
    @keyframes girar { to { transform: rotate(360deg); } }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla th, .tabla td { text-align: left; padding: var(--espacio-3); border-bottom: 1px solid var(--borde-color); font-size: var(--tamano-sm); }
    .tabla th { color: var(--texto-secundario); font-weight: 600; }
    .alerta-exito { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: var(--radio-md); padding: var(--espacio-3); }
    .alerta-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: var(--radio-md); padding: var(--espacio-3); }
  `],
})
export class BackupComponent implements OnInit {
  backups: BackupArchivo[] = [];
  cargando = false;
  ejecutando = false;
  mensajeExito = '';
  mensajeError = '';

  constructor(private servicio: BackupServicio) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.servicio.listar().pipe(
      catchError(() => of([])),
      finalize(() => { this.cargando = false; }),
    ).subscribe((lista) => { this.backups = lista; });
  }

  ejecutarBackup(): void {
    this.ejecutando = true;
    this.mensajeError = '';
    this.mensajeExito = '';
    this.servicio.ejecutar().pipe(
      catchError((err) => { this.mensajeError = err?.error?.message || err?.message || 'Error al ejecutar el backup.'; return of(null); }),
      finalize(() => { this.ejecutando = false; }),
    ).subscribe((res) => {
      if (res !== null) {
        this.mensajeExito = 'Backup ejecutado y validado correctamente.';
        this.cargar();
        setTimeout(() => { this.mensajeExito = ''; }, 5000);
      }
    });
  }
}
