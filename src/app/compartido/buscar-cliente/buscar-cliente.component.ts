import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { AfiliadosServicio } from '../../nucleo/servicios/afiliados.servicio';
import { EmpresasServicio } from '../../nucleo/servicios/empresas.servicio';
import { ClienteRef } from '../../nucleo/servicios/clientes.servicio';

// 2026-10-22: buscar cualquier cliente (afiliado o empresa) por nombre o documento
@Component({
  selector: 'anturi-buscar-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <input class="campo-input" [(ngModel)]="texto" (ngModelChange)="buscar()" [placeholder]="placeholder" [attr.aria-label]="placeholder">
    <div *ngIf="buscando" class="bc-sub">Buscando…</div>
    <ul *ngIf="resultados.length" class="bc-lista">
      <li *ngFor="let r of resultados" [class.bc-sel]="seleccion?.tipo === r.tipo && seleccion?.id === r.id" (click)="elegir(r)">
        <strong>{{ r.nombre }}</strong>
        <span>{{ r.tipo === 'EMPRESA' ? 'Cuenta empleador' : 'Afiliado' }} · {{ r.documento }} · {{ r.estado }}</span>
      </li>
    </ul>
    <div *ngIf="!buscando && texto.trim().length >= 3 && !resultados.length" class="bc-sub">No se encontró.</div>
  `,
  styles: [`
    .bc-sub { color: var(--texto-terciario); font-size: var(--tamano-sm); margin-top: 4px; }
    .bc-lista { list-style: none; margin: 6px 0 0; padding: 0; max-height: 220px; overflow-y: auto; border: 1px solid var(--borde-color, #e5e7eb); border-radius: 8px; }
    .bc-lista li { display: flex; flex-direction: column; padding: 8px 10px; cursor: pointer; border-bottom: 1px solid var(--borde-color, #f0f0f0); }
    .bc-lista li:hover, .bc-lista li.bc-sel { background: rgba(232, 87, 12, 0.08); }
    .bc-lista span { font-size: 12px; color: var(--texto-terciario); }
  `],
})
export class BuscarClienteComponent {
  @Input() placeholder = 'Buscar cliente por nombre o documento';
  @Input() excluir: { tipo: string; id: number } | null = null;
  @Output() elegido = new EventEmitter<ClienteRef | null>();
  texto = '';
  buscando = false;
  resultados: ClienteRef[] = [];
  seleccion: ClienteRef | null = null;
  private temporizador?: ReturnType<typeof setTimeout>;

  constructor(private afiliados: AfiliadosServicio, private empresas: EmpresasServicio) {}

  @Input() set inicial(v: string | null | undefined) {
    if (v && !this.texto) { this.texto = v; this.buscar(); }
  }

  buscar(): void {
    clearTimeout(this.temporizador);
    this.seleccion = null;
    this.elegido.emit(null);
    const t = this.texto.trim();
    if (t.length < 3) { this.resultados = []; return; }
    this.temporizador = setTimeout(() => {
      this.buscando = true;
      forkJoin([
        this.afiliados.listar(t, undefined, undefined, 1, 8).pipe(catchError(() => of({ datos: [] } as any))),
        this.empresas.listar(t, false).pipe(catchError(() => of([] as any[]))),
      ]).subscribe(([a, e]: [any, any[]]) => {
        this.buscando = false;
        const lista: ClienteRef[] = [
          ...(a.datos ?? []).map((x: any) => ({ tipo: 'AFILIADO' as const, id: x.id, nombre: `${x.nombres} ${x.apellidos}`.trim(), estado: x.estado, documento: x.cedula })),
          ...(e ?? []).slice(0, 8).map((x: any) => ({ tipo: 'EMPRESA' as const, id: x.id, nombre: x.razonSocial, estado: x.activa === false ? 'INACTIVA' : 'ACTIVA', documento: x.nit })),
        ];
        this.resultados = lista.filter((r) => !(this.excluir && r.tipo === this.excluir.tipo && r.id === this.excluir.id));
      });
    }, 350);
  }

  elegir(r: ClienteRef): void {
    this.seleccion = r;
    this.elegido.emit(r);
  }
}
