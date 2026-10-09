import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, filter, of } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { AfiliadosServicio, CrearAfiliadoDto, GeneroAfiliado, ClaseRiesgoArl } from '../../../nucleo/servicios/afiliados.servicio';
import { DocumentosServicio } from '../../../nucleo/servicios/documentos.servicio';
import { TIPOS_DOCUMENTO } from '../../../nucleo/utilidades/tipos-documento';

// 2026-10-09 (pedido de Cristopher): PLANTILLA DE COOPERATIVA. Los asociados
// pagan la cuota y la comisión (15.000 por defecto, editable) - no se les
// cobra 4x1000 ni la afiliación de cliente nuevo. El total girado se arma
// solo (cuota + comisión) pero se puede cambiar. Los pagos entran al
// Recaudo como los demás. La ven y la usan todos los roles.
const COMISION_COOPERATIVA = 15000;

import { ListasEntidadesComponent } from '../../../compartido/listas-entidades/listas-entidades.component';
@Component({
  selector: 'anturi-formulario-cooperativa',
  standalone: true,
  imports: [CommonModule, FormsModule, ListasEntidadesComponent],
  template: `
    <anturi-listas-entidades></anturi-listas-entidades>
    <div class="coop">
      <div class="coop__encabezado">
        <button class="boton boton-icono" (click)="volver()" title="Volver">‹</button>
        <div>
          <h2 class="pagina-titulo">Nuevo asociado de cooperativa</h2>
          <p class="coop__ayuda">Paga la cuota y la comisión. Sin 4x1000 y sin cobro de afiliación de cliente nuevo.</p>
        </div>
      </div>

      <form (ngSubmit)="guardar()" #f="ngForm" class="coop__form">
        <!-- 1. Persona -->
        <div class="tarjeta seccion">
          <h3 class="seccion__titulo"><span class="num">1</span> Datos de la persona</h3>
          <div class="grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Nombres <span class="requerido">*</span></label>
              <input class="campo-input" name="nombres" [(ngModel)]="form.nombres" required>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Apellidos <span class="requerido">*</span></label>
              <input class="campo-input" name="apellidos" [(ngModel)]="form.apellidos" required>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Tipo de documento</label>
              <select class="campo-input" name="tipoDocumento" [(ngModel)]="form.tipoDocumento">
                <option *ngFor="let t of tiposDocumento" [value]="t.valor">{{ t.nombre }}</option>
              </select>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Número de documento <span class="requerido">*</span></label>
              <input class="campo-input" name="cedula" [(ngModel)]="form.cedula" required>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Género <span class="requerido">*</span></label>
              <select class="campo-input" name="genero" [(ngModel)]="form.genero" required>
                <option [ngValue]="null" disabled>Seleccione...</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="INDETERMINADO">Indeterminado</option>
              </select>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Teléfono</label>
              <input class="campo-input" name="telefono" [(ngModel)]="form.telefono">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Dirección</label>
              <input class="campo-input" name="direccion" [(ngModel)]="form.direccion">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Municipio</label>
              <input class="campo-input" name="municipio" [(ngModel)]="form.municipio" placeholder="Ej: Quimbaya, Quindío">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Fecha de ingreso</label>
              <input type="date" class="campo-input" name="fechaIngreso" [(ngModel)]="form.fechaIngreso">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Fecha de retiro</label>
              <input type="date" class="campo-input" name="fechaRetiro" [(ngModel)]="form.fechaRetiro">
            </div>
          </div>
        </div>

        <!-- 2. Seguridad social -->
        <div class="tarjeta seccion">
          <h3 class="seccion__titulo"><span class="num">2</span> Entidades</h3>
          <div class="grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">EPS</label>
              <input class="campo-input" name="eps" list="lista-eps" [(ngModel)]="form.eps" placeholder="Nombre de la EPS">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">ARL</label>
              <input class="campo-input" name="arl" list="lista-arl" [(ngModel)]="form.arl" placeholder="Ej: ARL La Equidad">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Clase de riesgo ARL</label>
              <select class="campo-input" name="claseRiesgoArl" [(ngModel)]="form.claseRiesgoArl">
                <option [ngValue]="undefined">Sin ARL</option>
                <option *ngFor="let c of clasesArl" [ngValue]="c">Riesgo {{ c }}</option>
              </select>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Pensión</label>
              <input class="campo-input" name="afp" list="lista-pension" [(ngModel)]="form.afp" placeholder="Ej: Colpensiones">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Caja de compensación</label>
              <input class="campo-input" name="caja" list="lista-caja" [(ngModel)]="form.caja" placeholder="Nombre de la caja">
            </div>
          </div>
        </div>

        <!-- 3. Valores -->
        <div class="tarjeta seccion">
          <h3 class="seccion__titulo"><span class="num">3</span> Valores</h3>
          <div class="grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Salario</label>
              <input type="number" class="campo-input" name="salario" [(ngModel)]="form.salario" min="0" step="1000">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Valor de la cuota <span class="requerido">*</span></label>
              <input type="number" class="campo-input" name="cuota" [(ngModel)]="form.cuota" (ngModelChange)="recalcularTotal()" min="0" step="100" required>
              <span class="campo-ayuda">Lo que se gira a seguridad social.</span>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Comisión</label>
              <input type="number" class="campo-input" name="comision" [(ngModel)]="form.comision" (ngModelChange)="recalcularTotal()" min="0" step="1000">
              <span class="campo-ayuda">Por defecto 15.000 - se puede cambiar.</span>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Total girado (mensual)</label>
              <input type="number" class="campo-input" name="total" [(ngModel)]="form.total" (ngModelChange)="totalManual = true" min="0" step="100">
              <span class="campo-ayuda" *ngIf="!totalManual">Cuota + comisión. Se puede cambiar.</span>
              <button type="button" *ngIf="totalManual" class="enlace" (click)="totalManual = false; recalcularTotal()">Volver a cuota + comisión</button>
            </div>
          </div>
          <p class="coop__resumen">
            Cada mes: <b>{{ (form.cuota || 0) | currency:'COP':'symbol-narrow':'1.0-0' }}</b> de cuota +
            <b>{{ (form.comision || 0) | currency:'COP':'symbol-narrow':'1.0-0' }}</b> de comisión =
            <b>{{ (form.total || 0) | currency:'COP':'symbol-narrow':'1.0-0' }}</b>. Sin 4x1000 ni afiliación.
          </p>
        </div>

        <!-- 4. Recibo -->
        <div class="tarjeta seccion">
          <h3 class="seccion__titulo"><span class="num">4</span> Recibo de pago</h3>
          <input type="file" accept="image/*,application/pdf" (change)="elegirRecibo($event)">
          <p class="campo-ayuda">{{ recibo ? recibo.name : 'Opcional. Se guarda en los documentos de la ficha.' }}</p>
        </div>

        <div *ngIf="error" class="alerta-error">{{ error }}</div>
        <div class="coop__acciones">
          <button type="button" class="boton boton-secundario" (click)="volver()" [disabled]="guardando">Cancelar</button>
          <button type="submit" class="boton boton-primario" [disabled]="guardando">{{ guardando ? 'Guardando...' : 'Guardar asociado' }}</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .coop { display: flex; flex-direction: column; gap: var(--espacio-4); max-width: 1000px; }
    .coop__encabezado { display: flex; gap: var(--espacio-3); align-items: center; }
    .coop__encabezado .boton-icono { font-size: 1.5rem; width: 38px; height: 38px; }
    .pagina-titulo { margin: 0; font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); }
    .coop__ayuda { margin: 2px 0 0; color: var(--texto-secundario); font-size: var(--tamano-sm); }
    .coop__form { display: flex; flex-direction: column; gap: var(--espacio-4); }
    .seccion { padding: var(--espacio-5); }
    .seccion__titulo { display: flex; align-items: center; gap: var(--espacio-2); margin: 0 0 var(--espacio-4); font-size: var(--tamano-lg); }
    .num { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: var(--color-primario); color: #fff; font-size: var(--tamano-sm); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: 4px; }
    .campo-ayuda { font-size: var(--tamano-xs); color: var(--texto-terciario); margin: 0; }
    .requerido { color: var(--color-error); }
    .enlace { align-self: flex-start; border: none; background: none; padding: 0; color: var(--color-primario); font-size: var(--tamano-xs); cursor: pointer; text-decoration: underline; }
    .coop__resumen { margin: var(--espacio-4) 0 0; font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .coop__acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); }
  `],
})
export class FormularioCooperativaComponent {
  readonly tiposDocumento = TIPOS_DOCUMENTO;
  readonly clasesArl: ClaseRiesgoArl[] = ['I', 'II', 'III', 'IV', 'V'];

