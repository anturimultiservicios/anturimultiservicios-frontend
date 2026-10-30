import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Familiar, PARENTESCOS, TrabajadoresServicio } from '../../nucleo/servicios/trabajadores.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';
import { FechaDmyComponent } from '../fecha-dmy/fecha-dmy.component';
import { DocumentosTitularComponent } from '../documentos-titular/documentos-titular.component';
import { TIPOS_DOCUMENTO, siglaDocumento } from '../../nucleo/utilidades/tipos-documento';

// 2026-10-16 (pedido de Anyi): la familia (beneficiarios) de un afiliado o
// de un trabajador. Hijos, hijastros, cónyuge, hermanos y padres que
// dependen económicamente de él.
// 2026-10-30 (Anyi): cada familiar tiene sus propios documentos (registro
// civil del hijo, cédula del cónyuge...), aparte de los del titular.
@Component({
  selector: 'anturi-familia',
  standalone: true,
  imports: [CommonModule, FormsModule, FechaDmyComponent, DocumentosTitularComponent],
  template: `
    <div class="seccion-titulo-fila">
      <h3 class="seccion-titulo">Familia / beneficiarios ({{ familia.length }})</h3>
      <button *ngIf="!form" type="button" class="boton boton-primario boton-sm" (click)="nuevo()">+ Agregar familiar</button>
    </div>
    <p *ngIf="mensaje" class="aviso-ok" role="status">{{ mensaje }}</p>
    <p *ngIf="error" class="aviso-error" role="alert">{{ error }}</p>

    <form *ngIf="form" class="fam-form" (ngSubmit)="guardar()">
      <div class="campo-grupo">
        <label class="campo-etiqueta" for="famParentesco">Parentesco *</label>
        <select id="famParentesco" class="campo-input" [(ngModel)]="form.parentesco" name="parentesco" required>
          <option value="">Escoja…</option>
          <option *ngFor="let p of parentescos" [value]="p.valor">{{ p.nombre }}</option>
        </select>
      </div>
      <div class="campo-grupo">
        <label class="campo-etiqueta" for="famNombres">Nombres *</label>
        <input id="famNombres" class="campo-input" [(ngModel)]="form.nombres" name="nombres" required>
      </div>
      <div class="campo-grupo">
        <label class="campo-etiqueta" for="famApellidos">Apellidos</label>
        <input id="famApellidos" class="campo-input" [(ngModel)]="form.apellidos" name="apellidos">
      </div>
      <div class="campo-grupo">
        <label class="campo-etiqueta" for="famTipo">Documento</label>
        <div class="fam-doc">
          <select id="famTipo" class="campo-input" [(ngModel)]="form.tipoDocumento" name="tipoDocumento" aria-label="Tipo de documento">
            <!-- 2026-10-30: la misma lista completa de todo el sistema -->
            <option *ngFor="let t of tiposDocumento" [value]="t.valor">{{ t.nombre }}</option>
            <option *ngIf="form.tipoDocumento === 'PA'" value="PA">Pasaporte</option>
          </select>
          <input class="campo-input" [(ngModel)]="form.numeroDocumento" name="numeroDocumento" inputmode="numeric" aria-label="Número de documento">
        </div>
      </div>
      <div class="campo-grupo">
        <span class="campo-etiqueta">Fecha de nacimiento</span>
        <anturi-fecha-dmy etiqueta="Fecha de nacimiento del familiar" [(valor)]="form.fechaNacimiento"></anturi-fecha-dmy>
      </div>
      <!-- 2026-10-22 (Anyi) -->
      <div class="campo-grupo">
        <label class="campo-etiqueta" for="famTel">Teléfono</label>
        <input id="famTel" class="campo-input" [(ngModel)]="form.telefono" name="telefono" inputmode="tel">
      </div>
      <div class="campo-grupo">
        <label class="campo-etiqueta" for="famCorreo">Correo</label>
        <input id="famCorreo" type="email" class="campo-input" [(ngModel)]="form.correo" name="correo">
      </div>
      <div class="campo-grupo fam-ancho">
        <label class="campo-etiqueta" for="famDir">Dirección</label>
        <input id="famDir" class="campo-input" [(ngModel)]="form.direccion" name="direccion">
      </div>
      <div class="campo-grupo fam-ancho">
        <label class="campo-etiqueta" for="famObs">Nota</label>
        <input id="famObs" class="campo-input" [(ngModel)]="form.observaciones" name="observaciones" placeholder="Ej. estudia, depende económicamente">
      </div>
      <div class="fam-acciones fam-ancho">
        <button type="button" class="boton boton-secundario boton-sm" (click)="form = null">Cancelar</button>
        <button type="submit" class="boton boton-primario boton-sm" [disabled]="guardando || !form.nombres?.trim() || !form.parentesco">{{ guardando ? 'Guardando…' : (form.id ? 'Guardar cambios' : 'Agregar') }}</button>
      </div>
    </form>

    <p *ngIf="!cargando && !familia.length && !form" class="vacio">Todavía no tiene familiares registrados.</p>
    <div class="tabla-contenedor" *ngIf="familia.length">
      <table class="tabla">
        <thead><tr><th>Parentesco</th><th>Nombre</th><th>Documento</th><th>Nacimiento</th><th>Contacto</th><th></th></tr></thead>
        <tbody>
          <ng-container *ngFor="let f of familia">
          <tr>
            <td>{{ nombreParentesco(f.parentesco) }}</td>
            <td>{{ f.nombres }} {{ f.apellidos }}<div *ngIf="f.observaciones" class="nota">{{ f.observaciones }}</div></td>
            <td>{{ f.numeroDocumento ? sigla(f.tipoDocumento) + ' ' + f.numeroDocumento : '—' }}</td>
            <td>{{ f.fechaNacimiento ? (f.fechaNacimiento | date:'dd/MM/yyyy':'UTC') : '—' }}{{ edad(f) }}</td>
            <td>{{ f.telefono || '' }}<div *ngIf="f.correo" class="nota">{{ f.correo }}</div><div *ngIf="f.direccion" class="nota">{{ f.direccion }}</div><span *ngIf="!f.telefono && !f.correo && !f.direccion">—</span></td>
            <td class="acciones">
              <button type="button" class="boton boton-texto boton-sm" (click)="docsAbierto = docsAbierto === f.id ? null : f.id" [attr.aria-expanded]="docsAbierto === f.id">📁 Documentos</button>
              <button type="button" class="boton boton-texto boton-sm" (click)="editar(f)">Editar</button>
              <button *ngIf="!esAsistente" type="button" class="boton boton-texto boton-sm" (click)="pedirQuitar(f)">Quitar</button>
            </td>
          </tr>
          <tr *ngIf="docsAbierto === f.id" class="fam-docs">
            <td colspan="6">
              <anturi-documentos-titular titularTipo="FAMILIAR" [titularId]="f.id" [titulo]="f.nombres + ' ' + f.apellidos + ' (' + nombreParentesco(f.parentesco).toLowerCase() + ')'"></anturi-documentos-titular>
            </td>
          </tr>
          </ng-container>
        </tbody>
      </table>
    </div>

    <div *ngIf="quitando" class="modal-overlay" (click)="quitando = null">
      <div class="fam-modal" (click)="$event.stopPropagation()" role="dialog" aria-labelledby="tituloQuitar">
        <h3 id="tituloQuitar">Quitar a {{ quitando.nombres }} {{ quitando.apellidos }}</h3>
        <label class="campo-etiqueta" for="motivoQuitar">¿Por qué se quita?{{ esAsistente ? ' *' : '' }}</label>
        <input id="motivoQuitar" class="campo-input" [(ngModel)]="motivoQuitar" placeholder="Ej. ya no depende económicamente">
        <p *ngIf="esAsistente" class="nota">Se quita de una vez y le llega a Anturi para que lo confirme.</p>
        <div class="fam-acciones">
          <button type="button" class="boton boton-secundario boton-sm" (click)="quitando = null">Cancelar</button>
          <button type="button" class="boton boton-primario boton-sm" [disabled]="esAsistente && motivoQuitar.trim().length < 3" (click)="quitar()">Quitar</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .seccion-titulo-fila { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .fam-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px 14px; padding: 12px; margin-bottom: 12px; border: 1px solid var(--borde-color, #e5e7eb); border-radius: 10px; }
    .fam-ancho { grid-column: 1 / -1; }
    .fam-doc { display: grid; grid-template-columns: 110px 1fr; gap: 6px; }
    .fam-acciones { display: flex; justify-content: flex-end; gap: 8px; }
    .vacio, .nota { color: var(--texto-terciario); font-size: var(--tamano-sm); margin: 4px 0; }
    .acciones { white-space: nowrap; }
    .fam-docs td { background: var(--fondo-secundario, #f8fafc); padding: 12px; }
    .aviso-ok { color: #1f7a3d; font-size: var(--tamano-sm); }
    .aviso-error { color: #b42318; font-size: var(--tamano-sm); }
    .fam-modal { background: var(--fondo-tarjeta, #fff); border-radius: 14px; width: min(460px, 100%); padding: 18px; display: flex; flex-direction: column; gap: 8px; }
    .fam-modal h3 { margin: 0; font-size: 17px; color: var(--texto-principal); }
  `],
})
export class FamiliaComponent implements OnChanges {
  @Input() afiliadoId?: number;
  @Input() personaId?: number;

