import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FichaTrabajador, TrabajadoresServicio } from '../../nucleo/servicios/trabajadores.servicio';
import { DocumentosTitularComponent } from '../documentos-titular/documentos-titular.component';
import { FamiliaComponent } from '../familia/familia.component';
import { FechaDmyComponent } from '../fecha-dmy/fecha-dmy.component';

// 2026-10-16 (pedido de Anyi): ficha del trabajador de una empresa que no
// tiene ficha de afiliado (la mayoría vino así del Excel). Datos personales
// (fecha de nacimiento, expedición de la cédula...), documentos y familia.
@Component({
  selector: 'anturi-ficha-trabajador',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DocumentosTitularComponent, FamiliaComponent, FechaDmyComponent],
  template: `
    <div class="ficha">
      <button type="button" class="boton boton-texto boton-sm" (click)="volver()">← Volver</button>
      <p *ngIf="cargando" class="sub">Cargando…</p>
      <p *ngIf="error && !t" class="aviso-error" role="alert">{{ error }}</p>

      <ng-container *ngIf="t">
        <div class="tarjeta seccion-datos">
          <div class="seccion-titulo-fila">
            <div>
              <h2 class="titulo">{{ t.nombres }} {{ t.apellidos }}</h2>
              <p class="sub">{{ t.tipoDocumento }} {{ t.numeroDocumento }} · Trabajador</p>
            </div>
            <div class="acciones">
              <a *ngIf="t.afiliado" [routerLink]="[prefijo, 'afiliados', t.afiliado.id]" class="boton boton-secundario boton-sm">Ver ficha de afiliado</a>
              <button *ngIf="!editando" type="button" class="boton boton-primario boton-sm" (click)="editar()">Editar datos</button>
            </div>
          </div>
          <p *ngIf="mensaje" class="aviso-ok" role="status">{{ mensaje }}</p>
          <p *ngIf="error && t" class="aviso-error" role="alert">{{ error }}</p>

          <div *ngIf="!editando" class="datos-grid">
            <div class="dato-item"><span class="dato-etiqueta">Fecha de nacimiento</span><span class="dato-valor">{{ t.fechaNacimiento ? (t.fechaNacimiento | date:'dd/MM/yyyy':'UTC') : '—' }}{{ edad }}</span></div>
            <div class="dato-item"><span class="dato-etiqueta">Fecha de expedición del documento</span><span class="dato-valor">{{ t.fechaExpedicion ? (t.fechaExpedicion | date:'dd/MM/yyyy':'UTC') : '—' }}</span></div>
            <div class="dato-item"><span class="dato-etiqueta">Celular</span><span class="dato-valor">{{ t.telefono || '—' }}</span></div>
            <div class="dato-item"><span class="dato-etiqueta">Correo</span><span class="dato-valor">{{ t.correo || '—' }}</span></div>
            <div class="dato-item"><span class="dato-etiqueta">Dirección</span><span class="dato-valor">{{ t.direccion || '—' }}{{ t.municipio ? ' · ' + t.municipio : '' }}</span></div>
            <div class="dato-item dato-item--ancho" *ngIf="t.observaciones"><span class="dato-etiqueta">Observaciones</span><span class="dato-valor">{{ t.observaciones }}</span></div>
          </div>

          <form *ngIf="editando && f" class="form-grid" (ngSubmit)="guardar()">
            <div class="campo-grupo"><label class="campo-etiqueta" for="tNombres">Nombres</label><input id="tNombres" class="campo-input" [(ngModel)]="f.nombres" name="nombres" required></div>
            <div class="campo-grupo"><label class="campo-etiqueta" for="tApellidos">Apellidos</label><input id="tApellidos" class="campo-input" [(ngModel)]="f.apellidos" name="apellidos"></div>
            <div class="campo-grupo"><span class="campo-etiqueta">Fecha de nacimiento</span><anturi-fecha-dmy etiqueta="Fecha de nacimiento" [(valor)]="f.fechaNacimiento"></anturi-fecha-dmy></div>
            <div class="campo-grupo"><span class="campo-etiqueta">Fecha de expedición del documento</span><anturi-fecha-dmy etiqueta="Fecha de expedición" [aniosAtras]="80" [(valor)]="f.fechaExpedicion"></anturi-fecha-dmy></div>
            <div class="campo-grupo"><label class="campo-etiqueta" for="tTel">Celular</label><input id="tTel" class="campo-input" [(ngModel)]="f.telefono" name="telefono" inputmode="tel"></div>
            <div class="campo-grupo"><label class="campo-etiqueta" for="tCorreo">Correo</label><input id="tCorreo" type="email" class="campo-input" [(ngModel)]="f.correo" name="correo"></div>
            <div class="campo-grupo"><label class="campo-etiqueta" for="tDir">Dirección</label><input id="tDir" class="campo-input" [(ngModel)]="f.direccion" name="direccion"></div>
            <div class="campo-grupo"><label class="campo-etiqueta" for="tMun">Municipio</label><input id="tMun" class="campo-input" [(ngModel)]="f.municipio" name="municipio"></div>
            <div class="campo-grupo dato-item--ancho"><label class="campo-etiqueta" for="tObs">Observaciones</label><textarea id="tObs" class="campo-input" rows="2" [(ngModel)]="f.observaciones" name="observaciones"></textarea></div>
            <div class="acciones dato-item--ancho">
              <button type="button" class="boton boton-secundario boton-sm" (click)="editando = false">Cancelar</button>
              <button type="submit" class="boton boton-primario boton-sm" [disabled]="guardando || !f.nombres.trim()">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
            </div>
          </form>
        </div>

        <div class="tarjeta seccion-datos">
          <h3 class="seccion-titulo">Dónde trabaja</h3>
          <div class="tabla-contenedor">
            <table class="tabla">
              <thead><tr><th>Empresa</th><th>Cargo</th><th>Sede</th><th>Desde</th><th>Estado</th></tr></thead>
              <tbody>
                <tr *ngFor="let r of t.relacionesLaborales">
                  <td><a [routerLink]="[prefijo, 'empresas', r.empresa.id]">{{ r.empresa.razonSocial }}</a></td>
                  <td>{{ r.cargo || '—' }}</td>
                  <td>{{ r.sucursal?.nombre || 'Sede principal' }}</td>
                  <td>{{ r.fechaIngreso ? (r.fechaIngreso | date:'dd/MM/yyyy':'UTC') : '—' }}</td>
                  <td>{{ r.estado === 'ACTIVA' ? 'Trabaja aquí' : 'Retirado' + (r.fechaRetiro ? ' ' + (r.fechaRetiro | date:'dd/MM/yyyy':'UTC') : '') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="tarjeta seccion-datos">
          <anturi-familia [personaId]="t.id"></anturi-familia>
        </div>

        <div class="tarjeta seccion-datos">
          <anturi-documentos-titular titularTipo="PERSONA" [titularId]="t.id"></anturi-documentos-titular>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .ficha { display: flex; flex-direction: column; gap: var(--espacio-4, 16px); }
    .ficha > .boton { align-self: flex-start; }
    .titulo { margin: 0; font-size: 22px; color: var(--texto-principal); }
    .sub { margin: 2px 0 0; color: var(--texto-terciario); font-size: var(--tamano-sm); }
    .seccion-titulo-fila { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
    .acciones { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .datos-grid, .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--espacio-4, 16px); }
    .dato-item { display: flex; flex-direction: column; gap: 4px; }
    .dato-item--ancho { grid-column: 1 / -1; }
    .dato-etiqueta { font-size: 12px; color: var(--texto-terciario); text-transform: uppercase; font-weight: 600; }
    .dato-valor { color: var(--texto-principal); }
    .aviso-ok { color: #1f7a3d; font-size: var(--tamano-sm); }
    .aviso-error { color: #b42318; font-size: var(--tamano-sm); }
  `],
})
export class FichaTrabajadorComponent implements OnInit {
  t: FichaTrabajador | null = null;
  f: { nombres: string; apellidos: string; fechaNacimiento: string; fechaExpedicion: string; telefono: string; correo: string; direccion: string; municipio: string; observaciones: string } | null = null;
  cargando = false;
  editando = false;
  guardando = false;
  mensaje = '';
  error = '';
  private id = 0;

