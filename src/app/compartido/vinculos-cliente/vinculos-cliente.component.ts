import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClienteRef, ClientesServicio, RELACIONES, TipoCliente, Vinculo } from '../../nucleo/servicios/clientes.servicio';
import { BuscarClienteComponent } from '../buscar-cliente/buscar-cliente.component';

// 2026-10-22 (Cristopher/Anyi): familia o relación con OTROS CLIENTES (ej.
// "Esposa de Jaime"). Se ve en las dos fichas. Distinto de "Familia /
// beneficiarios" (beneficiarios de la EPS que no son clientes).
@Component({
  selector: 'anturi-vinculos-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BuscarClienteComponent],
  template: `
    <div class="vc-cab">
      <h3 class="seccion-titulo">Familia o relación con otros clientes ({{ vinculos.length }})</h3>
      <button *ngIf="!creando" type="button" class="boton boton-secundario boton-sm" (click)="creando = true">+ Agregar vínculo</button>
    </div>
    <p *ngIf="mensaje" class="vc-ok" role="status">{{ mensaje }}</p>
    <p *ngIf="error" class="vc-error" role="alert">{{ error }}</p>
    <p *ngIf="!vinculos.length && !creando" class="vc-sub">Ej. esposa de otro cliente, hijo de, recomendado por…</p>
    <ul *ngIf="vinculos.length" class="vc-lista">
      <li *ngFor="let v of vinculos">
        <span>{{ v.etiqueta }}{{ v.relacion === 'RECOMENDADO_POR' || v.relacion === 'RECOMENDO' ? ' ' : ' de ' }}<a [routerLink]="[prefijo, v.otro.tipo === 'EMPRESA' ? 'empresas' : 'afiliados', v.otro.id]">{{ v.otro.nombre }}</a>
          <small> · {{ v.otro.tipo === 'EMPRESA' ? 'cuenta empleador' : 'afiliado' }}{{ v.nota ? ' · ' + v.nota : '' }}</small></span>
        <button type="button" class="boton boton-texto boton-sm" (click)="quitar(v)" [attr.aria-label]="'Quitar vínculo con ' + v.otro.nombre">Quitar</button>
      </li>
    </ul>
    <div *ngIf="creando" class="vc-form">
      <label class="campo-etiqueta" for="vcRel">Este cliente es…</label>
      <select id="vcRel" class="campo-input" [(ngModel)]="relacion">
        <option *ngFor="let r of relaciones" [value]="r.valor">{{ r.nombre }}</option>
      </select>
      <span class="campo-etiqueta">…de quién</span>
      <anturi-buscar-cliente [excluir]="{ tipo: tipo, id: id }" (elegido)="destino = $event"></anturi-buscar-cliente>
      <label class="campo-etiqueta" for="vcNota">Nota (opcional)</label>
      <input id="vcNota" class="campo-input" [(ngModel)]="nota" placeholder="Ej. el ingeniero">
      <div class="vc-acciones">
        <button type="button" class="boton boton-secundario boton-sm" (click)="creando = false">Cancelar</button>
        <button type="button" class="boton boton-primario boton-sm" [disabled]="!destino || guardando" (click)="guardar()">{{ guardando ? 'Guardando…' : 'Guardar vínculo' }}</button>
      </div>
    </div>
  `,
  styles: [`
    .vc-cab { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .vc-sub { color: var(--texto-terciario); font-size: var(--tamano-sm); margin: 0; }
    .vc-ok { color: #1f7a3d; font-size: var(--tamano-sm); }
    .vc-error { color: #b42318; font-size: var(--tamano-sm); }
    .vc-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .vc-lista li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--borde-color, #e5e7eb); border-radius: 8px; }
    .vc-lista a { font-weight: 700; color: var(--color-primario, #1B3270); }
    .vc-lista small { color: var(--texto-terciario); }
    .vc-form { display: flex; flex-direction: column; gap: 6px; padding: 12px; border: 1px solid var(--borde-color, #e5e7eb); border-radius: 10px; max-width: 560px; }
    .vc-acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
  `],
})
export class VinculosClienteComponent implements OnChanges {
  @Input() tipo!: TipoCliente;
  @Input() id!: number;
  readonly relaciones = RELACIONES;
  vinculos: Vinculo[] = [];
  creando = false;
  guardando = false;
  relacion = 'CONYUGE';
  destino: ClienteRef | null = null;
  nota = '';
  mensaje = '';
  error = '';

  constructor(private servicio: ClientesServicio, private router: Router) {}

  get prefijo(): string {
    return this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
  }

  ngOnChanges(): void {
    if (this.tipo && this.id) this.cargar();
  }

  cargar(): void {
    this.servicio.vinculos(this.tipo, this.id).subscribe({ next: (l) => (this.vinculos = l), error: () => (this.vinculos = []) });
  }

  guardar(): void {
    if (!this.destino) return;
    this.guardando = true;
    this.servicio.crearVinculo({ origenTipo: this.tipo, origenId: this.id, destinoTipo: this.destino.tipo, destinoId: this.destino.id, relacion: this.relacion, nota: this.nota.trim() || undefined }).subscribe({
      next: () => {
        this.guardando = false; this.creando = false; this.nota = ''; this.destino = null; this.error = '';
        this.mensaje = 'Vínculo guardado. También se ve en la ficha del otro cliente.';
        setTimeout(() => (this.mensaje = ''), 5000);
        this.cargar();
      },
      error: (e) => { this.guardando = false; this.error = e?.error?.message || 'No se pudo guardar.'; },
    });
  }

  quitar(v: Vinculo): void {
    if (!confirm(`¿Quitar el vínculo "${v.frase}"?`)) return;
    this.servicio.quitarVinculo(v.id).subscribe({ next: () => this.cargar(), error: (e) => (this.error = e?.error?.message || 'No se pudo quitar.') });
  }
}
