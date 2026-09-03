import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { EmpresasServicio, Empresa } from '../../../nucleo/servicios/empresas.servicio';

@Component({
  selector: 'anturi-detalle-empresa',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="detalle-contenedor">

      <!-- Encabezado -->
      <div class="detalle-encabezado">
        <button class="boton boton-icono" routerLink="/admin/empresas" title="Volver a empresas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="detalle-encabezado__info">
          <h2 class="pagina-titulo" *ngIf="empresa">{{ empresa.razonSocial }}</h2>
          <h2 class="pagina-titulo" *ngIf="!empresa && !cargando">Detalle de empresa</h2>
          <span *ngIf="empresa" class="badge-estado" [class.badge-activo]="empresa.activa" [class.badge-inactivo]="!empresa.activa">
            {{ empresa.activa ? 'Activa' : 'Inactiva' }}
          </span>
        </div>
        <div class="detalle-acciones" *ngIf="empresa && !modoEdicion">
          <button class="boton boton-secundario" (click)="activarEdicion()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Editar
          </button>
        </div>
      </div>

      <!-- Cargando -->
      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando datos de la empresa...</p>
      </div>

      <!-- Error -->
      <div *ngIf="errorCarga && !cargando" class="tarjeta estado-vacio">
        <p style="color: var(--color-error);">{{ errorCarga }}</p>
        <button class="boton boton-secundario" (click)="cargarEmpresa()">Reintentar</button>
      </div>

      <!-- Alertas -->
      <div *ngIf="mensajeExito" class="alerta-exito">{{ mensajeExito }}</div>
      <div *ngIf="mensajeError" class="alerta-error">{{ mensajeError }}</div>

      <!-- ===================== MODO VISTA ===================== -->
      <ng-container *ngIf="empresa && !modoEdicion && !cargando">

        <div class="tarjeta">
          <h3 class="seccion-titulo">Identificación</h3>
          <div class="datos-grid">
            <div class="dato-item">
              <span class="dato-etiqueta">Razón social</span>
              <span class="dato-valor">{{ empresa.razonSocial }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">NIT</span>
              <span class="dato-valor"><code class="codigo-nit">{{ empresa.nit }}</code></span>
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
              <span class="dato-valor">{{ empresa.municipio || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Dirección</span>
              <span class="dato-valor">{{ empresa.direccion || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Asopagos</span>
              <span class="dato-valor">{{ empresa.asopagos || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Clave</span>
              <span class="dato-valor">{{ empresa.clave || '—' }}</span>
            </div>
            <div class="dato-item dato-item--ancho" *ngIf="empresa.actividadEconomica">
              <span class="dato-etiqueta">Actividad económica</span>
              <span class="dato-valor">{{ empresa.actividadEconomica }}</span>
            </div>
          </div>
        </div>

        <div class="tarjeta">
          <h3 class="seccion-titulo">Valores y pagos PILA</h3>
          <div class="datos-grid">
            <div class="dato-item">
              <span class="dato-etiqueta">Clase aportante</span>
              <span class="dato-valor">{{ empresa.claseAportante || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Porcentaje ARL</span>
              <span class="dato-valor">{{ empresa.porcentajeArl != null ? (empresa.porcentajeArl + '%') : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Valor base</span>
              <span class="dato-valor dato-valor--monto">{{ empresa.valor != null ? ('$' + (empresa.valor | number)) : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Comisión</span>
              <span class="dato-valor dato-valor--monto">{{ empresa.comision != null ? ('$' + (empresa.comision | number)) : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Total pago</span>
              <span class="dato-valor dato-valor--monto dato-valor--destacado">{{ empresa.totalPago != null ? ('$' + (empresa.totalPago | number)) : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">4x1000</span>
              <span class="dato-valor dato-valor--monto">{{ empresa.cuatroXMil != null ? ('$' + (empresa.cuatroXMil | number)) : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Días de pago</span>
              <span class="dato-valor">{{ empresa.diasPago != null ? empresa.diasPago : '—' }}</span>
            </div>
          </div>
        </div>

        <div class="tarjeta">
          <h3 class="seccion-titulo">Entidades de seguridad social</h3>
          <div class="datos-grid">
            <div class="dato-item">
              <span class="dato-etiqueta">EPS</span>
              <span class="dato-valor">{{ empresa.eps || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">AFP / Pensión</span>
              <span class="dato-valor">{{ empresa.afp || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Caja de compensación</span>
              <span class="dato-valor">{{ empresa.cajaCom || '—' }}</span>
            </div>
          </div>
        </div>

        <div class="tarjeta">
          <h3 class="seccion-titulo">Fechas</h3>
          <div class="datos-grid">
            <div class="dato-item">
              <span class="dato-etiqueta">Fecha de ingreso</span>
              <span class="dato-valor">{{ empresa.fechaIngreso ? (empresa.fechaIngreso | date:'dd/MM/yyyy') : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Fecha de retiro</span>
              <span class="dato-valor">{{ empresa.fechaRetiro ? (empresa.fechaRetiro | date:'dd/MM/yyyy') : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Registrada el</span>
              <span class="dato-valor">{{ empresa.creadoEn | date:'dd/MM/yyyy' }}</span>
            </div>
          </div>
        </div>

        <div class="tarjeta" *ngIf="empresa.observaciones">
          <h3 class="seccion-titulo">Notas internas</h3>
          <div class="dato-item dato-item--ancho">
            <span class="dato-valor dato-valor--nota">{{ empresa.observaciones }}</span>
          </div>
        </div>

      </ng-container>

      <!-- ===================== MODO EDICIÓN ===================== -->
      <ng-container *ngIf="empresa && modoEdicion">
        <form class="tarjeta form-edicion" (ngSubmit)="guardarCambios()">
          <h3 class="seccion-titulo">Editar empresa</h3>

          <h4 class="subseccion-titulo">Identificación</h4>
          <div class="campos-grid">
            <div class="campo-grupo campo-grupo--ancho">
              <label class="campo-etiqueta">Razón social</label>
              <input type="text" class="campo-input" [(ngModel)]="edicion.razonSocial" name="razonSocial">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">NIT</label>
              <input type="text" class="campo-input" [(ngModel)]="edicion.nit" name="nit">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Correo</label>
              <input type="email" class="campo-input" [(ngModel)]="edicion.correo" name="correo">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Teléfono</label>
              <input type="tel" class="campo-input" [(ngModel)]="edicion.telefono" name="telefono">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Municipio</label>
              <input type="text" class="campo-input" [(ngModel)]="edicion.municipio" name="municipio">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Dirección</label>
              <input type="text" class="campo-input" [(ngModel)]="edicion.direccion" name="direccion">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Asopagos</label>
              <input type="text" class="campo-input" [(ngModel)]="edicion.asopagos" name="asopagos">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Clave</label>
              <input type="text" class="campo-input" [(ngModel)]="edicion.clave" name="clave">
            </div>
            <div class="campo-grupo campo-grupo--ancho">
              <label class="campo-etiqueta">Actividad económica</label>
              <textarea class="campo-input campo-textarea" [(ngModel)]="edicion.actividadEconomica" name="actividadEconomica" rows="2"></textarea>
            </div>
          </div>

          <h4 class="subseccion-titulo" style="margin-top: var(--espacio-5)">Valores PILA</h4>
          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Clase aportante</label>
              <input type="text" class="campo-input" [(ngModel)]="edicion.claseAportante" name="claseAportante">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">% ARL</label>
              <input type="number" class="campo-input" [(ngModel)]="edicion.porcentajeArl" name="porcentajeArl" step="0.001">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Valor base</label>
              <input type="number" class="campo-input" [(ngModel)]="edicion.valor" name="valor">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Comisión</label>
              <input type="number" class="campo-input" [(ngModel)]="edicion.comision" name="comision">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Total pago</label>
              <input type="number" class="campo-input" [(ngModel)]="edicion.totalPago" name="totalPago">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">4x1000</label>
              <input type="number" class="campo-input" [(ngModel)]="edicion.cuatroXMil" name="cuatroXMil">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Días de pago</label>
              <input type="number" class="campo-input" [(ngModel)]="edicion.diasPago" name="diasPago">
            </div>
          </div>

          <h4 class="subseccion-titulo" style="margin-top: var(--espacio-5)">Entidades</h4>
          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">EPS</label>
              <input type="text" class="campo-input" [(ngModel)]="edicion.eps" name="eps">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">AFP / Pensión</label>
              <input type="text" class="campo-input" [(ngModel)]="edicion.afp" name="afp">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Caja de compensación</label>
              <input type="text" class="campo-input" [(ngModel)]="edicion.cajaCom" name="cajaCom">
            </div>
          </div>

          <h4 class="subseccion-titulo" style="margin-top: var(--espacio-5)">Fechas y estado</h4>
          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Fecha de ingreso</label>
              <input type="date" class="campo-input" [(ngModel)]="edicion.fechaIngreso" name="fechaIngreso">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Fecha de retiro</label>
              <input type="date" class="campo-input" [(ngModel)]="edicion.fechaRetiro" name="fechaRetiro">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Estado</label>
              <select class="campo-input" [(ngModel)]="edicion.activa" name="activa">
                <option [ngValue]="true">Activa</option>
                <option [ngValue]="false">Inactiva</option>
              </select>
            </div>
          </div>

          <h4 class="subseccion-titulo" style="margin-top: var(--espacio-5)">Notas internas</h4>
          <div class="campo-grupo campo-grupo--ancho">
            <label class="campo-etiqueta">Notas (trabajadores, recordatorios, etc.)</label>
            <textarea class="campo-input campo-textarea" [(ngModel)]="edicion.observaciones" name="observaciones" rows="4" placeholder="Ej: Trabajadores: Juan Pérez, María López..."></textarea>
          </div>

          <div class="form-acciones">
            <button type="button" class="boton boton-secundario" (click)="cancelarEdicion()" [disabled]="guardando">Cancelar</button>
            <button type="submit" class="boton boton-primario" [disabled]="guardando">
              <span *ngIf="guardando" class="spinner-inline"></span>
              {{ guardando ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
        </form>
      </ng-container>

    </div>
  `,
  styles: [`
    .detalle-contenedor { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .detalle-encabezado { display: flex; align-items: center; gap: var(--espacio-3); flex-wrap: wrap; }
    .detalle-encabezado__info { display: flex; align-items: center; gap: var(--espacio-3); flex: 1; min-width: 0; flex-wrap: wrap; }
    .pagina-titulo { font-size: var(--tamano-xl); font-weight: 700; color: var(--texto-principal); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .detalle-acciones { display: flex; gap: var(--espacio-2); margin-left: auto; }
    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-3); padding: var(--espacio-8); text-align: center; }
    .spinner { width: 36px; height: 36px; border: 3px solid var(--borde-color,#e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }
    .alerta-exito { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.3); border-radius: var(--radio-md); color: #15803d; font-size: var(--tamano-sm); }
    .alerta-error { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radio-md); color: var(--color-error); font-size: var(--tamano-sm); }
    .tarjeta { background: var(--fondo-tarjeta,#fff); border-radius: var(--radio-xl); border: 1px solid var(--borde-color,#e5e7eb); padding: var(--espacio-5); box-shadow: var(--sombra-sm); }
    .seccion-titulo { font-size: var(--tamano-base); font-weight: 700; color: var(--texto-principal); margin: 0 0 var(--espacio-4) 0; padding-bottom: var(--espacio-3); border-bottom: 1px solid var(--borde-color,#e5e7eb); }
    .subseccion-titulo { font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-secundario); margin: 0 0 var(--espacio-3) 0; text-transform: uppercase; letter-spacing: 0.05em; }
    .datos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--espacio-4); }
    .dato-item { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .dato-item--ancho { grid-column: 1 / -1; }
    .dato-etiqueta { font-size: 0.7rem; font-weight: 600; color: var(--texto-terciario); text-transform: uppercase; letter-spacing: 0.05em; }
    .dato-valor { font-size: var(--tamano-sm); color: var(--texto-principal); word-break: break-word; }
    .dato-valor--monto { font-family: monospace; font-weight: 500; }
    .dato-valor--destacado { font-size: var(--tamano-base); font-weight: 700; color: var(--color-primario); }
    .dato-valor--nota { background: rgba(249,115,22,0.06); border: 1px solid rgba(249,115,22,0.2); border-radius: var(--radio-md); padding: var(--espacio-3); color: var(--texto-principal); line-height: 1.6; }
    .codigo-nit { background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; font-family: monospace; }
    .badge-estado { display: inline-flex; padding: 3px var(--espacio-2); border-radius: var(--radio-full,9999px); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; }
    .badge-activo { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-inactivo { background: rgba(0,0,0,0.07); color: var(--texto-terciario); }
    .form-edicion { padding: var(--espacio-5); }
    .campos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .campo-grupo--ancho { grid-column: 1 / -1; }
    .campo-textarea { resize: vertical; min-height: 72px; }
    .form-acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); margin-top: var(--espacio-6); padding-top: var(--espacio-4); border-top: 1px solid var(--borde-color,#e5e7eb); }
    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }
  `]
})
export class DetalleEmpresaComponent implements OnInit, OnDestroy {
  empresa: Empresa | null = null;
  cargando = false;
  errorCarga = '';
  mensajeExito = '';
  mensajeError = '';
  modoEdicion = false;
  guardando = false;
  edicion: Partial<Empresa> = {};

  private id = 0;
  private destruir$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private empresasServicio: EmpresasServicio
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destruir$)).subscribe(p => {
      this.id = +p['id'];
      this.cargarEmpresa();
    });
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  cargarEmpresa(): void {
    if (!this.id) return;
    this.cargando = true;
    this.errorCarga = '';
    this.empresasServicio.obtener(this.id).pipe(
      catchError(() => { this.errorCarga = 'No se pudo cargar la empresa.'; return of(null); }),
      takeUntil(this.destruir$)
    ).subscribe(e => {
      this.empresa = e;
      this.cargando = false;
    });
  }

  activarEdicion(): void {
    if (!this.empresa) return;
    this.edicion = {
      razonSocial: this.empresa.razonSocial,
      nit: this.empresa.nit,
      correo: this.empresa.correo,
      telefono: this.empresa.telefono,
      direccion: this.empresa.direccion,
      municipio: this.empresa.municipio,
      asopagos: this.empresa.asopagos,
      clave: this.empresa.clave,
      actividadEconomica: this.empresa.actividadEconomica,
      claseAportante: this.empresa.claseAportante,
      porcentajeArl: this.empresa.porcentajeArl,
      valor: this.empresa.valor,
      comision: this.empresa.comision,
      totalPago: this.empresa.totalPago,
      cuatroXMil: this.empresa.cuatroXMil,
      diasPago: this.empresa.diasPago,
      eps: this.empresa.eps,
      afp: this.empresa.afp,
      cajaCom: this.empresa.cajaCom,
      fechaIngreso: this.empresa.fechaIngreso ? this.empresa.fechaIngreso.slice(0, 10) : undefined,
      fechaRetiro: this.empresa.fechaRetiro ? this.empresa.fechaRetiro.slice(0, 10) : undefined,
      activa: this.empresa.activa,
      observaciones: this.empresa.observaciones,
    };
    this.modoEdicion = true;
    this.mensajeExito = '';
    this.mensajeError = '';
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.edicion = {};
    this.mensajeError = '';
  }

  guardarCambios(): void {
    if (!this.edicion.razonSocial?.trim() || !this.edicion.nit?.trim()) {
      this.mensajeError = 'Razón social y NIT son obligatorios.';
      return;
    }
    this.guardando = true;
    this.mensajeError = '';
    this.empresasServicio.actualizar(this.id, this.edicion).pipe(
      catchError((err: any) => {
        this.mensajeError = err?.error?.mensaje || 'No se pudo guardar los cambios.';
        return of(null);
      }),
      takeUntil(this.destruir$)
    ).subscribe(e => {
      this.guardando = false;
      if (e) {
        this.empresa = e;
        this.modoEdicion = false;
        this.mensajeExito = 'Empresa actualizada correctamente.';
        setTimeout(() => this.mensajeExito = '', 4000);
      }
    });
  }
}