  constructor(private ruta: ActivatedRoute, private router: Router, private location: Location, private servicio: TrabajadoresServicio) {}

  get prefijo(): string {
    return this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
  }

  ngOnInit(): void {
    this.id = Number(this.ruta.snapshot.paramMap.get('personaId'));
    this.cargar();
  }

  private cargar(): void {
    this.cargando = true;
    this.servicio.obtener(this.id).subscribe({
      next: (t) => { this.t = t; this.cargando = false; },
      error: () => { this.cargando = false; this.error = 'No se encontró el trabajador.'; },
    });
  }

  get edad(): string {
    if (!this.t?.fechaNacimiento) return '';
    const n = new Date(this.t.fechaNacimiento);
    const hoy = new Date();
    let e = hoy.getFullYear() - n.getUTCFullYear();
    if (hoy.getMonth() < n.getUTCMonth() || (hoy.getMonth() === n.getUTCMonth() && hoy.getDate() < n.getUTCDate())) e--;
    return e >= 0 ? ` (${e} años)` : '';
  }

  editar(): void {
    const t = this.t!;
    const d = (v: string | null) => (v ? v.slice(0, 10) : '');
    this.f = {
      nombres: t.nombres, apellidos: t.apellidos, fechaNacimiento: d(t.fechaNacimiento), fechaExpedicion: d(t.fechaExpedicion),
      telefono: t.telefono ?? '', correo: t.correo ?? '', direccion: t.direccion ?? '', municipio: t.municipio ?? '', observaciones: t.observaciones ?? '',
    };
    this.error = '';
    this.editando = true;
  }

  guardar(): void {
    if (!this.f) return;
    const f = this.f;
    this.guardando = true;
    this.servicio.actualizar(this.id, {
      nombres: f.nombres.trim(), apellidos: f.apellidos.trim(), fechaNacimiento: f.fechaNacimiento, fechaExpedicion: f.fechaExpedicion,
      telefono: f.telefono.trim(), correo: f.correo.trim(), direccion: f.direccion.trim(), municipio: f.municipio.trim(), observaciones: f.observaciones.trim(),
    } as any).subscribe({
      next: () => {
        this.guardando = false;
        this.editando = false;
        this.mensaje = 'Datos guardados.';
        setTimeout(() => (this.mensaje = ''), 4000);
        this.cargar();
      },
      error: (e) => {
        this.guardando = false;
        const m = e?.error?.message;
        this.error = Array.isArray(m) ? m.join('. ') : m || 'No se pudo guardar.';
      },
    });
  }

  volver(): void {
    this.location.back();
  }
}