  readonly parentescos = PARENTESCOS;
  readonly tiposDocumento = TIPOS_DOCUMENTO;
  readonly sigla = siglaDocumento;
  familia: Familiar[] = [];
  cargando = false;
  guardando = false;
  form: (Partial<Familiar> & { fechaNacimiento?: string | null }) | null = null;
  quitando: Familiar | null = null;
  docsAbierto: number | null = null;
  motivoQuitar = '';
  mensaje = '';
  error = '';
  readonly esAsistente: boolean;

  constructor(private servicio: TrabajadoresServicio, auth: AutenticacionServicio) {
    this.esAsistente = auth.usuarioActual?.rol === 'SECRETARIA';
  }

  ngOnChanges(): void {
    if (this.afiliadoId || this.personaId) this.cargar();
  }

  private get titular() {
    return this.afiliadoId ? { afiliadoId: this.afiliadoId } : { personaId: this.personaId };
  }

  cargar(): void {
    this.cargando = true;
    this.servicio.familia(this.titular).subscribe({
      next: (l) => { this.familia = l; this.cargando = false; },
      error: () => { this.cargando = false; this.error = 'No se pudo cargar la familia.'; },
    });
  }

  nombreParentesco(v: string): string {
    return PARENTESCOS.find((p) => p.valor === v)?.nombre ?? v;
  }

