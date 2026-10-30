import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// 2026-10-30 (Cristopher: "con la opción de ¿seguro que quieres eliminar?,
// algo así bien bonito"): confirmación para eliminar de verdad. Pide el
// motivo y, para no eliminar por un toque sin querer, que se marque la casilla.
@Component({
  selector: 'anturi-confirmar-eliminar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="cancelar.emit()">
      <div class="ce" role="alertdialog" aria-labelledby="ceTitulo" aria-describedby="ceTexto" (click)="$event.stopPropagation()">
        <div class="ce__icono" aria-hidden="true">🗑️</div>
        <h3 id="ceTitulo" class="ce__titulo">¿Seguro que quiere eliminar a {{ nombre }}?</h3>
        <p id="ceTexto" class="ce__texto">{{ detalle || 'Esto no se puede deshacer. Queda anotado en el historial quién lo eliminó y por qué.' }}</p>
        <label class="campo-etiqueta" for="ceMotivo">¿Por qué se elimina? *</label>
        <input id="ceMotivo" class="campo-input" [(ngModel)]="motivo" placeholder="Ej. estaba repetida, se creó por error" maxlength="300">
        <label class="ce__seguro"><input type="checkbox" [(ngModel)]="seguro"> Sí, estoy seguro(a) de eliminarlo</label>
        <p *ngIf="error" class="ce__error" role="alert">{{ error }}</p>
        <div class="ce__acciones">
          <button type="button" class="boton boton-secundario" (click)="cancelar.emit()" [disabled]="trabajando">No, cancelar</button>
          <button type="button" class="boton boton-peligro" [disabled]="trabajando || !seguro || motivo.trim().length < 3" (click)="confirmar.emit(motivo.trim())">
            {{ trabajando ? 'Eliminando…' : 'Sí, eliminar' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ce { background: var(--fondo-tarjeta, #fff); border-radius: 18px; width: min(440px, calc(100% - 32px)); padding: 24px 20px 18px; display: flex; flex-direction: column; gap: 8px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.25); animation: ce-entrar .18s ease-out; }
    .ce__icono { font-size: 34px; width: 64px; height: 64px; margin: 0 auto 4px; display: grid; place-items: center; border-radius: 50%; background: rgba(239, 68, 68, 0.12); }
    .ce__titulo { margin: 0; font-size: 18px; color: var(--texto-principal); }
    .ce__texto { margin: 0 0 6px; color: var(--texto-secundario); font-size: var(--tamano-sm); }
    .ce .campo-etiqueta, .ce .campo-input { text-align: left; }
    .ce__seguro { display: flex; gap: 8px; align-items: center; justify-content: center; font-size: var(--tamano-sm); color: var(--texto-principal); margin-top: 4px; }
    .ce__error { color: #b42318; font-size: var(--tamano-sm); margin: 0; }
    .ce__acciones { display: flex; gap: 8px; justify-content: center; margin-top: 8px; flex-wrap: wrap; }
    @keyframes ce-entrar { from { transform: scale(.94); opacity: 0; } to { transform: none; opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .ce { animation: none; } }
  `],
})
export class ConfirmarEliminarComponent {
  @Input() nombre = '';
  @Input() detalle = '';
  @Input() trabajando = false;
  @Input() error = '';
  @Output() confirmar = new EventEmitter<string>();
  @Output() cancelar = new EventEmitter<void>();
  motivo = '';
  seguro = false;
}
