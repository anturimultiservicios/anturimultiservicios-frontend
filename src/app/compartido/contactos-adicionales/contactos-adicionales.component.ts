import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// 2026-10-15 (pedido de Cristopher): celulares y correos ADICIONALES. Por
// defecto no se ve ningún cuadro vacío: solo el botón "+ Agregar otro". Cada
// número o correo agregado se puede quitar.
@Component({
  selector: 'anturi-contactos-adicionales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ca">
      <div *ngFor="let v of valores; let i = index; trackBy: porIndice" class="ca__fila">
        <input [type]="tipo" class="campo-input" [ngModel]="v" (ngModelChange)="cambiar(i, $event)"
               [name]="nombre + '-' + i" [placeholder]="tipo === 'email' ? 'otro@correo.com' : 'Otro número'"
               [attr.aria-label]="etiqueta + ' ' + (i + 2)">
        <button type="button" class="ca__quitar" (click)="quitar(i)" [attr.aria-label]="'Quitar ' + etiqueta.toLowerCase()" title="Quitar">✕</button>
      </div>
      <button type="button" class="ca__agregar" (click)="agregar()" *ngIf="valores.length < 10">+ Agregar otro {{ etiqueta.toLowerCase() }}</button>
    </div>
  `,
  styles: [`
    .ca { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
    .ca__fila { display: flex; gap: 6px; align-items: center; }
    .ca__fila .campo-input { flex: 1; }
    .ca__quitar { border: 1px solid var(--borde-color, #e5e7eb); background: var(--fondo-tarjeta, #fff); color: var(--texto-terciario); border-radius: 8px; width: 34px; height: 34px; cursor: pointer; flex-shrink: 0; }
    .ca__quitar:hover { color: #dc2626; border-color: #dc2626; }
    .ca__agregar { align-self: flex-start; background: none; border: none; padding: 2px 0; color: var(--color-primario, #1b3270); font-size: var(--tamano-sm); cursor: pointer; font-weight: 600; }
    .ca__agregar:hover { text-decoration: underline; }
  `],
})
export class ContactosAdicionalesComponent {
  @Input() tipo: 'tel' | 'email' = 'tel';
  @Input() etiqueta = 'Celular';
  @Input() nombre = 'adicional';
  private _valores: string[] = [];
  @Input() set valores(v: string[] | null | undefined) { this._valores = Array.isArray(v) ? v : []; }
  get valores(): string[] { return this._valores; }
  @Output() valoresChange = new EventEmitter<string[]>();

  porIndice = (i: number) => i;

  agregar(): void {
    this.valores = [...(this.valores ?? []), ''];
    this.valoresChange.emit(this.valores);
  }

  cambiar(i: number, v: string): void {
    this.valores = this.valores.map((x, j) => (j === i ? v : x));
    this.valoresChange.emit(this.valores);
  }

  quitar(i: number): void {
    this.valores = this.valores.filter((_, j) => j !== i);
    this.valoresChange.emit(this.valores);
  }
}

// Limpia la lista antes de guardar: sin vacíos ni repetidos.
export function limpiarContactos(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const x of lista) {
    const t = String(x ?? '').trim();
    if (t && !vistos.has(t.toLowerCase())) { vistos.add(t.toLowerCase()); salida.push(t); }
  }
  return salida;
}