  form: {
    nombres: string; apellidos: string; tipoDocumento: string; cedula: string; genero: GeneroAfiliado | null;
    telefono: string; direccion: string; municipio: string; fechaIngreso: string; fechaRetiro: string;
    eps: string; arl: string; claseRiesgoArl?: ClaseRiesgoArl; afp: string; caja: string;
    salario: number | null; cuota: number | null; comision: number | null; total: number | null;
  } = {
    nombres: '', apellidos: '', tipoDocumento: 'CC', cedula: '', genero: null,
    telefono: '', direccion: '', municipio: '', fechaIngreso: '', fechaRetiro: '',
    eps: '', arl: '', claseRiesgoArl: undefined, afp: '', caja: '',
    salario: null, cuota: null, comision: COMISION_COOPERATIVA, total: COMISION_COOPERATIVA,
  };
  totalManual = false;
  recibo: File | null = null;
  guardando = false;
  error = '';

  constructor(private afiliados: AfiliadosServicio, private documentos: DocumentosServicio, private router: Router) {}

  private get prefijo(): string {
    return this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
  }

  recalcularTotal(): void {
    if (this.totalManual) return;
    this.form.total = (Number(this.form.cuota) || 0) + (Number(this.form.comision) || 0);
  }

  elegirRecibo(e: Event): void {
    this.recibo = (e.target as HTMLInputElement).files?.[0] ?? null;
  }

