import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { EmpresasServicio, Empresa } from '../../../nucleo/servicios/empresas.servicio';

// 2026-09-28: solo lectura por ahora. El formulario de editar (crear() y
// actualizar() de EmpresasServicio) queda para un siguiente paso aparte -
// actualizar() en el frontend usa PATCH pero el backend real solo tiene
// @Put(':id') con el formato {datos, motivo} (ver empresas.controlador.ts),
// hay que corregir eso antes de construir el formulario, no encima.
@Component({
  selector: 'anturi-detalle-empresa',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="detalle-contenedor">
      <div class="detalle-encabezado">
        <a routerLink="/admin/empresas" class="boton boton-icono" title="Volver a empresas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </a>
        <div class="detalle-encabezado__info">
          <h2 class="pagina-titulo" *ngIf="empresa">{{ empresa.razonSocial }}</h2>
          <h2 class="pagina-titulo" *ngIf="!empresa && !cargando">Detalle de empresa</h2>
          <span *ngIf="empresa" class="badge-estado" [ngClass]="empresa.activa ? 'badge-activo' : 'badge-inactivo'">
            {{ empresa.activa ? 'ACTIVA' : 'INACTIVA' }}
          </span>
        </div>
      </div>

      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando datos de la empresa...</p>
      </div>

      <div *ngIf="error && !cargando" class="tarjeta estado-vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40" style="color: var(--color-error);">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>{{ error }}</p>
        <button class="boton boton-secundario" (click)="cargar()">Reintentar</button>
      </div>

      <ng-container *ngIf="empresa && !cargando">
        <div class="tarjeta seccion-datos">
          <h3 class="seccion-titulo">Datos de la empresa</h3>
          <div class="datos-grid">
            <div class="dato-item">
              <span class="dato-etiqueta">NIT</span>
              <span class="dato-valor">{{ empresa.nit }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Correo</span>
              <span class="dato-valor">{{ empresa.correo || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Teléfono</span>
              <span class="dato-valor">{{ empresa.telefono || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Municipio</span>
              <span class="dato-valor">{{ empresa.municipio || empresa.ciudad || '—' }}</span>
            </div>
            <div class="dato-item dato-item--ancho">
              <span class="dato-etiqueta">Dirección</span>
              <span class="dato-valor">{{ empresa.direccion || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Clase aportante</span>
              <span class="dato-valor">{{ empresa.claseAportante || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Días de pago</span>
              <span class="dato-valor">{{ empresa.diasPago ?? '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Asopagos</span>
              <span class="dato-valor">{{ empresa.asopagos || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Registrada</span>
              <span class="dato-valor">{{ empresa.creadoEn | date:'d MMM y' }}</span>
            </div>
          </div>
        </div>

        <div class="tarjeta seccion-datos" *ngIf="empresa.sucursales && empresa.sucursales.length">
          <h3 class="seccion-titulo">Sucursales ({{ empresa.sucursales.length }})</h3>
          <div class="tabla-contenedor">
            <table class="tabla">
              <thead>
                <tr><th>Nombre</th><th>Afiliados</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of empresa.sucursales">
                  <td>{{ s.nombre || s.direccion || ('Sucursal #' + s.id) }}</td>
                  <td>{{ s._count?.afiliados ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .detalle-contenedor { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .detalle-encabezado { display: flex; align-items: center; gap: var(--espacio-3); }
    .detalle-encabezado__info { display: flex; align-items: center; gap: var(--espacio-3); flex: 1; flex-wrap: wrap; }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .spinner { width: 40px; height: 40px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }
    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); text-align: center; }

    .seccion-datos { padding: var(--espacio-5); }
    .seccion-titulo { font-size: var(--tamano-lg); font-weight: 600; color: var(--texto-principal); margin: 0 0 var(--espacio-4); }
    .datos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--espacio-4); }
    .dato-item { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .dato-item--ancho { grid-column: 1 / -1; }
    .dato-etiqueta { font-size: var(--tamano-sm); color: var(--texto-terciario); font-weight: 500; }
    .dato-valor { font-size: var(--tamano-base); color: var(--texto-principal); font-weight: 500; }

    .badge-estado { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-activo { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-inactivo { background: rgba(239,68,68,0.12); color: #b91c1c; }

    .tabla-contenedor { overflow: hidden; }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla thead th { padding: var(--espacio-3) var(--espacio-4); text-align: left; font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-secundario); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); border-bottom: 1px solid var(--borde-color, #e5e7eb); }
    .tabla tbody td { padding: var(--espacio-3) var(--espacio-4); border-bottom: 1px solid var(--borde-color, #e5e7eb); font-size: var(--tamano-sm); color: var(--texto-principal); }
    .tabla tbody tr:last-child td { border-bottom: none; }
  `]
})
export class DetalleEmpresaComponent implements OnInit {
  empresa: Empresa | null = null;
  cargando = false;
  error = '';
  private id!: number;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private empresasServicio: EmpresasServicio
  ) {}

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.empresasServicio.obtener(this.id).pipe(
      catchError(() => {
        this.error = 'Error al cargar la empresa. Verifique la conexión.';
        return of(null);
      })
    ).subscribe(resp => {
      this.empresa = resp;
      this.cargando = false;
    });
  }
}
