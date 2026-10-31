import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { entorno } from '../../../environments/entorno';
import { GRUPOS_PRESUNCION, PRESUNCION_COSTOS, calcularPresuncion, OpcionPresuncion, ResultadoPresuncion } from '../../nucleo/utilidades/presuncion-costos';

// 2026-10-31 (Anturi): calculadora de PRESUNCIÓN DE COSTOS UGPP, dentro de la
// calculadora flotante (todos los roles). Se escriben los contratos, se escoge
// la actividad según la tabla del gobierno y sale el IBC para pago de una vez.
// El cálculo paso a paso queda escondido ("Ver cómo se calculó").
const CLAVE = 'anturi_presuncion_costos';

@Component({
  selector: 'anturi-presuncion-costos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pc">
      <label class="pc__etiqueta" for="pcActividad">Actividad (según la tabla UGPP)</label>
      <select id="pcActividad" class="pc__input" [(ngModel)]="clave" (ngModelChange)="recordar()">
        <optgroup *ngFor="let g of grupos" [label]="g">
          <option *ngFor="let o of opcionesDe(g)" [value]="o.clave">{{ o.nombre }} · {{ o.porcentaje | number:'1.2-2' }}%</option>
        </optgroup>
        <option value="OTRO">Otro porcentaje (escribirlo)</option>
      </select>
      <div *ngIf="clave === 'OTRO'" class="pc__fila">
        <label class="pc__etiqueta" for="pcOtro">Porcentaje de costos</label>
        <input id="pcOtro" class="pc__input pc__input--corto" type="number" min="0" max="100" step="0.01" [(ngModel)]="otroPorcentaje" (ngModelChange)="recordar()"> %
      </div>

      <span class="pc__etiqueta">Valor de los contratos (o ingresos)</span>
      <div *ngFor="let c of contratos; let i = index; trackBy: porIndice" class="pc__contrato">
        <input class="pc__input" type="number" min="0" step="1000" [(ngModel)]="contratos[i]" [attr.aria-label]="'Contrato ' + (i + 1)" [placeholder]="'Contrato ' + (i + 1)">
        <button *ngIf="contratos.length > 1" type="button" class="pc__quitar" (click)="contratos.splice(i, 1)" [attr.aria-label]="'Quitar contrato ' + (i + 1)">✕</button>
      </div>
      <button type="button" class="pc__agregar" (click)="contratos.push(null)">+ Otro contrato</button>

      <div class="pc__resultado" *ngIf="resultado.total > 0" aria-live="polite">
        <span class="pc__resultado-etiqueta">IBC para pago</span>
        <strong class="pc__resultado-valor">{{ resultado.ibcPago | currency:'COP':'symbol-narrow':'1.0-0' }}</strong>
        <span class="pc__nota">Costos presuntos del {{ porcentaje | number:'1.2-2' }}%</span>
        <span *ngIf="resultado.ajuste === 'MINIMO'" class="pc__aviso">Daba {{ resultado.ibcCalculado | currency:'COP':'symbol-narrow':'1.0-0' }}, pero el IBC no puede ser menor a 1 salario mínimo.</span>
        <span *ngIf="resultado.ajuste === 'MAXIMO'" class="pc__aviso">Daba {{ resultado.ibcCalculado | currency:'COP':'symbol-narrow':'1.0-0' }}, pero el IBC no puede pasar de 25 salarios mínimos.</span>
        <button type="button" class="pc__copiar" (click)="copiar()">{{ copiado ? 'Copiado ✓' : 'Copiar valor' }}</button>
      </div>

      <details class="pc__detalle" *ngIf="resultado.total > 0">
        <summary>Ver cómo se calculó</summary>
        <dl>
          <dt>Valor total de los contratos</dt><dd>{{ resultado.total | currency:'COP':'symbol-narrow':'1.0-0' }}</dd>
          <dt>Costos presuntos ({{ porcentaje | number:'1.2-2' }}%)</dt><dd>− {{ resultado.costos | currency:'COP':'symbol-narrow':'1.0-0' }}</dd>
          <dt>Base para liquidar</dt><dd>{{ resultado.base | currency:'COP':'symbol-narrow':'1.0-0' }}</dd>
          <dt>IBC (40% de la base)</dt><dd>{{ resultado.ibcCalculado | currency:'COP':'symbol-narrow':'1.0-0' }}</dd>
        </dl>
        <p class="pc__fuente">Tabla: Resolución UGPP 532 de 2024 (desde el 9 de mayo de 2026). Si tiene soportes de costos reales, se pueden usar en vez de la presunción.</p>
      </details>
    </div>
  `,
  styles: [`
    .pc { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px 12px; }
    .pc__etiqueta { font-size: 12px; font-weight: 600; color: var(--texto-secundario, #475569); }
    .pc__input { width: 100%; padding: 7px 9px; border-radius: 8px; border: 1px solid var(--borde-color, #cbd5e1); background: var(--fondo-input, #fff); color: var(--texto-principal, #0f172a); font-size: 14px; }
    .pc__input--corto { width: 90px; }
    .pc__fila { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .pc__contrato { display: flex; gap: 6px; align-items: center; }
    .pc__quitar { border: none; background: transparent; color: var(--texto-terciario, #94a3b8); cursor: pointer; font-size: 14px; padding: 4px; }
    .pc__agregar { align-self: flex-start; border: none; background: transparent; color: var(--color-primario, #1B3270); font-weight: 600; cursor: pointer; padding: 2px 0; font-size: 13px; }
    .pc__resultado { margin-top: 6px; padding: 12px; border-radius: 12px; background: rgba(232, 87, 12, 0.08); border: 1px solid rgba(232, 87, 12, 0.35); display: flex; flex-direction: column; gap: 2px; text-align: center; }
    .pc__resultado-etiqueta { font-size: 12px; color: var(--texto-secundario, #475569); text-transform: uppercase; font-weight: 700; letter-spacing: .03em; }
    .pc__resultado-valor { font-size: 26px; color: var(--color-secundario, #E8570C); }
    .pc__nota { font-size: 12px; color: var(--texto-terciario, #64748b); }
    .pc__aviso { font-size: 12px; color: #b45309; }
    .pc__copiar { margin-top: 6px; align-self: center; border: 1px solid var(--color-secundario, #E8570C); color: var(--color-secundario, #E8570C); background: transparent; border-radius: 999px; padding: 3px 12px; font-size: 12px; cursor: pointer; }
    .pc__detalle { font-size: 12px; color: var(--texto-secundario, #475569); }
    .pc__detalle summary { cursor: pointer; font-weight: 600; }
    .pc__detalle dl { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; margin: 6px 0; }
    .pc__detalle dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
    .pc__fuente { margin: 4px 0 0; color: var(--texto-terciario, #64748b); }
  `],
})
export class PresuncionCostosComponent implements OnInit {
  readonly grupos = GRUPOS_PRESUNCION;
  clave = 'R';
  otroPorcentaje: number | null = null;
  contratos: (number | null)[] = [null];
  smlmv: number | null = null;
  copiado = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (g?.clave) this.clave = g.clave;
      if (typeof g?.otroPorcentaje === 'number') this.otroPorcentaje = g.otroPorcentaje;
    } catch { /* sin almacenamiento */ }
    this.http.get<{ smlmv: number }>(`${entorno.urlApi}/parametros-legales/salario-minimo`)
      .pipe(catchError(() => of(null)))
      .subscribe((r) => (this.smlmv = r?.smlmv ?? null));
  }

  opcionesDe(grupo: string): OpcionPresuncion[] {
    return PRESUNCION_COSTOS.filter((o) => o.grupo === grupo);
  }

  get porcentaje(): number {
    if (this.clave === 'OTRO') return Math.min(100, Math.max(0, Number(this.otroPorcentaje) || 0));
    return PRESUNCION_COSTOS.find((o) => o.clave === this.clave)?.porcentaje ?? 0;
  }

  get resultado(): ResultadoPresuncion {
    return calcularPresuncion(this.contratos.map((v) => Number(v) || 0), this.porcentaje, this.smlmv);
  }

  porIndice(i: number): number { return i; }

  recordar(): void {
    try { localStorage.setItem(CLAVE, JSON.stringify({ clave: this.clave, otroPorcentaje: this.otroPorcentaje })); } catch { /* sin almacenamiento */ }
  }

  copiar(): void {
    const texto = String(this.resultado.ibcPago);
    navigator.clipboard?.writeText(texto).then(() => {
      this.copiado = true;
      setTimeout(() => (this.copiado = false), 2000);
    }).catch(() => undefined);
  }
}
