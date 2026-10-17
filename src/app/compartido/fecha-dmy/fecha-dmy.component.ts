import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// 2026-10-16: fecha por 3 desplegables (día / mes / año) - el calendario
// nativo obliga a retroceder mes a mes para llegar a una fecha de
// nacimiento o de expedición vieja (lo pidió Cristopher el 2026-10-07).
// Uso: <anturi-fecha-dmy [(valor)]="form.fechaNacimiento" etiqueta="Fecha de nacimiento" />
// El valor es "AAAA-MM-DD" o '' (sin fecha).
@Component({
  selector: 'anturi-fecha-dmy',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fecha-dmy" role="group" [attr.aria-label]="etiqueta">
      <select class="campo-input" [(ngModel)]="dia" (ngModelChange)="emitir()" [attr.aria-label]="etiqueta + ': día'">
        <option [ngValue]="null">Día</option>
        <option *ngFor="let d of dias" [ngValue]="d">{{ d }}</option>
      </select>
      <select class="campo-input" [(ngModel)]="mes" (ngModelChange)="emitir()" [attr.aria-label]="etiqueta + ': mes'">
        <option [ngValue]="null">Mes</option>
        <option *ngFor="let m of meses; let i = index" [ngValue]="i + 1">{{ m }}</option>
      </select>
      <select class="campo-input" [(ngModel)]="anio" (ngModelChange)="emitir()" [attr.aria-label]="etiqueta + ': año'">
        <option [ngValue]="null">Año</option>
        <option *ngFor="let a of anios" [ngValue]="a">{{ a }}</option>
      </select>
    </div>
  `,
  styles: [`
    .fecha-dmy { display: grid; grid-template-columns: 1fr 1.6fr 1fr; gap: var(--espacio-2, 8px); max-width: 420px; }
  `],
})
export class FechaDmyComponent {
  @Input() etiqueta = 'Fecha';
  // cuántos años hacia atrás muestra (nacimiento de un abuelo: 110)
  @Input() aniosAtras = 110;
  @Output() valorChange = new EventEmitter<string>();

  readonly meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  dia: number | null = null;
  mes: number | null = null;
  anio: number | null = null;

  @Input() set valor(v: string | null | undefined) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? '');
    if (m) { this.anio = +m[1]; this.mes = +m[2]; this.dia = +m[3]; }
    else if (!v) { this.anio = this.mes = this.dia = null; }
  }

  get anios(): number[] {
    const hoy = new Date().getFullYear();
    return Array.from({ length: this.aniosAtras + 1 }, (_, i) => hoy - i);
  }

  get dias(): number[] {
    const max = this.mes ? new Date(this.anio ?? 2000, this.mes, 0).getDate() : 31;
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  emitir(): void {
    if (this.dia && this.mes && this.anio) {
      const max = new Date(this.anio, this.mes, 0).getDate();
      if (this.dia > max) this.dia = max;
      this.valorChange.emit(`${this.anio}-${String(this.mes).padStart(2, '0')}-${String(this.dia).padStart(2, '0')}`);
    } else if (!this.dia && !this.mes && !this.anio) {
      this.valorChange.emit('');
    }
  }
}
