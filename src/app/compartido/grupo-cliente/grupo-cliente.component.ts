import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ClientesServicio, CuentaGrupo, GrupoPago, NodoGrupo, TipoCliente } from '../../nucleo/servicios/clientes.servicio';

// 2026-10-30 (Cristopher/Anyi): el GRUPO de quien paga por varios. Ej. doña
// Leonor Arcila paga a sus trabajadores y sus hijos tienen los suyos, todo
// bajo ella: se busque a quien se busque, sale el que paga arriba y debajo,
// corridos, los que hacen parte. Igual para personas y empresas, todos los roles.
// En Registrar pago (modo "elegir") cada cuenta trae un botón para cobrarla.
@Component({
  selector: 'anturi-grupo-cliente',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <ng-container *ngIf="grupo?.raiz as raiz">
      <div *ngIf="siempre || tieneGrupo" class="gr" [class.tarjeta]="tarjeta" [class.seccion-datos]="tarjeta">
        <div class="gr__cab">
          <h3 class="seccion-titulo">Grupo de {{ raiz.nombre }} <small>({{ grupo!.total }} persona{{ grupo!.total !== 1 ? 's' : '' }})</small></h3>
          <span class="gr__ayuda">Quién paga y a quiénes les paga</span>
        </div>
        <ng-container *ngTemplateOutlet="nodoTpl; context: { $implicit: raiz, nivel: 0 }"></ng-container>
      </div>
      <p *ngIf="siempre && !tieneGrupo" class="gr__vacio">No hace parte de ningún grupo: nadie le paga y no le paga a nadie.</p>
    </ng-container>
    <p *ngIf="cargando && siempre" class="gr__vacio">Buscando el grupo…</p>

    <ng-template #nodoTpl let-n let-nivel="nivel">
      <div class="gr__nodo" [style.margin-left.px]="nivel * 22" [class.gr__nodo--yo]="n.esConsultado">
        <span class="gr__linea" *ngIf="nivel > 0" aria-hidden="true">└</span>
        <div class="gr__cuerpo">
          <div>
            <ng-container *ngIf="enlace(n) as ruta; else sinEnlace"><a [routerLink]="ruta" class="gr__nombre">{{ n.nombre }}</a></ng-container>
            <ng-template #sinEnlace><strong class="gr__nombre">{{ n.nombre }}</strong></ng-template>
            <small> · CC {{ n.documento }}{{ n.cargo ? ' · ' + n.cargo : '' }}{{ n.esConsultado ? ' · el que está viendo' : '' }}</small>
            <span *ngIf="nivel === 0 && n.miembros.length" class="gr__chip">Paga por {{ grupo!.total - 1 }}</span>
            <span *ngIf="n.afiliado" class="gr__chip gr__chip--suave">Afiliado {{ n.afiliado.estado === 'ACTIVO' ? '' : '(' + n.afiliado.estado.toLowerCase() + ')' }}</span>
          </div>
          <div *ngFor="let c of n.cuentas" class="gr__cuenta" [class.gr__cuenta--inactiva]="!c.activa">
            <a [routerLink]="[prefijo, 'empresas', c.id]">Cuenta: {{ c.razonSocial }}</a>
            <small>{{ c.descripcion ? ' · ' + c.descripcion : '' }}{{ c.activa ? '' : ' · inactiva' }}</small>
            <button *ngIf="modoElegir && c.activa" type="button" class="boton boton-texto boton-sm" (click)="elegir.emit({ cuenta: c, nodo: n })">Cobrar esta cuenta</button>
          </div>
          <button *ngIf="modoElegir && n.afiliado && !n.cuentas.length" type="button" class="boton boton-texto boton-sm" (click)="elegir.emit({ nodo: n })">Cobrar a {{ n.nombre }}</button>
        </div>
      </div>
      <ng-container *ngFor="let m of n.miembros">
        <ng-container *ngTemplateOutlet="nodoTpl; context: { $implicit: m, nivel: nivel + 1 }"></ng-container>
      </ng-container>
    </ng-template>
  `,
  styles: [`
    .gr { display: flex; flex-direction: column; gap: 4px; }
    .gr__cab { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
    .gr__cab small { font-weight: 400; color: var(--texto-terciario); }
    .gr__ayuda, .gr__vacio { color: var(--texto-terciario); font-size: var(--tamano-sm); margin: 0; }
    .gr__nodo { display: flex; gap: 6px; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--borde-color, #e5e7eb); }
    .gr__nodo--yo { border-color: var(--color-secundario, #E8570C); background: rgba(232, 87, 12, 0.06); }
    .gr__linea { color: var(--texto-terciario); }
    .gr__cuerpo { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .gr__nombre { font-weight: 700; color: var(--color-primario, #1B3270); }
    .gr__cuerpo small { color: var(--texto-terciario); }
    .gr__cuenta { font-size: var(--tamano-sm); display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
    .gr__cuenta--inactiva a { color: var(--texto-terciario); text-decoration: line-through; }
    .gr__chip { margin-left: 6px; font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; background: rgba(27, 50, 112, 0.1); color: var(--color-primario, #1B3270); }
    .gr__chip--suave { background: rgba(31, 122, 61, 0.1); color: #1f7a3d; }
  `],
})
export class GrupoClienteComponent implements OnChanges {
  @Input() tipo!: TipoCliente;
  @Input() id!: number;
  // true: muestra el resultado aunque no haya grupo (cuando alguien lo pidió)
  @Input() siempre = false;
  // Registrar pago: botón "Cobrar esta cuenta" en vez de solo enlaces
  @Input() modoElegir = false;
  // en las fichas: se dibuja como tarjeta (y no aparece si no hay grupo)
  @Input() tarjeta = false;
  @Output() elegir = new EventEmitter<{ cuenta?: CuentaGrupo; nodo: NodoGrupo }>();

  grupo: GrupoPago | null = null;
  cargando = false;

  constructor(private clientes: ClientesServicio, private router: Router) {}

  get prefijo(): string {
    return this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
  }

  // hay grupo si alguien le paga o le paga a alguien, o tiene varias cuentas
  get tieneGrupo(): boolean {
    const r = this.grupo?.raiz;
    return !!r && (r.miembros.length > 0 || r.cuentas.length > 1);
  }

  ngOnChanges(): void {
    if (!this.tipo || !this.id) return;
    this.cargando = true;
    this.clientes.grupo(this.tipo, this.id).subscribe({
      next: (g) => { this.grupo = g; this.cargando = false; },
      error: () => { this.grupo = null; this.cargando = false; },
    });
  }

  enlace(n: NodoGrupo): unknown[] | null {
    if (n.afiliado) return [this.prefijo, 'afiliados', n.afiliado.id];
    if (n.personaId) return [this.prefijo, 'trabajadores', n.personaId];
    return null;
  }
}
