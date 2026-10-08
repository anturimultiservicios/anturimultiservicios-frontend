import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NuevaCredencial, TIPOS_CREDENCIAL, TipoCredencial } from '../../nucleo/servicios/credenciales.servicio';

// 2026-10-08: al CREAR una empresa o un afiliado, opción de dejar de una vez
// sus usuarios y claves de portales. Se guardan apenas se crea el registro.
@Component({
  selector: 'anturi-credenciales-nuevas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cn">
      <label class="cn-check">
        <input type="checkbox" [(ngModel)]="activo" name="cn-activo" (change)="alActivar()">
        Tiene usuario y clave de algún portal (operador PILA, EPS, pensión, ARL, caja...)
      </label>
      <ng-container *ngIf="activo">
        <div *ngFor="let c of lista; let i = index" class="cn-fila">
          <select class="campo-input" [(ngModel)]="c.tipo" [name]="'cn-tipo-' + i">
            <option *ngFor="let t of tipos" [value]="t.valor">{{ t.nombre }}</option>
          </select>
          <input class="campo-input" [(ngModel)]="c.entidad" [name]="'cn-entidad-' + i" [placeholder]="'Entidad (ej. ' + ejemplo(c.tipo) + ')'">
          <input class="campo-input" [(ngModel)]="c.usuario" [name]="'cn-usuario-' + i" placeholder="Usuario" autocomplete="off">
          <input class="campo-input" [(ngModel)]="c.clave" [name]="'cn-clave-' + i" placeholder="Clave" autocomplete="new-password">
          <button type="button" class="cn-quitar" (click)="quitar(i)" title="Quitar">✕</button>
        </div>
        <button type="button" class="cn-agregar" (click)="agregar()">+ Agregar otro portal</button>
        <span class="cn-ayuda">Las claves se guardan cifradas. Solo se muestran con "Ver clave" y queda registrado quién las consultó.</span>
      </ng-container>
    </div>
  `,
  styles: [`
    .cn { display: flex; flex-direction: column; gap: 8px; }
    .cn-check { display: flex; align-items: center; gap: 8px; font-size: var(--tamano-sm, 14px); color: var(--texto-principal, #111827); cursor: pointer; }
    .cn-fila { display: grid; grid-template-columns: 1.1fr 1.3fr 1fr 1fr auto; gap: 6px; align-items: center; }
    @media (max-width: 720px) { .cn-fila { grid-template-columns: 1fr 1fr; } }
    .cn-quitar { background: none; border: 1px solid var(--borde-color, #d1d5db); border-radius: 6px; width: 32px; height: 32px; cursor: pointer; color: #b91c1c; }
    .cn-agregar { align-self: flex-start; background: none; border: none; color: var(--color-primario, #1B3270); font-weight: 600; cursor: pointer; padding: 0; font-size: var(--tamano-sm, 14px); }
    .cn-ayuda { font-size: var(--tamano-xs, 12px); color: var(--texto-terciario, #6b7280); }
  `],
})
export class CredencialesNuevasComponent {
  @Input() lista: NuevaCredencial[] = [];
  @Output() listaChange = new EventEmitter<NuevaCredencial[]>();
  readonly tipos = TIPOS_CREDENCIAL;
  activo = false;

  ejemplo(t: TipoCredencial): string {
    return TIPOS_CREDENCIAL.find((x) => x.valor === t)?.ejemplo.split(',')[0] ?? '';
  }

  alActivar(): void {
    if (this.activo && this.lista.length === 0) this.agregar();
    if (!this.activo) { this.lista = []; this.listaChange.emit(this.lista); }
  }

  agregar(): void {
    this.lista = [...this.lista, { tipo: this.lista.length === 0 ? 'OPERADOR_PILA' : 'EPS', entidad: this.lista.length === 0 ? 'Asopagos' : '', usuario: '', clave: '' }];
    this.listaChange.emit(this.lista);
  }

  quitar(i: number): void {
    this.lista = this.lista.filter((_, j) => j !== i);
    this.listaChange.emit(this.lista);
  }
}

// Solo las filas con entidad y usuario o clave.
export function credencialesValidas(lista: NuevaCredencial[]): NuevaCredencial[] {
  return lista
    .filter((c) => (c.entidad ?? '').trim().length >= 2 && ((c.usuario ?? '').trim() || (c.clave ?? '').trim()))
    .map((c) => ({ tipo: c.tipo, entidad: c.entidad.trim(), usuario: (c.usuario ?? '').trim() || undefined, clave: (c.clave ?? '').trim() || undefined }));
}
