import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { entorno } from '../../../environments/entorno';

// 2026-10-16 (pedido de Cristopher): en el Excel las fincas / obras de los
// empleadores venían en "Clase aportante". Se pasaron a "Lugares de trabajo"
// y aquí Anyi las organiza: cada finca se puede dejar como lugar de trabajo,
// volver una SEDE de la empresa (para repartir el personal), pasar a la
// dirección, a la clase de aportante o a observaciones, o quitar.
interface EmpresaFincas {
  id: number;
  razonSocial: string;
  nit: string;
  activa: boolean;
  claseAportante: string | null;
  lugarTrabajo: string | null;
  direccion: string | null;
  municipio: string | null;
  observaciones: string | null;
  fincasRevisadasEn: string | null;
  sucursales: { id: number; nombre: string; direccion: string | null; activa: boolean }[];
  personalActivo: number;
  partes: string[];
  opcionesExcel: string[];
  porDecidir: boolean;
}

type Destino = 'lugar' | 'sede' | 'direccion' | 'clase' | 'observaciones' | 'quitar';

interface Edicion {
  partes: { texto: string; destino: Destino }[];
  clase: string;
  nuevaParte: string;
}

@Component({
  selector: 'anturi-organizar-fincas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="of">
      <div class="of__cab">
        <div>
          <h2 class="of__titulo">Organizar fincas de los empleadores</h2>
          <p class="sub">En el Excel las fincas venían en "Clase aportante". Aquí puede dejar cada finca donde corresponda. Lo que cambie le llega a Anturi.</p>
        </div>
        <div class="of__filtros" role="group" aria-label="Filtro">
          <button type="button" class="boton boton-sm" [class.boton-primario]="filtro === 'pendientes'" [class.of__tab]="filtro !== 'pendientes'" (click)="filtro = 'pendientes'">Por revisar ({{ cuenta('pendientes') }})</button>
          <button type="button" class="boton boton-sm" [class.boton-primario]="filtro === 'decidir'" [class.of__tab]="filtro !== 'decidir'" (click)="filtro = 'decidir'">Falta escoger la finca ({{ cuenta('decidir') }})</button>
          <button type="button" class="boton boton-sm" [class.boton-primario]="filtro === 'revisadas'" [class.of__tab]="filtro !== 'revisadas'" (click)="filtro = 'revisadas'">Revisadas ({{ cuenta('revisadas') }})</button>
        </div>
      </div>
      <input class="campo-input of__buscar" [(ngModel)]="buscar" placeholder="Buscar empresa, NIT o finca…" aria-label="Buscar">
      <p *ngIf="cargando" class="sub">Cargando…</p>
      <p *ngIf="error" class="aviso-error" role="alert">{{ error }}</p>
      <p *ngIf="!cargando && !visibles.length" class="sub">No hay empresas en esta lista.</p>

      <div *ngFor="let e of visibles" class="tarjeta of__empresa" [class.of__empresa--inactiva]="!e.activa">
        <div class="of__empresa-cab">
          <div>
            <a [routerLink]="[prefijo, 'empresas', e.id]" class="of__nombre">{{ e.razonSocial }}</a>
            <span class="sub"> · NIT {{ e.nit }} · {{ e.activa ? 'Activa' : 'Inactiva' }} · {{ e.personalActivo }} trabajador(es) · {{ e.sucursales.length }} sede(s)</span>
          </div>
          <span *ngIf="e.fincasRevisadasEn" class="of__ok">✓ Revisada</span>
        </div>

        <div *ngIf="e.porDecidir" class="of__decidir">
          <strong>Solo dice "{{ e.claseAportante }}".</strong> En el Excel tiene estas fincas, escoja la(s) que son de esta cuenta:
          <label *ngFor="let o of e.opcionesExcel" class="of__opcion"><input type="checkbox" [checked]="tiene(e, o)" (change)="alternarExcel(e, o, $event)"> {{ o }}</label>
          <span *ngIf="!e.opcionesExcel.length" class="sub">(el Excel no trae más datos de esta finca; escríbala abajo)</span>
        </div>

        <div class="of__partes">
          <div *ngFor="let p of ed(e).partes; let i = index" class="of__parte">
            <span class="of__texto">{{ p.texto }}</span>
            <select class="campo-input campo-input--sm" [(ngModel)]="p.destino" [attr.aria-label]="'Dónde va: ' + p.texto">
              <option value="lugar">Lugar de trabajo</option>
              <option value="sede">Volverla sede (para el personal)</option>
              <option value="direccion">Es la dirección</option>
              <option value="clase">Es la clase de aportante</option>
              <option value="observaciones">Pasar a observaciones</option>
              <option value="quitar">Quitar</option>
            </select>
          </div>
          <div class="of__agregar">
            <input class="campo-input campo-input--sm" [(ngModel)]="ed(e).nuevaParte" placeholder="Agregar otra finca u obra…" (keyup.enter)="agregarParte(e)" aria-label="Agregar finca">
            <button type="button" class="boton boton-secundario boton-sm" (click)="agregarParte(e)" [disabled]="!ed(e).nuevaParte.trim()">Agregar</button>
          </div>
        </div>

        <div class="of__pie">
          <label class="of__clase">Clase de aportante
            <input class="campo-input campo-input--sm" [(ngModel)]="ed(e).clase" list="of-clases" autocomplete="off">
          </label>
          <datalist id="of-clases"><option *ngFor="let c of clases" [value]="c"></option></datalist>
          <span *ngIf="e.sucursales.length" class="sub">Sedes: {{ nombresSedes(e) }}</span>
          <div class="of__acciones">
            <a [routerLink]="[prefijo, 'empresas', e.id]" class="boton boton-texto boton-sm">Ver empresa y personal</a>
            <button type="button" class="boton boton-primario boton-sm" [disabled]="guardando === e.id" (click)="guardar(e)">{{ guardando === e.id ? 'Guardando…' : (e.fincasRevisadasEn ? 'Guardar' : 'Guardar y marcar revisada') }}</button>
          </div>
        </div>
        <p *ngIf="mensajes[e.id]" class="aviso-ok" role="status">{{ mensajes[e.id] }}</p>
      </div>
    </div>
  `,
  styles: [`
    .of { display: flex; flex-direction: column; gap: 12px; }
    .of__cab { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
    .of__titulo { margin: 0; font-size: 22px; color: var(--texto-principal); }
    .sub { color: var(--texto-terciario); font-size: var(--tamano-sm); margin: 2px 0 0; }
    .of__filtros { display: flex; gap: 6px; flex-wrap: wrap; }
    .of__tab { background: transparent; color: var(--texto-secundario, #4b5563); border: 1px solid var(--borde-color, #d1d5db); }
    .of__tab:hover { color: var(--color-primario, #1B3270); border-color: var(--color-primario, #1B3270); }
    .of__buscar { max-width: 420px; }
    .of__empresa { display: flex; flex-direction: column; gap: 10px; padding: 14px; }
    .of__empresa--inactiva { opacity: 0.85; }
    .of__empresa-cab { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .of__nombre { font-weight: 700; color: var(--color-primario, #1B3270); }
    .of__ok { color: #1f7a3d; font-weight: 700; font-size: var(--tamano-sm); }
    .of__decidir { display: flex; flex-direction: column; gap: 4px; padding: 10px; border-radius: 10px; background: #fff7e6; color: #7a4b00; font-size: var(--tamano-sm); }
    .of__opcion { display: flex; gap: 6px; align-items: flex-start; cursor: pointer; color: var(--texto-principal); }
    .of__partes { display: flex; flex-direction: column; gap: 6px; }
    .of__parte { display: grid; grid-template-columns: 1fr minmax(200px, 260px); gap: 8px; align-items: center; }
    .of__texto { font-size: var(--tamano-sm); color: var(--texto-principal); }
    .of__agregar { display: flex; gap: 6px; }
    .of__agregar .campo-input { flex: 1; }
    .of__pie { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: space-between; }
    .of__clase { display: flex; gap: 6px; align-items: center; font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .of__acciones { display: flex; gap: 6px; margin-left: auto; }
    .aviso-ok { color: #1f7a3d; font-size: var(--tamano-sm); margin: 0; }
    .aviso-error { color: #b42318; font-size: var(--tamano-sm); }
    @media (max-width: 640px) { .of__parte { grid-template-columns: 1fr; } }
  `],
})
export class OrganizarFincasComponent implements OnInit {
  readonly clases = ['Empleador', 'Doméstica', 'Servicio doméstico', 'Obra', 'Construcción', 'Finca', 'Trabajadores', 'Independiente', 'Cooperativa'];
  empresas: EmpresaFincas[] = [];
  filtro: 'pendientes' | 'decidir' | 'revisadas' = 'pendientes';
  buscar = '';
  cargando = false;
  guardando: number | null = null;
  error = '';
  mensajes: Record<number, string> = {};
  private ediciones = new Map<number, Edicion>();
  private readonly URL = `${entorno.urlApi}/fincas`;

  constructor(private http: HttpClient, private router: Router) {}

  get prefijo(): string {
    return this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
  }

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando = true;
    this.http.get<EmpresaFincas[]>(this.URL).subscribe({
      next: (l) => { this.empresas = l; this.ediciones.clear(); this.cargando = false; },
      error: () => { this.cargando = false; this.error = 'No se pudo cargar la lista.'; },
    });
  }

  private enFiltro(e: EmpresaFincas, f: string): boolean {
    if (f === 'decidir') return e.porDecidir && !e.fincasRevisadasEn;
    if (f === 'revisadas') return !!e.fincasRevisadasEn;
    return !e.fincasRevisadasEn && !e.porDecidir;
  }

  cuenta(f: string): number {
    return this.empresas.filter((e) => this.enFiltro(e, f)).length;
  }

  get visibles(): EmpresaFincas[] {
    const b = this.buscar.trim().toUpperCase();
    return this.empresas
      .filter((e) => this.enFiltro(e, this.filtro))
      .filter((e) => !b || `${e.razonSocial} ${e.nit} ${e.lugarTrabajo ?? ''}`.toUpperCase().includes(b))
      .slice(0, 80);
  }

  ed(e: EmpresaFincas): Edicion {
    let x = this.ediciones.get(e.id);
    if (!x) {
      const sedes = new Set(e.sucursales.map((s) => s.nombre.trim().toUpperCase()));
      x = {
        partes: e.partes.map((t) => ({ texto: t, destino: (sedes.has(t.toUpperCase()) ? 'sede' : 'lugar') as Destino })),
        clase: e.porDecidir ? 'Empleador' : e.claseAportante ?? '',
        nuevaParte: '',
      };
      this.ediciones.set(e.id, x);
    }
    return x;
  }

  tiene(e: EmpresaFincas, texto: string): boolean {
    return this.ed(e).partes.some((p) => p.texto === texto);
  }

  alternarExcel(e: EmpresaFincas, texto: string, ev: Event): void {
    const x = this.ed(e);
    if ((ev.target as HTMLInputElement).checked) { if (!this.tiene(e, texto)) x.partes.push({ texto, destino: 'lugar' }); }
    else x.partes = x.partes.filter((p) => p.texto !== texto);
  }

  agregarParte(e: EmpresaFincas): void {
    const x = this.ed(e);
    const t = x.nuevaParte.trim();
    if (!t) return;
    if (!x.partes.some((p) => p.texto.toUpperCase() === t.toUpperCase())) x.partes.push({ texto: t, destino: 'lugar' });
    x.nuevaParte = '';
  }

  nombresSedes(e: EmpresaFincas): string {
    return e.sucursales.map((s) => s.nombre).join(', ');
  }

  guardar(e: EmpresaFincas): void {
    const x = this.ed(e);
    const de = (d: Destino) => x.partes.filter((p) => p.destino === d).map((p) => p.texto);
    const lugares = [...de('lugar'), ...de('sede')];
    const claseDesdeTexto = de('clase')[0];
    const direccion = de('direccion')[0];
    const aObs = de('observaciones');
    const body: Record<string, unknown> = {
      lugarTrabajo: lugares.join(' - '),
      claseAportante: (claseDesdeTexto ?? x.clase).trim(),
      sedes: de('sede'),
      revisada: true,
    };
    if (direccion) body['direccion'] = direccion;
    if (aObs.length) body['observaciones'] = [e.observaciones, 'Fincas: ' + aObs.join(' - ')].filter(Boolean).join('\n');
    this.guardando = e.id;
    this.http.patch<{ cambios: number; sedesCreadas: number }>(`${this.URL}/${e.id}`, body).subscribe({
      next: (r) => {
        this.guardando = null;
        this.mensajes[e.id] = `Guardado${r.sedesCreadas ? `, ${r.sedesCreadas} sede(s) nueva(s) — ya puede asignarles el personal desde la empresa` : ''}.`;
        setTimeout(() => delete this.mensajes[e.id], 6000);
        this.cargar();
      },
      error: (err) => { this.guardando = null; this.error = err?.error?.message || 'No se pudo guardar.'; },
    });
  }
}
