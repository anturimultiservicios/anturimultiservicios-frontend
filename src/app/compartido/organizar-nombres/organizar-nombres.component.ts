import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClienteRef, ClientesServicio, DestinoNota, NombreConNota, RELACIONES } from '../../nucleo/servicios/clientes.servicio';
import { BuscarClienteComponent } from '../buscar-cliente/buscar-cliente.component';

// 2026-10-22 (Cristopher/Anyi): del Excel vinieron ~127 nombres con notas
// entre paréntesis ("TATIANA (Esposa Ing Jaime)", "(Rep. Luz María CC …)",
// "(Contador Jeisson)", "(Debe 60.500)", "(Banano)"). El sistema propone a
// dónde va cada nota y la Asistente confirma o corrige con un clic.
interface Edicion {
  nombre: string; nombres: string; apellidos: string;
  destino: DestinoNota; texto: string; documento: string; telefono: string;
  relacion: string; con: ClienteRef | null; extra: string;
}

@Component({
  selector: 'anturi-organizar-nombres',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BuscarClienteComponent],
  template: `
    <div class="on">
      <div>
        <h2 class="on__titulo">Organizar nombres</h2>
        <p class="sub">Del Excel vinieron nombres con notas entre paréntesis. Aquí cada nota se pasa a su lugar: familia con otro cliente, representante legal, contacto, "conocido como" u observaciones. El sistema propone; usted confirma o corrige.</p>
      </div>
      <div class="on__filtros">
        <input class="campo-input on__buscar" [(ngModel)]="buscar" placeholder="Buscar nombre o nota…" aria-label="Buscar">
        <select class="campo-input on__sel" [(ngModel)]="filtro" aria-label="Filtrar por propuesta">
          <option value="">Todas ({{ items.length }})</option>
          <option *ngFor="let d of destinos" [value]="d.valor">{{ d.nombre }} ({{ cuenta(d.valor) }})</option>
        </select>
      </div>
      <p *ngIf="cargando" class="sub">Cargando…</p>
      <p *ngIf="!cargando && !items.length" class="on__ok">✓ No quedan nombres con notas por organizar.</p>

      <div *ngFor="let it of visibles" class="tarjeta on__item">
        <div class="on__cab">
          <a [routerLink]="[prefijo, it.tipo === 'EMPRESA' ? 'empresas' : 'afiliados', it.id]" class="on__actual">{{ it.nombreActual }}</a>
          <span class="sub">{{ it.tipo === 'EMPRESA' ? 'Cuenta empleador' : 'Afiliado' }} · {{ it.documento }} · {{ it.estado }}</span>
        </div>
        <div class="on__nota">Nota: <b>"{{ it.nota }}"</b><span *ngIf="it.resto"> · después decía: <b>"{{ it.resto }}"</b> (pasa a observaciones)</span></div>

        <div class="on__grid">
          <ng-container *ngIf="it.tipo === 'EMPRESA'; else nombresAfiliado">
            <label class="on__campo">Nombre limpio<input class="campo-input" [(ngModel)]="ed(it).nombre"></label>
          </ng-container>
          <ng-template #nombresAfiliado>
            <label class="on__campo">Nombres<input class="campo-input" [(ngModel)]="ed(it).nombres"></label>
            <label class="on__campo">Apellidos<input class="campo-input" [(ngModel)]="ed(it).apellidos"></label>
          </ng-template>
          <label class="on__campo">La nota es…
            <select class="campo-input" [(ngModel)]="ed(it).destino">
              <option value="VINCULO">Familia o relación con otro cliente</option>
              <option *ngIf="it.tipo === 'EMPRESA'" value="REPRESENTANTE">Representante legal</option>
              <option value="CONTACTO">Contacto (contador, secretaria…)</option>
              <option value="CONOCIDO_COMO">Conocido como / negocio</option>
              <option value="OBSERVACIONES">Observación</option>
              <option value="DEJAR">Dejar el nombre como está</option>
            </select>
          </label>
        </div>

        <div class="on__grid" *ngIf="ed(it).destino !== 'DEJAR'">
          <ng-container [ngSwitch]="ed(it).destino">
            <ng-container *ngSwitchCase="'VINCULO'">
              <label class="on__campo">Este cliente es…
                <select class="campo-input" [(ngModel)]="ed(it).relacion">
                  <option *ngFor="let r of relaciones" [value]="r.valor">{{ r.nombre }}</option>
                </select>
              </label>
              <div class="on__campo on__ancho">…de quién
                <div *ngIf="it.candidatos.length" class="on__cands">
                  <button *ngFor="let c of it.candidatos" type="button" class="on__cand" [class.on__cand--sel]="ed(it).con?.tipo === c.tipo && ed(it).con?.id === c.id" (click)="ed(it).con = c">
                    {{ c.nombre }} <small>{{ c.tipo === 'EMPRESA' ? 'empleador' : 'afiliado' }} · {{ c.estado }}</small>
                  </button>
                </div>
                <anturi-buscar-cliente [excluir]="{ tipo: it.tipo, id: it.id }" [inicial]="it.propuesta.nombre" placeholder="Buscar otro cliente…" (elegido)="$event && (ed(it).con = $event)"></anturi-buscar-cliente>
                <small *ngIf="ed(it).con" class="on__elegido">Elegido: {{ ed(it).con?.nombre }}</small>
              </div>
            </ng-container>
            <ng-container *ngSwitchCase="'REPRESENTANTE'">
              <label class="on__campo">Representante legal<input class="campo-input" [(ngModel)]="ed(it).texto"></label>
              <label class="on__campo">Documento<input class="campo-input" [(ngModel)]="ed(it).documento" inputmode="numeric"></label>
            </ng-container>
            <ng-container *ngSwitchCase="'CONTACTO'">
              <label class="on__campo">Contacto<input class="campo-input" [(ngModel)]="ed(it).texto"></label>
              <label class="on__campo">Celular<input class="campo-input" [(ngModel)]="ed(it).telefono" inputmode="tel"></label>
            </ng-container>
            <ng-container *ngSwitchCase="'CONOCIDO_COMO'">
              <label class="on__campo on__ancho">Conocido como<input class="campo-input" [(ngModel)]="ed(it).texto"></label>
            </ng-container>
            <ng-container *ngSwitchCase="'OBSERVACIONES'">
              <label class="on__campo on__ancho">Observación<input class="campo-input" [(ngModel)]="ed(it).texto"></label>
            </ng-container>
          </ng-container>
        </div>

        <div class="on__pie">
          <span *ngIf="errores[clave(it)]" class="on__error" role="alert">{{ errores[clave(it)] }}</span>
          <button type="button" class="boton boton-primario boton-sm" [disabled]="guardando === clave(it) || !valido(it)" (click)="guardar(it)">{{ guardando === clave(it) ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </div>
      <p *ngIf="filtrados.length > visibles.length" class="sub">Mostrando {{ visibles.length }} de {{ filtrados.length }}. Al guardar, van saliendo de la lista.</p>
    </div>
  `,
  styles: [`
    .on { display: flex; flex-direction: column; gap: 12px; }
    .on__titulo { margin: 0; font-size: 22px; color: var(--texto-principal); }
    .sub { color: var(--texto-terciario); font-size: var(--tamano-sm); margin: 2px 0 0; }
    .on__ok { color: #1f7a3d; font-weight: 700; }
    .on__filtros { display: flex; gap: 8px; flex-wrap: wrap; }
    .on__buscar { max-width: 360px; }
    .on__sel { max-width: 280px; }
    .on__item { display: flex; flex-direction: column; gap: 10px; padding: 14px; }
    .on__cab { display: flex; flex-direction: column; gap: 2px; }
    .on__actual { font-weight: 700; color: var(--color-primario, #1B3270); }
    .on__nota { font-size: var(--tamano-sm); color: #7a4b00; background: #fff7e6; padding: 6px 10px; border-radius: 8px; }
    .on__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .on__campo { display: flex; flex-direction: column; gap: 4px; font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .on__ancho { grid-column: 1 / -1; }
    .on__cands { display: flex; flex-wrap: wrap; gap: 6px; }
    .on__cand { border: 1px solid var(--borde-color, #d1d5db); background: transparent; border-radius: 999px; padding: 4px 10px; cursor: pointer; color: var(--texto-principal); font-size: 13px; }
    .on__cand small { color: var(--texto-terciario); }
    .on__cand--sel { border-color: var(--color-secundario, #E8570C); background: rgba(232, 87, 12, 0.1); font-weight: 700; }
    .on__elegido { color: #1f7a3d; font-weight: 600; }
    .on__pie { display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
    .on__error { color: #b42318; font-size: var(--tamano-sm); }
  `],
})
export class OrganizarNombresComponent implements OnInit {
  readonly relaciones = RELACIONES;
  readonly destinos = [
    { valor: 'VINCULO', nombre: 'Familia con otro cliente' },
    { valor: 'REPRESENTANTE', nombre: 'Representante legal' },
    { valor: 'CONTACTO', nombre: 'Contacto' },
    { valor: 'CONOCIDO_COMO', nombre: 'Conocido como' },
    { valor: 'OBSERVACIONES', nombre: 'Observación' },
  ];
  items: NombreConNota[] = [];
  cargando = false;
  buscar = '';
  filtro = '';
  guardando: string | null = null;
  errores: Record<string, string> = {};
  private ediciones = new Map<string, Edicion>();

