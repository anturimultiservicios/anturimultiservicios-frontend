import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CredencialesServicio, Credencial, TIPOS_CREDENCIAL, TipoCredencial } from '../../nucleo/servicios/credenciales.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

// 2026-10-08: usuarios y claves de portales de UNA empresa o persona - se usa
// en su ficha y dentro del botón flotante de la llave. La clave solo aparece
// al presionar "Ver clave" (queda registrado) y se oculta a los 30 segundos.
@Component({
  selector: 'anturi-credenciales-titular',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ct">
      <div *ngIf="cargando" class="ct-ayuda">Cargando...</div>
      <div *ngIf="!cargando && credenciales.length === 0 && !formulario" class="ct-ayuda">Todavía no hay usuarios ni claves guardados.</div>

      <div *ngFor="let c of credenciales" class="ct-item" [class.ct-item--abierto]="claves.has(c.id)">
        <div class="ct-item__titulo">
          <span class="ct-tipo">{{ nombreTipo(c.tipo) }}</span>
          <strong>{{ c.entidad }}</strong>
          <!-- 2026-10-09: Editar para todos los roles (los portales piden cambiar la clave); Quitar solo Admin -->
          <span class="ct-acciones-admin">
            <button class="ct-mini" (click)="editar(c)" title="Cambiar usuario o clave">Editar</button>
            <button *ngIf="esAdmin" class="ct-mini ct-mini--peligro" (click)="quitar(c)" title="Quitar">Quitar</button>
          </span>
        </div>
        <div class="ct-fila">
          <span class="ct-etiqueta">Usuario</span>
          <code>{{ c.usuario || '—' }}</code>
          <button *ngIf="c.usuario" class="ct-mini" (click)="copiar(c.usuario)">Copiar</button>
        </div>
        <div class="ct-fila">
          <span class="ct-etiqueta">Clave</span>
          <ng-container *ngIf="claves.has(c.id); else ocultaTpl">
            <code>{{ claves.get(c.id) || '—' }}</code>
            <button *ngIf="claves.get(c.id)" class="ct-mini" (click)="copiar(claves.get(c.id)!)">Copiar</button>
          </ng-container>
          <ng-template #ocultaTpl>
            <code>{{ c.tieneClave ? '••••••••' : 'sin clave' }}</code>
            <button *ngIf="c.tieneClave" class="ct-mini ct-ver" [disabled]="viendo === c.id" (click)="ver(c)">{{ viendo === c.id ? '...' : 'Ver clave' }}</button>
          </ng-template>
        </div>
        <div class="ct-notas" *ngIf="c.notas">{{ c.notas }}</div>
      </div>

      <!-- Formulario agregar / editar -->
      <div *ngIf="formulario" class="ct-form">
        <strong>{{ editando ? 'Cambiar usuario o clave' : 'Agregar usuario y clave' }}</strong>
        <label class="ct-label">Portal</label>
        <select class="campo-input" [(ngModel)]="formulario.tipo" name="ct-tipo">
          <option *ngFor="let t of tipos" [value]="t.valor">{{ t.nombre }}</option>
        </select>
        <label class="ct-label">Entidad</label>
        <input class="campo-input" [(ngModel)]="formulario.entidad" name="ct-entidad" [placeholder]="ejemploDe(formulario.tipo)">
        <label class="ct-label">Usuario</label>
        <input class="campo-input" [(ngModel)]="formulario.usuario" name="ct-usuario" autocomplete="off">
        <label class="ct-label">{{ editando ? 'Clave nueva (déjela vacía para no cambiarla)' : 'Clave' }}</label>
        <input class="campo-input" [(ngModel)]="formulario.clave" name="ct-clave" autocomplete="new-password" type="text">
        <label class="ct-label">Notas (opcional)</label>
        <input class="campo-input" [(ngModel)]="formulario.notas" name="ct-notas" placeholder="Ej. correo de recuperación del portal">
        <div *ngIf="error" class="ct-error">{{ error }}</div>
        <div class="ct-form__acciones">
          <button class="boton boton-secundario boton-sm" (click)="cancelar()" [disabled]="guardando">Cancelar</button>
          <button class="boton boton-primario boton-sm" (click)="guardar()" [disabled]="guardando">{{ guardando ? 'Guardando...' : 'Guardar' }}</button>
        </div>
      </div>

      <button *ngIf="!formulario" class="ct-agregar" (click)="nuevo()">+ Agregar usuario y clave</button>
      <div class="ct-copiado" *ngIf="copiado">Copiado</div>
    </div>
  `,
  styles: [`
    .ct { display: flex; flex-direction: column; gap: 8px; }
    .ct-ayuda { font-size: var(--tamano-xs, 12px); color: var(--texto-terciario, #6b7280); }
    .ct-item { border: 1px solid var(--borde-color, #e5e7eb); border-radius: var(--radio-md, 8px); padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
    .ct-item--abierto { border-color: #E8570C; }
    .ct-item__titulo { display: flex; align-items: center; gap: 6px; font-size: var(--tamano-sm, 14px); color: var(--texto-principal, #111827); flex-wrap: wrap; }
    .ct-tipo { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 999px; background: rgba(27,50,112,0.1); color: var(--color-primario, #1B3270); }
    .ct-acciones-admin { margin-left: auto; display: flex; gap: 4px; }
    .ct-fila { display: flex; align-items: center; gap: 8px; font-size: var(--tamano-sm, 14px); }
    .ct-etiqueta { width: 52px; color: var(--texto-secundario, #4b5563); font-size: var(--tamano-xs, 12px); }
    .ct-fila code { flex: 1; min-width: 0; overflow-wrap: anywhere; background: rgba(0,0,0,0.04); padding: 2px 6px; border-radius: 4px; color: var(--texto-principal, #111827); }
    .ct-mini { background: none; border: 1px solid var(--borde-color, #d1d5db); border-radius: 6px; padding: 2px 8px; font-size: var(--tamano-xs, 12px); cursor: pointer; color: var(--texto-secundario, #374151); }
    .ct-mini--peligro { color: #b91c1c; border-color: rgba(185,28,28,0.4); }
    .ct-ver { border-color: #E8570C; color: #E8570C; font-weight: 600; }
    .ct-notas { font-size: var(--tamano-xs, 12px); color: var(--texto-terciario, #6b7280); }
    .ct-form { border: 1px dashed var(--borde-color, #d1d5db); border-radius: var(--radio-md, 8px); padding: 10px; display: flex; flex-direction: column; gap: 4px; }
    .ct-label { font-size: var(--tamano-xs, 12px); color: var(--texto-secundario, #4b5563); margin-top: 4px; }
    .ct-form__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
    .ct-error { color: var(--color-error, #b91c1c); font-size: var(--tamano-sm, 14px); }
    .ct-agregar { align-self: flex-start; background: none; border: none; color: var(--color-primario, #1B3270); font-weight: 600; cursor: pointer; padding: 2px 0; font-size: var(--tamano-sm, 14px); }
    .ct-copiado { align-self: center; font-size: var(--tamano-xs, 12px); color: #15803d; font-weight: 600; }
  `],
})
export class CredencialesTitularComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) titularTipo!: 'EMPRESA' | 'AFILIADO';
  @Input({ required: true }) titularId!: number;

  readonly tipos = TIPOS_CREDENCIAL;
  credenciales: Credencial[] = [];
  cargando = false;
  claves = new Map<number, string | null>();
  viendo: number | null = null;
  copiado = false;
  formulario: { tipo: TipoCredencial; entidad: string; usuario: string; clave: string; notas: string } | null = null;
  editando: Credencial | null = null;
  guardando = false;
  error = '';
  private temporizadores = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(private servicio: CredencialesServicio, private auth: AutenticacionServicio) {}

  get esAdmin(): boolean {
    return this.auth.tieneRol(['ADMIN', 'SUPER_ADMIN']);
  }

  ngOnChanges(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.temporizadores.forEach((t) => clearTimeout(t));
  }

  cargar(): void {
    if (!this.titularId) return;
    this.cargando = true;
    this.servicio.deTitular(this.titularTipo, this.titularId).subscribe({
      next: (l) => { this.credenciales = l; this.cargando = false; },
      error: () => { this.credenciales = []; this.cargando = false; },
    });
  }

  nombreTipo(t: string): string {
    return TIPOS_CREDENCIAL.find((x) => x.valor === t)?.nombre ?? t;
  }

  ejemploDe(t: string): string {
    return 'Ej. ' + (TIPOS_CREDENCIAL.find((x) => x.valor === t)?.ejemplo ?? '');
  }

  ver(c: Credencial): void {
    this.viendo = c.id;
    this.servicio.ver(c.id).subscribe({
      next: (d) => {
        this.viendo = null;
        this.claves.set(c.id, d.clave);
        if (this.temporizadores.has(c.id)) clearTimeout(this.temporizadores.get(c.id)!);
        this.temporizadores.set(c.id, setTimeout(() => { this.claves.delete(c.id); this.temporizadores.delete(c.id); }, 30_000));
      },
      error: (err) => { this.viendo = null; this.error = err?.error?.message || 'No se pudo consultar la clave.'; },
    });
  }

  copiar(texto: string): void {
    navigator.clipboard?.writeText(texto).then(() => { this.copiado = true; setTimeout(() => (this.copiado = false), 1500); }).catch(() => undefined);
  }

  nuevo(): void {
    this.editando = null;
    this.error = '';
    this.formulario = { tipo: 'EPS', entidad: '', usuario: '', clave: '', notas: '' };
  }

  editar(c: Credencial): void {
    this.editando = c;
    this.error = '';
    this.formulario = { tipo: c.tipo, entidad: c.entidad, usuario: c.usuario ?? '', clave: '', notas: c.notas ?? '' };
  }

  cancelar(): void {
    this.formulario = null;
    this.editando = null;
  }

  guardar(): void {
    const f = this.formulario;
    if (!f) return;
    if (f.entidad.trim().length < 2) { this.error = 'Escriba el nombre de la entidad (ej. Nueva EPS).'; return; }
    if (!this.editando && !f.usuario.trim() && !f.clave.trim()) { this.error = 'Escriba al menos el usuario o la clave.'; return; }
    this.guardando = true;
    this.error = '';
    const datos = { tipo: f.tipo, entidad: f.entidad, usuario: f.usuario, notas: f.notas, ...(f.clave.trim() ? { clave: f.clave } : {}) };
    const peticion = this.editando ? this.servicio.actualizar(this.editando.id, datos) : this.servicio.crear(this.titularTipo, this.titularId, datos);
    peticion.subscribe({
      next: () => { this.guardando = false; this.formulario = null; this.editando = null; this.claves.clear(); this.cargar(); },
      error: (err) => { this.guardando = false; const m = err?.error?.message; this.error = (Array.isArray(m) ? m[0] : m) || 'No se pudo guardar.'; },
    });
  }

  quitar(c: Credencial): void {
    if (!confirm(`¿Quitar el usuario y clave de ${this.nombreTipo(c.tipo)} (${c.entidad})?`)) return;
    this.servicio.quitar(c.id).subscribe({ next: () => this.cargar(), error: (err) => (this.error = err?.error?.message || 'No se pudo quitar.') });
  }
}