  edad(f: Familiar): string {
    if (!f.fechaNacimiento) return '';
    const n = new Date(f.fechaNacimiento);
    const hoy = new Date();
    let e = hoy.getFullYear() - n.getUTCFullYear();
    if (hoy.getMonth() < n.getUTCMonth() || (hoy.getMonth() === n.getUTCMonth() && hoy.getDate() < n.getUTCDate())) e--;
    return e >= 0 ? ` (${e} años)` : '';
  }

  nuevo(): void {
    this.error = '';
    this.form = { parentesco: '', nombres: '', apellidos: '', tipoDocumento: 'RC', numeroDocumento: '', fechaNacimiento: '', correo: '', telefono: '', direccion: '', observaciones: '' };
  }

  editar(f: Familiar): void {
    this.error = '';
    this.form = { ...f, fechaNacimiento: f.fechaNacimiento ? f.fechaNacimiento.slice(0, 10) : '', numeroDocumento: f.numeroDocumento ?? '', correo: f.correo ?? '', telefono: f.telefono ?? '', direccion: f.direccion ?? '', observaciones: f.observaciones ?? '' };
  }

  guardar(): void {
    const f = this.form;
    if (!f || !f.nombres?.trim() || !f.parentesco) return;
    const datos: Partial<Familiar> = {
      parentesco: f.parentesco, nombres: f.nombres.trim(), apellidos: (f.apellidos ?? '').trim(),
      tipoDocumento: f.tipoDocumento || 'CC', numeroDocumento: (f.numeroDocumento ?? '').trim(),
      fechaNacimiento: f.fechaNacimiento || '', observaciones: (f.observaciones ?? '').trim(),
      correo: (f.correo ?? '').trim(), telefono: (f.telefono ?? '').trim(), direccion: (f.direccion ?? '').trim(),
    } as any;
    this.guardando = true;
    const peticion = f.id ? this.servicio.editarFamiliar(f.id, datos) : this.servicio.agregarFamiliar({ ...datos, ...this.titular });
    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.form = null;
        this.avisar(f.id ? 'Familiar actualizado.' : 'Familiar agregado.');
        this.cargar();
      },
      error: (e) => { this.guardando = false; this.error = this.textoError(e); },
    });
  }

  pedirQuitar(f: Familiar): void {
    this.quitando = f;
    this.motivoQuitar = '';
  }

  quitar(): void {
    const f = this.quitando;
    if (!f) return;
    this.quitando = null;
    this.servicio.quitarFamiliar(f.id, this.motivoQuitar.trim()).subscribe({
      next: (r) => { this.avisar(r.pendienteAprobacion ? 'Quitado. Le llegó a Anturi para que lo confirme.' : 'Quitado.'); this.cargar(); },
      error: (e) => (this.error = this.textoError(e)),
    });
  }

  private avisar(m: string): void {
    this.error = '';
    this.mensaje = m;
    setTimeout(() => (this.mensaje = ''), 5000);
  }

  private textoError(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join('. ') : m || 'No se pudo guardar.';
  }
}