  volver(): void {
    this.router.navigate([this.prefijo, 'afiliados', 'nuevo']);
  }

  guardar(): void {
    const f = this.form;
    if (!f.nombres.trim() || !f.apellidos.trim() || !f.cedula.trim() || !f.genero) {
      this.error = 'Complete nombres, apellidos, número de documento y género.';
      return;
    }
    if (!(Number(f.cuota) > 0)) {
      this.error = 'Escriba el valor de la cuota.';
      return;
    }
    const retirado = !!f.fechaRetiro && new Date(f.fechaRetiro + 'T12:00:00') <= new Date();
    const dto: CrearAfiliadoDto = {
      nombres: f.nombres.trim(),
      apellidos: f.apellidos.trim(),
      tipoDocumento: f.tipoDocumento,
      cedula: f.cedula.trim(),
      genero: f.genero,
      telefono: f.telefono.trim() || undefined,
      direccion: f.direccion.trim() || undefined,
      municipio: f.municipio.trim() || undefined,
      fechaIngreso: f.fechaIngreso || undefined,
      fechaRetiro: f.fechaRetiro || undefined,
      eps: f.eps.trim() || undefined,
      arl: f.arl.trim() || undefined,
      afp: f.afp.trim() || undefined,
      caja: f.caja.trim() || undefined,
      claseRiesgoArl: f.claseRiesgoArl,
      tipoAfiliacion: 'COOPERATIVA',
      claseAportante: 'COOPERATIVA',
      ibc: Number(f.salario) > 0 ? Number(f.salario) : undefined,
      valor: Number(f.cuota),
      comision: Number(f.comision) || 0,
      cuatroXMil: 0,
      valorAfiliacion: 0,
      totalPago: Number(f.total) || (Number(f.cuota) + (Number(f.comision) || 0)),
      estado: retirado ? 'RETIRADO' : 'ACTIVO',
    } as CrearAfiliadoDto;

    this.guardando = true;
    this.error = '';
    this.afiliados.crear(dto).subscribe({
      next: (afiliado) => {
        const ir = () => { this.guardando = false; this.router.navigate([this.prefijo, 'afiliados', afiliado.id]); };
        // El recibo se sube a la ficha (si se guardó sin internet, se sube después desde la ficha).
        if (!this.recibo || !(afiliado.id > 0)) { ir(); return; }
        this.documentos.subir(afiliado.id, this.recibo, 'RECIBO_PAGO', 'Recibo de pago').pipe(
          filter((ev) => ev.type === HttpEventType.Response),
          catchError(() => of(null)),
        ).subscribe({ next: ir, complete: ir });
      },
      error: (err) => {
        this.guardando = false;
        const m = err?.error?.message;
        this.error = (Array.isArray(m) ? m.join('. ') : m) || 'No se pudo guardar.';
      },
    });
  }
}