  constructor(private servicio: ClientesServicio, private router: Router) {}

  get prefijo(): string {
    return this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
  }

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando = true;
    this.servicio.nombresConNotas().subscribe({
      next: (l) => { this.items = l; this.cargando = false; },
      error: () => (this.cargando = false),
    });
  }

  clave(it: NombreConNota): string { return `${it.tipo}:${it.id}`; }

  cuenta(d: string): number { return this.items.filter((i) => i.propuesta.destino === d).length; }

  get filtrados(): NombreConNota[] {
    const b = this.buscar.trim().toUpperCase();
    return this.items.filter((i) => (!this.filtro || i.propuesta.destino === this.filtro) && (!b || `${i.nombreActual} ${i.nota}`.toUpperCase().includes(b)));
  }

  get visibles(): NombreConNota[] { return this.filtrados.slice(0, 40); }

  ed(it: NombreConNota): Edicion {
    const k = this.clave(it);
    let e = this.ediciones.get(k);
    if (!e) {
      const p = it.propuesta;
      e = {
        nombre: it.nombreLimpio, nombres: it.nombresLimpios ?? '', apellidos: it.apellidosLimpios ?? '',
        destino: p.destino, texto: p.destino === 'OBSERVACIONES' ? it.nota : (p.nombre ?? it.nota),
        documento: p.documento ?? '', telefono: p.telefono ?? '',
        relacion: p.relacion ?? 'CONYUGE', con: it.candidatos.length === 1 ? it.candidatos[0] : null, extra: it.resto,
      };
      this.ediciones.set(k, e);
    }
    return e;
  }

  valido(it: NombreConNota): boolean {
    const e = this.ed(it);
    if (e.destino === 'DEJAR') return true;
    if (it.tipo === 'EMPRESA' ? e.nombre.trim().length < 2 : e.nombres.trim().length < 2) return false;
    if (e.destino === 'VINCULO') return !!e.con;
    return true;
  }

  guardar(it: NombreConNota): void {
    const e = this.ed(it);
    const k = this.clave(it);
    const datos: Record<string, unknown> = { destino: e.destino };
    if (e.destino !== 'DEJAR') {
      if (it.tipo === 'EMPRESA') datos['nombreLimpio'] = e.nombre.trim();
      else { datos['nombres'] = e.nombres.trim(); datos['apellidos'] = e.apellidos.trim(); }
      datos['texto'] = e.texto.trim();
      if (e.documento.trim()) datos['documento'] = e.documento.trim();
      if (e.telefono.trim()) datos['telefono'] = e.telefono.trim();
      if (e.extra.trim()) datos['extraObservaciones'] = e.extra.trim();
      if (e.destino === 'VINCULO' && e.con) datos['vinculo'] = { relacion: e.relacion, destinoTipo: e.con.tipo, destinoId: e.con.id };
    }
    this.guardando = k;
    delete this.errores[k];
    this.servicio.organizarNombre(it.tipo, it.id, datos).subscribe({
      next: () => { this.guardando = null; this.items = this.items.filter((x) => this.clave(x) !== k); },
      error: (err) => { this.guardando = null; this.errores[k] = err?.error?.message || 'No se pudo guardar.'; },
    });
  }
}
