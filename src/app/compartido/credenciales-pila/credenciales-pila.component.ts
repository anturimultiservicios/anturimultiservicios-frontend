import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CredencialesServicio, TitularCredenciales, TIPOS_CREDENCIAL } from '../../nucleo/servicios/credenciales.servicio';
import { CredencialesTitularComponent } from '../credenciales-titular/credenciales-titular.component';

// 2026-10-08 (pedido de Cristopher): usuarios y claves de portales externos
// (operador PILA, EPS, pensión, ARL, caja...) a la mano como la calculadora.
// Se busca la empresa o persona, se toca y aparecen todas sus credenciales,
// con opción de agregar. La clave solo aparece con "Ver clave" (queda
// registrado) y se oculta sola a los 30 segundos.
@Component({
  selector: 'anturi-credenciales-pila',
  standalone: true,
  imports: [CommonModule, FormsModule, CredencialesTitularComponent],
  template: `
    <div class="cred-acceso" *ngIf="!abierta">
      <button class="cred-acceso__btn" (click)="abierta = true" title="Usuarios y claves de portales">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="7.5" cy="15.5" r="4.5"></circle>
          <path d="M10.7 12.3 21 2"></path>
          <path d="m16 7 3 3"></path>
          <path d="m19 4 2 2"></path>
        </svg>
      </button>
    </div>

    <div class="cred-panel" *ngIf="abierta" role="dialog" aria-label="Usuarios y claves de portales">
      <div class="cred-panel__encabezado">
        <button *ngIf="seleccionado" class="cred-volver" (click)="seleccionado = null" aria-label="Volver">‹</button>
        <strong>{{ seleccionado ? seleccionado.nombre : 'Usuarios y claves de portales' }}</strong>
        <button class="cred-cerrar" (click)="cerrar()" aria-label="Cerrar">✕</button>
      </div>

      <div class="cred-panel__cuerpo" *ngIf="!seleccionado">
        <input type="text" class="campo-input" [(ngModel)]="busqueda" (ngModelChange)="buscar()"
               placeholder="Nombre de la empresa, persona, NIT o cédula" autocomplete="off">
        <div class="cred-ayuda" *ngIf="busqueda.trim().length < 2">Escriba al menos 2 letras para buscar.</div>
        <div class="cred-ayuda" *ngIf="buscando">Buscando...</div>
        <div class="cred-ayuda" *ngIf="!buscando && busqueda.trim().length >= 2 && resultados.length === 0">No se encontró nada con esa búsqueda.</div>
        <ul class="cred-lista">
          <li *ngFor="let r of resultados" class="cred-item" (click)="seleccionado = r">
            <div class="cred-item__titulo">
              <span class="cred-tipo">{{ r.tipo === 'EMPRESA' ? 'Empresa' : 'Persona' }}</span>
              <strong>{{ r.nombre }}</strong>
            </div>
            <div class="cred-item__doc">{{ r.documento }} · {{ r.estado }}</div>
            <div class="cred-item__portales">
              <span *ngIf="r.credenciales.length === 0" class="cred-ayuda">Sin claves guardadas · tocar para agregar</span>
              <span *ngFor="let c of r.credenciales" class="cred-portal">{{ nombreTipo(c.tipo) }}: {{ c.entidad }}</span>
            </div>
          </li>
        </ul>
        <p class="cred-nota">Cada consulta de clave queda registrada.</p>
      </div>

      <div class="cred-panel__cuerpo" *ngIf="seleccionado">
        <div class="cred-item__doc">{{ seleccionado.tipo === 'EMPRESA' ? 'Empresa' : 'Persona' }} · {{ seleccionado.documento }} · {{ seleccionado.estado }}</div>
        <anturi-credenciales-titular [titularTipo]="seleccionado.tipo" [titularId]="seleccionado.id"></anturi-credenciales-titular>
        <p class="cred-nota">Cada consulta de clave queda registrada.</p>
      </div>
    </div>
  `,
  styles: [`
    .cred-acceso { position: fixed; right: 20px; bottom: 160px; z-index: var(--z-flotante); }
    .cred-acceso__btn { width: 48px; height: 48px; border-radius: 50%; background: #E8570C; color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--sombra-lg); transition: transform var(--transicion-normal); }
    .cred-acceso__btn:hover { transform: scale(1.08); }
    .cred-acceso__btn svg { width: 22px; height: 22px; }
    .cred-panel { position: fixed; right: 20px; bottom: 20px; z-index: var(--z-modal, 1100); width: min(420px, calc(100vw - 32px)); max-height: min(660px, calc(100vh - 40px)); display: flex; flex-direction: column; background: var(--fondo-tarjeta, #fff); border: 1px solid var(--borde-color, #e5e7eb); border-radius: var(--radio-xl, 16px); box-shadow: 0 16px 40px rgba(0,0,0,0.2); overflow: hidden; }
    .cred-panel__encabezado { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: var(--color-primario, #1B3270); color: #fff; }
    .cred-panel__encabezado strong { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cred-cerrar, .cred-volver { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; line-height: 1; }
    .cred-panel__cuerpo { padding: 12px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
    .cred-ayuda { font-size: var(--tamano-xs, 12px); color: var(--texto-terciario, #6b7280); }
    .cred-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .cred-item { border: 1px solid var(--borde-color, #e5e7eb); border-radius: var(--radio-md, 8px); padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; cursor: pointer; }
    .cred-item:hover { border-color: var(--color-primario, #1B3270); background: rgba(27,50,112,0.03); }
    .cred-item__titulo { display: flex; align-items: center; gap: 6px; font-size: var(--tamano-sm, 14px); color: var(--texto-principal, #111827); }
    .cred-tipo { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 999px; background: rgba(27,50,112,0.1); color: var(--color-primario, #1B3270); }
    .cred-item__doc { font-size: var(--tamano-xs, 12px); color: var(--texto-terciario, #6b7280); }
    .cred-item__portales { display: flex; flex-wrap: wrap; gap: 4px; }
    .cred-portal { font-size: 11px; padding: 1px 6px; border-radius: 4px; background: rgba(232,87,12,0.1); color: #c2410c; }
    .cred-nota { margin: 4px 0 0; font-size: 11px; color: var(--texto-terciario, #9ca3af); text-align: center; }
  `],
})
export class CredencialesPilaComponent {
  abierta = false;
  busqueda = '';
  buscando = false;
  resultados: TitularCredenciales[] = [];
  seleccionado: TitularCredenciales | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor(private servicio: CredencialesServicio) {}

  nombreTipo(t: string): string {
    return TIPOS_CREDENCIAL.find((x) => x.valor === t)?.nombre ?? t;
  }

  cerrar(): void {
    this.abierta = false;
    this.seleccionado = null;
  }

  buscar(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    const q = this.busqueda.trim();
    if (q.length < 2) { this.resultados = []; return; }
    this.temporizador = setTimeout(() => {
      this.buscando = true;
      this.servicio.buscar(q).subscribe({
        next: (l) => { this.resultados = l; this.buscando = false; },
        error: () => { this.resultados = []; this.buscando = false; },
      });
    }, 350);
  }
}
