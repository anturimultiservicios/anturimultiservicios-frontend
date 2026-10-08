import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { entorno } from '../../../environments/entorno';

interface Resultado {
  tipo: 'EMPRESA' | 'AFILIADO';
  id: number;
  nombre: string;
  documento: string;
  usuario: string | null;
  tieneClave: boolean;
  estado: string;
}

// 2026-10-08 (pedido de Cristopher): usuario y clave de los portales PILA
// externos, a la mano como la calculadora. Se busca por empresa o persona;
// la clave solo aparece al presionar "Ver clave" (queda registrado quién la
// consultó) y se oculta sola a los 30 segundos.
@Component({
  selector: 'anturi-credenciales-pila',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cred-acceso" *ngIf="!abierta">
      <button class="cred-acceso__btn" (click)="abierta = true" title="Usuarios y claves PILA">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="7.5" cy="15.5" r="4.5"></circle>
          <path d="M10.7 12.3 21 2"></path>
          <path d="m16 7 3 3"></path>
          <path d="m19 4 2 2"></path>
        </svg>
      </button>
    </div>

    <div class="cred-panel" *ngIf="abierta" role="dialog" aria-label="Usuarios y claves PILA">
      <div class="cred-panel__encabezado">
        <strong>Usuarios y claves PILA</strong>
        <button class="cred-cerrar" (click)="cerrar()" aria-label="Cerrar">✕</button>
      </div>
      <div class="cred-panel__cuerpo">
        <input type="text" class="campo-input" [(ngModel)]="busqueda" (ngModelChange)="buscar()"
               placeholder="Nombre de la empresa, persona, NIT o cédula" autocomplete="off">
        <div class="cred-ayuda" *ngIf="busqueda.trim().length < 2">Escriba al menos 2 letras para buscar.</div>
        <div class="cred-ayuda" *ngIf="buscando">Buscando...</div>
        <div class="cred-ayuda" *ngIf="!buscando && busqueda.trim().length >= 2 && resultados.length === 0">No hay credenciales para esa búsqueda.</div>

        <ul class="cred-lista" *ngIf="resultados.length > 0">
          <li *ngFor="let r of resultados" class="cred-item" [class.cred-item--abierto]="claveDe(r) !== null">
            <div class="cred-item__titulo">
              <span class="cred-tipo">{{ r.tipo === 'EMPRESA' ? 'Empresa' : 'Persona' }}</span>
              <strong>{{ r.nombre }}</strong>
            </div>
            <div class="cred-item__doc">{{ r.documento }} · {{ r.estado }}</div>
            <div class="cred-fila">
              <span class="cred-etiqueta">Usuario</span>
              <code>{{ r.usuario || '—' }}</code>
              <button *ngIf="r.usuario" class="cred-copiar" (click)="copiar(r.usuario)">Copiar</button>
            </div>
            <div class="cred-fila">
              <span class="cred-etiqueta">Clave</span>
              <ng-container *ngIf="claveDe(r) !== null; else ocultaTpl">
                <code>{{ claveDe(r) || '—' }}</code>
                <button *ngIf="claveDe(r)" class="cred-copiar" (click)="copiar(claveDe(r)!)">Copiar</button>
              </ng-container>
              <ng-template #ocultaTpl>
                <code>••••••••</code>
                <button *ngIf="r.tieneClave" class="cred-copiar cred-ver" [disabled]="cargandoClave === clave(r)" (click)="ver(r)">
                  {{ cargandoClave === clave(r) ? '...' : 'Ver clave' }}
                </button>
                <span *ngIf="!r.tieneClave" class="cred-ayuda">sin clave</span>
              </ng-template>
            </div>
          </li>
        </ul>
        <div class="cred-error" *ngIf="error">{{ error }}</div>
        <div class="cred-copiado" *ngIf="copiado">Copiado</div>
        <p class="cred-nota">Cada consulta de clave queda registrada.</p>
      </div>
    </div>
  `,
  styles: [`
    .cred-acceso { position: fixed; right: 20px; bottom: 160px; z-index: var(--z-flotante); }
    .cred-acceso__btn { width: 48px; height: 48px; border-radius: 50%; background: #E8570C; color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--sombra-lg); transition: transform var(--transicion-normal); }
    .cred-acceso__btn:hover { transform: scale(1.08); }
    .cred-acceso__btn svg { width: 22px; height: 22px; }
    .cred-panel { position: fixed; right: 20px; bottom: 20px; z-index: var(--z-modal, 1100); width: min(400px, calc(100vw - 32px)); max-height: min(620px, calc(100vh - 40px)); display: flex; flex-direction: column; background: var(--fondo-tarjeta, #fff); border: 1px solid var(--borde-color, #e5e7eb); border-radius: var(--radio-xl, 16px); box-shadow: 0 16px 40px rgba(0,0,0,0.2); overflow: hidden; }
    .cred-panel__encabezado { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--color-primario, #1B3270); color: #fff; }
    .cred-cerrar { background: none; border: none; color: #fff; font-size: 16px; cursor: pointer; }
    .cred-panel__cuerpo { padding: 12px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
    .cred-ayuda { font-size: var(--tamano-xs, 12px); color: var(--texto-terciario, #6b7280); }
    .cred-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .cred-item { border: 1px solid var(--borde-color, #e5e7eb); border-radius: var(--radio-md, 8px); padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
    .cred-item--abierto { border-color: #E8570C; }
    .cred-item__titulo { display: flex; align-items: center; gap: 6px; font-size: var(--tamano-sm, 14px); color: var(--texto-principal, #111827); }
    .cred-tipo { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 999px; background: rgba(27,50,112,0.1); color: var(--color-primario, #1B3270); }
    .cred-item__doc { font-size: var(--tamano-xs, 12px); color: var(--texto-terciario, #6b7280); }
    .cred-fila { display: flex; align-items: center; gap: 8px; font-size: var(--tamano-sm, 14px); }
    .cred-etiqueta { width: 52px; color: var(--texto-secundario, #4b5563); font-size: var(--tamano-xs, 12px); }
    .cred-fila code { flex: 1; min-width: 0; overflow-wrap: anywhere; background: rgba(0,0,0,0.04); padding: 2px 6px; border-radius: 4px; color: var(--texto-principal, #111827); }
    .cred-copiar { background: none; border: 1px solid var(--borde-color, #d1d5db); border-radius: 6px; padding: 2px 8px; font-size: var(--tamano-xs, 12px); cursor: pointer; color: var(--texto-secundario, #374151); }
    .cred-ver { border-color: #E8570C; color: #E8570C; font-weight: 600; }
    .cred-error { color: var(--color-error, #b91c1c); font-size: var(--tamano-sm, 14px); }
    .cred-copiado { align-self: center; font-size: var(--tamano-xs, 12px); color: #15803d; font-weight: 600; }
    .cred-nota { margin: 4px 0 0; font-size: 11px; color: var(--texto-terciario, #9ca3af); text-align: center; }
  `],
})
export class CredencialesPilaComponent implements OnDestroy {
  abierta = false;
  busqueda = '';
  buscando = false;
  resultados: Resultado[] = [];
  error = '';
  copiado = false;
  cargandoClave: string | null = null;
  private claves = new Map<string, string | null>();
  private temporizadores = new Map<string, ReturnType<typeof setTimeout>>();
  private temporizadorBusqueda: ReturnType<typeof setTimeout> | null = null;
  private readonly URL = `${entorno.urlApi}/credenciales-pila`;

  constructor(private http: HttpClient) {}

  ngOnDestroy(): void {
    this.temporizadores.forEach((t) => clearTimeout(t));
  }

  clave(r: Resultado): string {
    return `${r.tipo}-${r.id}`;
  }

  claveDe(r: Resultado): string | null {
    const k = this.clave(r);
    return this.claves.has(k) ? (this.claves.get(k) ?? '') : null;
  }

  cerrar(): void {
    this.abierta = false;
    this.claves.clear();
    this.temporizadores.forEach((t) => clearTimeout(t));
    this.temporizadores.clear();
  }

  buscar(): void {
    if (this.temporizadorBusqueda) clearTimeout(this.temporizadorBusqueda);
    this.error = '';
    const q = this.busqueda.trim();
    if (q.length < 2) { this.resultados = []; return; }
    this.temporizadorBusqueda = setTimeout(() => {
      this.buscando = true;
      this.http.get<Resultado[]>(this.URL, { params: new HttpParams().set('busqueda', q) }).subscribe({
        next: (lista) => { this.resultados = lista; this.buscando = false; },
        error: (err) => { this.buscando = false; this.resultados = []; this.error = err?.error?.message || 'No se pudo buscar.'; },
      });
    }, 350);
  }

  ver(r: Resultado): void {
    const k = this.clave(r);
    this.cargandoClave = k;
    this.http.post<{ usuario: string | null; clave: string | null }>(`${this.URL}/${r.tipo}/${r.id}/ver`, {}).subscribe({
      next: (d) => {
        this.cargandoClave = null;
        this.claves.set(k, d.clave);
        if (d.usuario) r.usuario = d.usuario;
        // La clave se oculta sola a los 30 segundos.
        if (this.temporizadores.has(k)) clearTimeout(this.temporizadores.get(k)!);
        this.temporizadores.set(k, setTimeout(() => { this.claves.delete(k); this.temporizadores.delete(k); }, 30_000));
      },
      error: (err) => { this.cargandoClave = null; this.error = err?.error?.message || 'No se pudo consultar la clave.'; },
    });
  }

  copiar(texto: string): void {
    navigator.clipboard?.writeText(texto).then(() => {
      this.copiado = true;
      setTimeout(() => (this.copiado = false), 1500);
    }).catch(() => undefined);
  }
}
