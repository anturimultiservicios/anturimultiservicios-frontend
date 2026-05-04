import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AfiliadosServicio, CrearAfiliadoDto } from '../../../nucleo/servicios/afiliados.servicio';

interface ErroresCampo {
  nombres?: string;
  apellidos?: string;
  cedula?: string;
}

@Component({
  selector: 'anturi-formulario-afiliado',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="pagina-formulario">
      <!-- Encabezado -->
      <div class="form-encabezado">
        <button class="boton boton-icono" (click)="volver()" title="Volver">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div>
          <h2 class="pagina-titulo">Nuevo afiliado</h2>
          <p class="pagina-subtitulo">Complete los datos para registrar un nuevo afiliado</p>
        </div>
      </div>

      <!-- Mensaje de error global -->
      <div *ngIf="errorGlobal" class="alerta-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        {{ errorGlobal }}
      </div>

      <!-- Formulario -->
      <form (ngSubmit)="guardar()" #formAfiliado="ngForm">

        <!-- SECCIÓN: Datos personales -->
        <div class="tarjeta seccion-form">
          <h3 class="seccion-titulo">
            <span class="seccion-numero">1</span>
            Datos personales
          </h3>
          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Nombres <span class="requerido">*</span></label>
              <input
                type="text"
                class="campo-input"
                [class.campo-error]="errores.nombres"
                [(ngModel)]="form.nombres"
                name="nombres"
                placeholder="Ingrese nombres"
                (blur)="validarCampo('nombres')"
              >
              <span *ngIf="errores.nombres" class="mensaje-error">{{ errores.nombres }}</span>
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">Apellidos <span class="requerido">*</span></label>
              <input
                type="text"
                class="campo-input"
                [class.campo-error]="errores.apellidos"
                [(ngModel)]="form.apellidos"
                name="apellidos"
                placeholder="Ingrese apellidos"
                (blur)="validarCampo('apellidos')"
              >
              <span *ngIf="errores.apellidos" class="mensaje-error">{{ errores.apellidos }}</span>
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">Cédula <span class="requerido">*</span></label>
              <input
                type="text"
                class="campo-input"
                [class.campo-error]="errores.cedula"
                [(ngModel)]="form.cedula"
                name="cedula"
                placeholder="Número de cédula"
                (blur)="validarCampo('cedula')"
              >
              <span *ngIf="errores.cedula" class="mensaje-error">{{ errores.cedula }}</span>
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">Correo electrónico</label>
              <input
                type="email"
                class="campo-input"
                [(ngModel)]="form.correo"
                name="correo"
                placeholder="correo@ejemplo.com"
              >
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">Teléfono</label>
              <input
                type="tel"
                class="campo-input"
                [(ngModel)]="form.telefono"
                name="telefono"
                placeholder="Número de teléfono"
              >
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">Fecha de nacimiento</label>
              <input
                type="date"
                class="campo-input"
                [(ngModel)]="form.fechaNacimiento"
                name="fechaNacimiento"
              >
            </div>
          </div>
        </div>

        <!-- SECCIÓN: Datos laborales -->
        <div class="tarjeta seccion-form">
          <h3 class="seccion-titulo">
            <span class="seccion-numero">2</span>
            Datos laborales
          </h3>
          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Cargo</label>
              <input
                type="text"
                class="campo-input"
                [(ngModel)]="form.cargo"
                name="cargo"
                placeholder="Cargo o función"
              >
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">Clase aportante</label>
              <select class="campo-input" [(ngModel)]="form.claseAportante" name="claseAportante">
                <option value="">Seleccionar...</option>
                <option value="Independiente">Independiente</option>
                <option value="Cooperativa">Cooperativa</option>
                <option value="Empresa">Empresa</option>
              </select>
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">Asopagos</label>
              <input
                type="text"
                class="campo-input"
                [(ngModel)]="form.asopagos"
                name="asopagos"
                placeholder="Asopagos"
              >
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">Días de pago</label>
              <input
                type="number"
                class="campo-input"
                [(ngModel)]="form.diasPago"
                name="diasPago"
                placeholder="0"
                min="0"
              >
            </div>

            <div class="campo-grupo campo-grupo--ancho">
              <label class="campo-etiqueta">Actividad económica</label>
              <input
                type="text"
                class="campo-input"
                [(ngModel)]="form.actividadEconomica"
                name="actividadEconomica"
                placeholder="Descripción de la actividad económica"
              >
            </div>
          </div>
        </div>

        <!-- SECCIÓN: Seguros -->
        <div class="tarjeta seccion-form">
          <h3 class="seccion-titulo">
            <span class="seccion-numero">3</span>
            Seguros
          </h3>
          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">EPS</label>
              <input
                type="text"
                class="campo-input"
                [(ngModel)]="form.eps"
                name="eps"
                placeholder="Nombre de la EPS"
              >
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">AFP (Pensión)</label>
              <input
                type="text"
                class="campo-input"
                [(ngModel)]="form.afp"
                name="afp"
                placeholder="Nombre de la AFP"
              >
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">ARL (%)</label>
              <input
                type="number"
                class="campo-input"
                [(ngModel)]="form.porcentajeArl"
                name="porcentajeArl"
                placeholder="0.00"
                min="0"
                max="100"
                step="0.01"
              >
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">Caja de compensación</label>
              <input
                type="text"
                class="campo-input"
                [(ngModel)]="form.caja"
                name="caja"
                placeholder="Nombre de la caja"
              >
            </div>
          </div>
        </div>

        <!-- SECCIÓN: Valores económicos -->
        <div class="tarjeta seccion-form">
          <h3 class="seccion-titulo">
            <span class="seccion-numero">4</span>
            Valores económicos
          </h3>
          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Valor base</label>
              <input
                type="number"
                class="campo-input"
                [(ngModel)]="form.valor"
                name="valor"
                placeholder="0"
                min="0"
                (ngModelChange)="calcularTotal()"
              >
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">Comisión</label>
              <input
                type="number"
                class="campo-input"
                [(ngModel)]="form.comision"
                name="comision"
                placeholder="0"
                min="0"
                (ngModelChange)="calcularTotal()"
              >
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">Total pago (calculado)</label>
              <input
                type="number"
                class="campo-input"
                [value]="totalPago"
                readonly
                style="background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.04)); cursor: not-allowed;"
              >
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">4 x Mil</label>
              <input
                type="number"
                class="campo-input"
                [(ngModel)]="form.cuatroXMil"
                name="cuatroXMil"
                placeholder="0"
                min="0"
              >
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">Cesantías</label>
              <input
                type="number"
                class="campo-input"
                [(ngModel)]="form.cesantias"
                name="cesantias"
                placeholder="0"
                min="0"
              >
            </div>
          </div>
        </div>

        <!-- SECCIÓN: Estado y fecha -->
        <div class="tarjeta seccion-form">
          <h3 class="seccion-titulo">
            <span class="seccion-numero">5</span>
            Estado y fechas
          </h3>
          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Estado inicial</label>
              <select class="campo-input" [(ngModel)]="form.estado" name="estado">
                <option value="ACTIVO">Activo</option>
                <option value="RETIRADO">Retirado</option>
                <option value="SUSPENDIDO">Suspendido</option>
              </select>
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">Fecha de ingreso</label>
              <input
                type="date"
                class="campo-input"
                [(ngModel)]="form.fechaIngreso"
                name="fechaIngreso"
              >
            </div>
          </div>
        </div>

        <!-- Acciones -->
        <div class="form-acciones">
          <button type="button" class="boton boton-secundario" (click)="volver()" [disabled]="guardando">
            Cancelar
          </button>
          <button type="submit" class="boton boton-primario" [disabled]="guardando">
            <span *ngIf="guardando" class="spinner-inline"></span>
            {{ guardando ? 'Guardando...' : 'Guardar afiliado' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .pagina-formulario { display: flex; flex-direction: column; gap: var(--espacio-5); max-width: 900px; }
    .form-encabezado { display: flex; align-items: center; gap: var(--espacio-4); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .pagina-subtitulo { font-size: var(--tamano-sm); color: var(--texto-terciario); margin: var(--espacio-1) 0 0; }

    .seccion-form { padding: var(--espacio-5); }
    .seccion-titulo { display: flex; align-items: center; gap: var(--espacio-3); font-size: var(--tamano-lg); font-weight: 600; color: var(--texto-principal); margin: 0 0 var(--espacio-5); }
    .seccion-numero { width: 28px; height: 28px; border-radius: 50%; background: var(--color-primario); color: white; display: flex; align-items: center; justify-content: center; font-size: var(--tamano-sm); font-weight: 700; flex-shrink: 0; }

    .campos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .campo-grupo--ancho { grid-column: 1 / -1; }

    .campo-error { border-color: var(--color-error) !important; }
    .mensaje-error { font-size: var(--tamano-sm); color: var(--color-error); }
    .requerido { color: var(--color-error); }

    .alerta-error { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radio-md); color: var(--color-error); font-size: var(--tamano-sm); }

    .form-acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); padding: var(--espacio-2) 0; }

    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }
    @keyframes girar { to { transform: rotate(360deg); } }
  `]
})
export class FormularioAfiliadoComponent implements OnInit {
  form: CrearAfiliadoDto & { caja?: string; cesantias?: number; cuatroXMil?: number } = {
    nombres: '',
    apellidos: '',
    cedula: '',
    correo: '',
    telefono: '',
    fechaNacimiento: '',
    cargo: '',
    claseAportante: '',
    asopagos: '',
    diasPago: undefined,
    porcentajeArl: undefined,
    actividadEconomica: '',
    valor: undefined,
    comision: undefined,
    totalPago: undefined,
    eps: '',
    afp: '',
    arl: '',
    caja: '',
    cuatroXMil: undefined,
    cesantias: undefined,
    estado: 'ACTIVO',
    fechaIngreso: new Date().toISOString().substring(0, 10),
  };

  errores: ErroresCampo = {};
  errorGlobal = '';
  guardando = false;
  totalPago = 0;

  constructor(
    private afiliadosServicio: AfiliadosServicio,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form.fechaIngreso = new Date().toISOString().substring(0, 10);
  }

  calcularTotal(): void {
    const valor = Number(this.form.valor) || 0;
    const comision = Number(this.form.comision) || 0;
    this.totalPago = valor + comision;
    this.form.totalPago = this.totalPago;
  }

  validarCampo(campo: keyof ErroresCampo): void {
    switch (campo) {
      case 'nombres':
        this.errores.nombres = this.form.nombres?.trim() ? '' : 'Los nombres son requeridos';
        break;
      case 'apellidos':
        this.errores.apellidos = this.form.apellidos?.trim() ? '' : 'Los apellidos son requeridos';
        break;
      case 'cedula':
        this.errores.cedula = this.form.cedula?.trim() ? '' : 'La cédula es requerida';
        break;
    }
  }

  validarTodo(): boolean {
    this.validarCampo('nombres');
    this.validarCampo('apellidos');
    this.validarCampo('cedula');
    return !this.errores.nombres && !this.errores.apellidos && !this.errores.cedula;
  }

  guardar(): void {
    if (!this.validarTodo()) return;

    this.guardando = true;
    this.errorGlobal = '';

    const dto: CrearAfiliadoDto = {
      nombres: this.form.nombres.trim(),
      apellidos: this.form.apellidos.trim(),
      cedula: this.form.cedula.trim(),
      correo: this.form.correo || undefined,
      telefono: this.form.telefono || undefined,
      fechaNacimiento: this.form.fechaNacimiento || undefined,
      cargo: this.form.cargo || undefined,
      claseAportante: this.form.claseAportante || undefined,
      asopagos: this.form.asopagos || undefined,
      diasPago: this.form.diasPago || undefined,
      porcentajeArl: this.form.porcentajeArl || undefined,
      actividadEconomica: this.form.actividadEconomica || undefined,
      valor: this.form.valor || undefined,
      comision: this.form.comision || undefined,
      totalPago: this.totalPago || undefined,
      eps: this.form.eps || undefined,
      afp: this.form.afp || undefined,
      arl: this.form.arl || undefined,
      caja: this.form.caja || undefined,
      estado: this.form.estado || 'ACTIVO',
      fechaIngreso: this.form.fechaIngreso || undefined,
    };

    this.afiliadosServicio.crear(dto).subscribe({
      next: (afiliado) => {
        this.guardando = false;
        this.router.navigate(['/admin/afiliados', afiliado.id]);
      },
      error: (err) => {
        this.guardando = false;
        this.errorGlobal = err?.error?.mensaje || 'Error al crear el afiliado. Verifique los datos e intente nuevamente.';
      }
    });
  }

  volver(): void {
    this.router.navigate(['/admin/afiliados']);
  }
}
