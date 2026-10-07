import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { AfiliadosServicio } from '../../../nucleo/servicios/afiliados.servicio';

// 2026-10-07: primera pantalla real para ver/restaurar la papelera (ver
// AUDITORIA-CONECTIVIDAD-FRONTEND-BACKEND-2026-10-06.md) - el backend ya
// existía completo (GET /afiliados/papelera, POST /afiliados/:id/restaurar),
// sin ningún consumidor. Solo ADMIN/SUPER_ADMIN - Cristopher redefinió que un
// registro archivado no debe estar disponible para Secretaria en absoluto,
// ni siquiera para verlo (ver comentario en afiliados.controlador.ts).
@Component({
  selector: 'anturi-papelera-afiliados',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="pagina-lista">
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Papelera de afiliados</h2>
        <a routerLink="/admin/afiliados" class="boton boton-secundario">Volver a afiliados</a>
      </div>

      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando papelera...</p>
      </div>

      <div *ngIf="error && !cargando" class="tarjeta estado-vacio">
        <p>{{ error }}</p>
        <button class="boton boton-secundario" (click)="cargar()">Reintentar</button>
      </div>

      <div *ngIf="!cargando && !error && registros.length === 0" class="tarjeta estado-vacio">
        <p>No hay afiliados en la papelera.</p>
      </div>

      <div *ngIf="!cargando && !error && registros.length > 0" class="tarjeta">
        <table class="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cédula</th>
              <th>Eliminado</th>
              <th>Por</th>
              <th>Motivo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of registros">
              <td>{{ a.nombres }} {{ a.apellidos }}</td>
              <td>{{ a.cedula }}</td>
              <td>{{ a.eliminadoEn | date:'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ a.eliminadoPor ? (a.eliminadoPor.nombre + ' ' + a.eliminadoPor.apellido) : 'Sin registro' }}</td>
              <td>{{ a.motivoEliminacion || 'Sin motivo registrado' }}</td>
              <td>
                <button class="boton boton-primario boton-sm" [disabled]="restaurando === a.id" (click)="restaurar(a)">
                  <span *ngIf="restaurando === a.id" class="spinner-inline"></span>
                  {{ restaurando === a.id ? 'Restaurando...' : 'Restaurar' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="mensajeExito" class="alerta-exito">{{ mensajeExito }}</div>
      <div *ngIf="mensajeError" class="alerta-error">{{ mensajeError }}</div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-3); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .tarjeta { background: var(--fondo-tarjeta); border: 1px solid var(--borde-color); border-radius: var(--radio-md); padding: var(--espacio-4); }
    .estado-vacio { text-align: center; color: var(--texto-secundario); padding: var(--espacio-6); }
    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-3); padding: var(--espacio-6); color: var(--texto-secundario); }
    .spinner { width: 32px; height: 32px; border: 3px solid var(--borde-color); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    .spinner-inline { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: 6px; }
    @keyframes girar { to { transform: rotate(360deg); } }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla th, .tabla td { text-align: left; padding: var(--espacio-3); border-bottom: 1px solid var(--borde-color); font-size: var(--tamano-sm); }
    .tabla th { color: var(--texto-secundario); font-weight: 600; }
    .boton-sm { padding: 6px 12px; font-size: var(--tamano-sm); }
    .alerta-exito { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: var(--radio-md); padding: var(--espacio-3); }
    .alerta-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: var(--radio-md); padding: var(--espacio-3); }
  `],
})
export class PapeleraAfiliadosComponent implements OnInit {
  registros: any[] = [];
  cargando = false;
  error = '';
  restaurando: number | null = null;
  mensajeExito = '';
  mensajeError = '';

  constructor(private afiliadosServicio: AfiliadosServicio, private router: Router) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.afiliadosServicio.listarPapelera().pipe(
      catchError(() => { this.error = 'Error al cargar la papelera. Verifique la conexión.'; return of([]); }),
      finalize(() => { this.cargando = false; }),
    ).subscribe((lista) => { this.registros = lista; });
  }

  restaurar(a: any): void {
    this.restaurando = a.id;
    this.mensajeError = '';
    this.afiliadosServicio.restaurar(a.id).pipe(
      catchError((err) => { this.mensajeError = err?.error?.message || 'Error al restaurar el afiliado.'; return of(null); }),
      finalize(() => { this.restaurando = null; }),
    ).subscribe((res) => {
      if (res !== null) {
        this.mensajeExito = `${a.nombres} ${a.apellidos} fue restaurado correctamente.`;
        this.registros = this.registros.filter((r) => r.id !== a.id);
        setTimeout(() => { this.mensajeExito = ''; }, 4000);
      }
    });
  }
}
