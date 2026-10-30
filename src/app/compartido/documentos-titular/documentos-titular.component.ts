import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { catchError, forkJoin, of } from 'rxjs';
import { CatalogoCarpetas, Documento, DocumentosServicio } from '../../nucleo/servicios/documentos.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

interface Carpeta { clave: string; nombre: string; tipo: string; carpetaId: number | null; obligatoria: boolean }

// 2026-10-15 (pedido de Cristopher): documentos por CARPETAS, para afiliados
// y empresas. Las carpetas tienen nombre único en todo el sistema: si alguien
// crea "CC" y ya existe "Cédula", se usa la misma. Se pueden subir varios
// archivos a la vez. La vista previa pide el archivo con la sesión.
// 2026-10-29 (Anturi no podía subir nada): celulares, WhatsApp, Drive y algunos
// escáneres entregan el archivo con un nombre SIN extensión ("IMG-20261027-WA0003")
// aunque sea un PDF o una foto. Si el nombre no la trae, se completa con el tipo
// del archivo; si tampoco se sabe el tipo, no se sube.
const EXTENSION_POR_TIPO: Record<string, string> = {
  'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'image/heic': '.heic', 'image/heif': '.heif', 'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const TIPO_VISIBLE: Record<string, string> = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

function conExtension(a: File): File | null {
  if (/\.(pdf|jpe?g|png|webp|heic|heif|docx?|xlsx?)$/i.test(a.name)) return a;
  const ext = EXTENSION_POR_TIPO[a.type.toLowerCase()];
  return ext ? new File([a], (a.name || 'documento') + ext, { type: a.type }) : null;
}

@Component({
  selector: 'anturi-documentos-titular',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dt">
      <div class="dt__cab">
        <!-- 2026-10-30 (Anyi): que se note de quién es cada documento -->
        <h3 class="seccion-titulo">Documentos{{ titulo ? ' de ' + titulo : '' }}</h3>
        <button type="button" class="boton boton-secundario boton-sm" (click)="creando = !creando">+ Nueva carpeta</button>
      </div>

      <form *ngIf="creando" class="dt__nueva" (ngSubmit)="crearCarpeta()">
        <input class="campo-input" name="nuevaCarpeta" [(ngModel)]="nombreNueva" list="dt-catalogo" placeholder="Nombre de la carpeta (ej. Contrato, RUT...)" autocomplete="off">
        <datalist id="dt-catalogo"><option *ngFor="let n of nombresCatalogo" [value]="n"></option></datalist>
        <button type="submit" class="boton boton-primario boton-sm" [disabled]="nombreNueva.trim().length < 2">Crear</button>
        <small class="sub">Si ya existe con otro nombre parecido (ej. "CC" y "Cédula"), se usa la que ya existe.</small>
      </form>
      <div *ngIf="avisoCarpeta" class="dt__aviso">{{ avisoCarpeta }}</div>

      <input type="file" #selector multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,application/pdf,image/*" style="display:none" (change)="archivosElegidos($event)">
      <input type="file" #selectorReemplazo accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,application/pdf,image/*" style="display:none" (change)="reemplazoElegido($event)">
      <div *ngIf="esAsistente" class="sub">Lo que reemplace o mueva se aplica de una vez y le llega a Anturi para que lo confirme. Eliminar documentos es solo de Anturi.</div>

      <div *ngIf="cargando" class="sub">Cargando documentos...</div>
      <div class="dt__carpetas" *ngIf="!cargando">
        <div *ngFor="let c of carpetasVisibles" class="carpeta" [class.carpeta--falta]="c.obligatoria && docsDe(c).length === 0" [class.carpeta--abierta]="estaAbierta(c)">
          <button type="button" class="carpeta__cab" (click)="alternar(c)" [attr.aria-expanded]="estaAbierta(c)">
            <span class="carpeta__icono">📁</span>
            <span class="carpeta__nombre">{{ c.nombre }}</span>
            <span class="carpeta__cuenta" [class.falta]="c.obligatoria && docsDe(c).length === 0">{{ docsDe(c).length ? docsDe(c).length + ' archivo' + (docsDe(c).length !== 1 ? 's' : '') : (c.obligatoria ? '⚠ Falta' : 'Vacía') }}</span>
            <span class="carpeta__flecha" aria-hidden="true">{{ estaAbierta(c) ? '▾' : '▸' }}</span>
          </button>
          <button type="button" class="boton boton-secundario boton-sm" (click)="elegirArchivos(c, selector)">Subir</button>
          <div *ngIf="estaAbierta(c)" class="carpeta__lista">
            <div *ngIf="!docsDe(c).length" class="sub">Todavía no hay archivos en esta carpeta.</div>
            <div *ngFor="let d of docsDe(c)" class="doc">
              <button type="button" class="doc__nombre" (click)="ver(d)" [title]="'Ver ' + (d.nombre || d.nombreOriginal)">{{ icono(d) }} {{ d.nombre || d.nombreOriginal }}</button>
              <span class="sub">{{ d.creadoEn | date:'dd/MM/yyyy' }}</span>
              <button type="button" class="boton boton-texto boton-sm" (click)="ver(d)" [attr.aria-label]="'Ver ' + (d.nombre || d.nombreOriginal)">👁 Ver</button>
              <button type="button" class="boton boton-texto boton-sm" (click)="descargar(d)" [attr.aria-label]="'Descargar ' + (d.nombre || d.nombreOriginal)">⬇ Descargar</button>
              <select class="campo-input campo-input--sm" (change)="mover(d, $event)" [attr.aria-label]="'Mover ' + d.nombre">
                <option value="" selected disabled>Mover a...</option>
                <option *ngFor="let o of carpetasDestino(c)" [value]="o.clave">{{ o.nombre }}</option>
              </select>
              <button type="button" class="doc__borrar" (click)="pedirReemplazo(d, selectorReemplazo)" title="Reemplazar por otro archivo">🔄</button>
              <button *ngIf="!esAsistente" type="button" class="doc__borrar" (click)="pedirEliminar(d)" title="Eliminar">🗑</button>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="subiendo" class="dt__progreso">Subiendo {{ subiendoN }} de {{ subiendoTotal }}: {{ subiendoNombre }} ({{ progreso }}%)</div>
      <div *ngIf="errores.length" class="dt__error">
        <div *ngFor="let e of errores">{{ e }}</div>
        <button type="button" class="boton boton-texto boton-sm" (click)="errores = []">Cerrar</button>
      </div>
      <div *ngIf="mensaje" class="dt__ok">{{ mensaje }}</div>
    </div>

    <!-- 2026-10-15: por qué se elimina / reemplaza (le llega a Anturi) -->
    <div *ngIf="accion" class="modal-overlay" (click)="accion = null">
      <div class="motivo" (click)="$event.stopPropagation()" role="dialog" aria-labelledby="tituloMotivo">
        <h3 id="tituloMotivo" class="motivo__titulo">{{ accion.tipo === 'eliminar' ? 'Eliminar documento' : 'Reemplazar documento' }}</h3>
        <p class="sub">{{ accion.doc.nombre || accion.doc.nombreOriginal }}{{ accion.archivo ? ' → ' + accion.archivo.name : '' }}</p>
        <ng-container *ngIf="accion.tipo === 'eliminar'">
          <label *ngFor="let m of motivosEliminar" class="motivo__opcion"><input type="radio" name="motivoDoc" [value]="m" [(ngModel)]="accion.opcion"> {{ m }}</label>
        </ng-container>
        <label class="campo-etiqueta" for="motivoTexto">{{ accion.tipo === 'eliminar' ? (accion.opcion === 'Otro motivo' ? 'Escriba el motivo' : 'Nota (opcional)') : 'Nota para Anturi' }}</label>
        <input id="motivoTexto" class="campo-input" [(ngModel)]="accion.texto" [placeholder]="accion.tipo === 'reemplazar' ? 'Ej. la cédula anterior estaba borrosa' : 'Ej. era la cédula de otra persona'">
        <p *ngIf="esAsistente" class="sub">Se aplica de una vez y le llega a Anturi con esta nota y el documento para que lo vea.</p>
        <div class="motivo__acciones">
          <button type="button" class="boton boton-secundario" (click)="accion = null">Cancelar</button>
          <button type="button" class="boton boton-primario" [disabled]="!motivoValido" (click)="confirmarAccion()">{{ accion.tipo === 'eliminar' ? 'Eliminar' : 'Reemplazar' }}</button>
        </div>
      </div>
    </div>

    <div *ngIf="vista" class="modal-overlay" (click)="cerrarVista()">
      <div class="visor" (click)="$event.stopPropagation()">
        <div class="visor__cab"><strong>{{ vista.nombre }}</strong><button type="button" class="boton boton-icono" (click)="cerrarVista()" aria-label="Cerrar">✕</button></div>
        <div class="visor__cuerpo">
          <iframe *ngIf="vista.pdf" [src]="vista.url" title="Documento"></iframe>
          <img *ngIf="!vista.pdf" [src]="vista.url" [alt]="vista.nombre">
        </div>
        <div class="visor__acciones">
          <!-- 2026-10-30 (Cristopher): si el visor no lo muestra (algunos celulares), se abre en otra ventana -->
          <button type="button" class="boton boton-primario boton-sm" (click)="abrirEnVentana()">↗ Abrir en otra ventana</button>
          <a class="boton boton-secundario boton-sm" [href]="vista.crudo" [download]="vista.nombre">⬇ Descargar</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .visor__acciones { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .dt { display: flex; flex-direction: column; gap: 10px; }
    .dt__cab { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .dt__cab .seccion-titulo { margin: 0; }
    .dt__nueva { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .dt__nueva .campo-input { flex: 1; min-width: 220px; }
    .dt__nueva .sub { width: 100%; }
    .dt__aviso { background: #fff7e6; color: #7a4b00; padding: 8px 12px; border-radius: 8px; font-size: 14px; }
    .dt__carpetas { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; align-items: start; }
    .carpeta { border: 1px solid var(--borde-color, #e5e7eb); border-radius: 10px; padding: 8px 10px; display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; background: var(--fondo-tarjeta, #fff); }
    .carpeta--abierta { grid-column: 1 / -1; }
    .carpeta--falta { border-color: #f5c26b; background: #fffaf0; }
    .carpeta__cab { display: flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; text-align: left; padding: 4px 0; min-width: 0; }
    .carpeta__nombre { font-weight: 600; color: var(--texto-principal); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .carpeta__cuenta { font-size: 12px; color: var(--texto-terciario); white-space: nowrap; }
    .carpeta__cuenta.falta { color: #b45309; font-weight: 700; }
    .carpeta__lista { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--borde-color, #e5e7eb); padding-top: 8px; }
    .doc { display: grid; grid-template-columns: 1fr auto auto auto auto auto auto; gap: 8px; align-items: center; }
    .carpeta__flecha { margin-left: 6px; color: var(--texto-terciario); }
    .doc__nombre { background: none; border: none; text-align: left; cursor: pointer; color: var(--color-primario, #1b3270); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0; }
    .doc__nombre:hover { text-decoration: underline; }
    .doc__borrar { background: none; border: 1px solid var(--borde-color, #e5e7eb); border-radius: 8px; cursor: pointer; padding: 4px 8px; }
    .campo-input--sm { padding: 4px 6px; font-size: 13px; max-width: 170px; }
    .sub { font-size: 12px; color: var(--texto-terciario); }
    .dt__progreso { font-size: 14px; color: var(--texto-secundario); }
    .dt__error { background: #fdecea; color: #b42318; padding: 8px 12px; border-radius: 8px; font-size: 14px; }
    .dt__ok { background: #e8f5e9; color: #1b5e20; padding: 8px 12px; border-radius: 8px; font-size: 14px; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .motivo { background: var(--fondo-tarjeta, #fff); border-radius: 14px; width: min(480px, 100%); padding: 18px; display: flex; flex-direction: column; gap: 8px; }
    .motivo__titulo { margin: 0; font-size: 18px; color: var(--texto-principal); }
    .motivo__opcion { display: flex; gap: 8px; align-items: center; font-size: 14px; color: var(--texto-principal); cursor: pointer; }
    .motivo__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
    .visor { background: var(--fondo-tarjeta, #fff); border-radius: 14px; width: min(920px, 100%); max-height: 94vh; display: flex; flex-direction: column; gap: 8px; padding: 12px; }
    .visor__cab { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .visor__cuerpo { flex: 1; min-height: 60vh; display: flex; justify-content: center; }
    .visor__cuerpo iframe { width: 100%; height: 75vh; border: none; }
    .visor__cuerpo img { max-width: 100%; max-height: 75vh; object-fit: contain; }
    .visor .boton { align-self: flex-start; }
    @media (max-width: 600px) { .doc { grid-template-columns: 1fr auto auto; } }
  `],
})
export class DocumentosTitularComponent implements OnChanges, OnDestroy {
  @Input() titularTipo: 'AFILIADO' | 'EMPRESA' | 'PERSONA' | 'FAMILIAR' = 'AFILIADO';
  // 2026-10-30: nombre de quién son los documentos (se muestra en el título)
  @Input() titulo = '';
  @Input() titularId!: number;

  catalogo: CatalogoCarpetas = { fijas: [], propias: [] };
  documentos: Documento[] = [];
  carpetasCreadas: Carpeta[] = [];
  cargando = false;
  // 2026-10-16: las carpetas con archivos se ven abiertas (antes había que
  // tocar la carpeta para ver los archivos y no se notaba)
  private abiertas = new Set<string>();
  private cerradas = new Set<string>();

  estaAbierta(c: Carpeta): boolean {
    if (this.abiertas.has(c.clave)) return true;
    return !this.cerradas.has(c.clave) && this.docsDe(c).length > 0;
  }

  alternar(c: Carpeta): void {
    if (this.estaAbierta(c)) { this.abiertas.delete(c.clave); this.cerradas.add(c.clave); }
    else { this.cerradas.delete(c.clave); this.abiertas.add(c.clave); }
  }

  private abrir(clave: string): void {
    this.cerradas.delete(clave);
    this.abiertas.add(clave);
  }

  // descarga con la sesión (un enlace directo no lleva el inicio de sesión)
  descargar(d: Documento): void {
    this.docs.archivo(d.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = d.nombre || d.nombreOriginal || 'documento';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      },
      error: () => (this.errores = ['No se pudo descargar el documento.']),
    });
  }
  creando = false;
  nombreNueva = '';
  avisoCarpeta = '';
  mensaje = '';
  errores: string[] = [];
  subiendo = false;
  subiendoN = 0;
  subiendoTotal = 0;
  subiendoNombre = '';
  progreso = 0;
  vista: { nombre: string; url: SafeResourceUrl; crudo: string; pdf: boolean } | null = null;
  private destino: Carpeta | null = null;

  // 2026-10-15: eliminar / reemplazar con nota (la Asistente -> le llega a Anturi)
  readonly motivosEliminar = ['No era el documento de la persona', 'Está repetido', 'El archivo está dañado o no se ve', 'Otro motivo'];
  accion: { tipo: 'eliminar' | 'reemplazar'; doc: Documento; archivo?: File; opcion: string; texto: string } | null = null;
  private docAReemplazar: Documento | null = null;
  readonly esAsistente: boolean;

  constructor(private docs: DocumentosServicio, private sanitizer: DomSanitizer, auth: AutenticacionServicio) {
    this.esAsistente = auth.usuarioActual?.rol === 'SECRETARIA';
  }

  get motivoValido(): boolean {
    if (!this.accion) return false;
    if (this.accion.tipo === 'reemplazar') return true;
    if (!this.accion.opcion) return false;
    return this.accion.opcion !== 'Otro motivo' || this.accion.texto.trim().length >= 3;
  }

  pedirEliminar(d: Documento): void {
    this.accion = { tipo: 'eliminar', doc: d, opcion: '', texto: '' };
  }

  pedirReemplazo(d: Documento, selector: HTMLInputElement): void {
    this.docAReemplazar = d;
    selector.value = '';
    selector.click();
  }

  reemplazoElegido(ev: Event): void {
    const elegido = (ev.target as HTMLInputElement).files?.[0];
    if (!elegido || !this.docAReemplazar) return;
    if (elegido.size > 20 * 1024 * 1024) { this.errores = [`"${elegido.name}" pesa más de 20 MB.`]; return; }
    const archivo = conExtension(elegido);
    if (!archivo) { this.errores = [`"${elegido.name}" no se puede subir. Se aceptan PDF, fotos (JPG, PNG, HEIC, WEBP), Word y Excel.`]; return; }
    this.accion = { tipo: 'reemplazar', doc: this.docAReemplazar, archivo, opcion: '', texto: `Se reemplaza por "${archivo.name}"` };
  }

  confirmarAccion(): void {
    const a = this.accion;
    if (!a || !this.motivoValido) return;
    const motivo = a.tipo === 'eliminar'
      ? [a.opcion !== 'Otro motivo' ? a.opcion : '', a.texto.trim()].filter(Boolean).join('. ')
      : a.texto.trim() || `Se reemplaza por "${a.archivo!.name}"`;
    this.accion = null;
    const peticion = a.tipo === 'eliminar' ? this.docs.eliminar(a.doc.id, motivo) : this.docs.reemplazar(a.doc.id, a.archivo!, motivo);
    peticion.subscribe({
      next: () => {
        this.mensaje = (a.tipo === 'eliminar' ? 'Documento eliminado.' : 'Documento reemplazado.') + (this.esAsistente ? ' Le llegó a Anturi para que lo confirme.' : '');
        setTimeout(() => (this.mensaje = ''), 6000);
        this.cargar();
      },
      error: (e) => (this.errores = [e?.status === 413 ? 'El archivo es muy grande.' : e?.error?.message || 'No se pudo completar.']),
    });
  }

  ngOnChanges(): void {
    if (this.titularId) this.cargar();
  }

  ngOnDestroy(): void {
    this.cerrarVista();
  }

  cargar(): void {
    this.cargando = true;
    const lista$ = this.titularTipo === 'EMPRESA' ? this.docs.listarDeEmpresa(this.titularId) : this.titularTipo === 'PERSONA' ? this.docs.listarDePersona(this.titularId) : this.titularTipo === 'FAMILIAR' ? this.docs.listarDeFamiliar(this.titularId) : this.docs.listarDeAfiliado(this.titularId);
    forkJoin({
      catalogo: this.docs.carpetas().pipe(catchError(() => of({ fijas: [], propias: [] } as CatalogoCarpetas))),
      documentos: lista$.pipe(catchError(() => of([] as Documento[]))),
    }).subscribe(({ catalogo, documentos }) => {
      this.catalogo = catalogo;
      this.documentos = documentos;
      this.cargando = false;
    });
  }

  get nombresCatalogo(): string[] {
    return [...this.catalogo.fijas.map((f) => f.nombre), ...this.catalogo.propias.map((p) => p.nombre)];
  }

  // Afiliados: siempre las carpetas fijas (la cédula es obligatoria). Empresas:
  // solo las que tienen archivos o se acaban de crear. Más las propias usadas.
  get carpetasVisibles(): Carpeta[] {
    const lista: Carpeta[] = [];
    const ya = new Set<string>();
    const poner = (c: Carpeta) => { if (!ya.has(c.clave)) { ya.add(c.clave); lista.push(c); } };
    for (const f of this.catalogo.fijas) {
      const c: Carpeta = { clave: 'tipo:' + f.tipo, nombre: f.nombre, tipo: f.tipo, carpetaId: null, obligatoria: (this.titularTipo === 'AFILIADO' || this.titularTipo === 'PERSONA') && f.tipo === 'CEDULA' };
      if (this.titularTipo !== 'EMPRESA' || this.docsDe(c).length) poner(c);
    }
    for (const d of this.documentos) if (d.carpeta) poner({ clave: 'c:' + d.carpeta.id, nombre: d.carpeta.nombre, tipo: 'OTRO', carpetaId: d.carpeta.id, obligatoria: false });
    for (const c of this.carpetasCreadas) poner(c);
    poner({ clave: 'otros', nombre: 'Otros (sin clasificar)', tipo: 'OTRO', carpetaId: null, obligatoria: false });
    return lista;
  }

  docsDe(c: Carpeta): Documento[] {
    if (c.carpetaId) return this.documentos.filter((d) => d.carpetaId === c.carpetaId || d.carpeta?.id === c.carpetaId);
    if (c.clave === 'otros') return this.documentos.filter((d) => d.tipo === 'OTRO' && !d.carpetaId && !d.carpeta);
    return this.documentos.filter((d) => d.tipo === c.tipo && !d.carpetaId && !d.carpeta);
  }

  carpetasDestino(actual: Carpeta): Carpeta[] {
    const todas: Carpeta[] = [
      ...this.catalogo.fijas.map((f) => ({ clave: 'tipo:' + f.tipo, nombre: f.nombre, tipo: f.tipo, carpetaId: null, obligatoria: false })),
      ...this.catalogo.propias.map((p) => ({ clave: 'c:' + p.id, nombre: p.nombre, tipo: 'OTRO', carpetaId: p.id, obligatoria: false })),
    ];
    return todas.filter((c) => c.clave !== actual.clave);
  }

  crearCarpeta(): void {
    const nombre = this.nombreNueva.trim();
    if (nombre.length < 2) return;
    this.docs.crearCarpeta(nombre).subscribe({
      next: (r) => {
        const c: Carpeta = r.fija
          ? { clave: 'tipo:' + r.tipo, nombre: r.nombre, tipo: r.tipo as string, carpetaId: null, obligatoria: false }
          : { clave: 'c:' + r.carpeta!.id, nombre: r.nombre, tipo: 'OTRO', carpetaId: r.carpeta!.id, obligatoria: false };
        if (!r.fija && !this.catalogo.propias.some((p) => p.id === r.carpeta!.id)) this.catalogo.propias = [...this.catalogo.propias, { id: r.carpeta!.id, nombre: r.nombre, clave: '' }];
        if (!this.carpetasCreadas.some((x) => x.clave === c.clave)) this.carpetasCreadas = [...this.carpetasCreadas, c];
        this.avisoCarpeta = r.existia ? `Ya existía la carpeta "${r.nombre}": se usa esa (así no quedan carpetas repetidas).` : `Carpeta "${r.nombre}" creada.`;
        this.abrir(c.clave);
        this.nombreNueva = '';
        this.creando = false;
        setTimeout(() => (this.avisoCarpeta = ''), 6000);
      },
      error: (e) => (this.errores = [e?.error?.message || 'No se pudo crear la carpeta.']),
    });
  }

  elegirArchivos(c: Carpeta, selector: HTMLInputElement): void {
    this.destino = c;
    selector.value = '';
    selector.click();
  }

  async archivosElegidos(ev: Event): Promise<void> {
    const archivos = Array.from((ev.target as HTMLInputElement).files ?? []);
    if (!archivos.length || !this.destino) return;
    const destino = this.destino;
    this.errores = [];
    this.subiendo = true;
    this.subiendoTotal = archivos.length;
    let bien = 0;
    for (let i = 0; i < archivos.length; i++) {
      const elegido = archivos[i];
      this.subiendoN = i + 1;
      this.subiendoNombre = elegido.name;
      this.progreso = 0;
      if (elegido.size > 20 * 1024 * 1024) { this.errores.push(`"${elegido.name}" pesa más de 20 MB.`); continue; }
      const a = conExtension(elegido);
      if (!a) { this.errores.push(`"${elegido.name}" no se puede subir. Se aceptan PDF, fotos (JPG, PNG, HEIC, WEBP), Word y Excel.`); continue; }
      const ok = await new Promise<boolean>((resolve) => {
        this.docs.subirA({
          ...(this.titularTipo === 'EMPRESA' ? { empresaId: this.titularId } : this.titularTipo === 'PERSONA' ? { personaId: this.titularId } : this.titularTipo === 'FAMILIAR' ? { familiarId: this.titularId } : { afiliadoId: this.titularId }),
          tipo: destino.carpetaId ? 'OTRO' : destino.tipo,
          carpetaId: destino.carpetaId,
        }, a).subscribe({
          next: (e) => {
            if (e.type === HttpEventType.UploadProgress && e.total) this.progreso = Math.round((100 * e.loaded) / e.total);
            if (e.type === HttpEventType.Response) resolve(true);
          },
          error: (err) => {
            const m = err?.status === 413 ? 'el archivo es muy grande' : err?.error?.message || 'error al subir';
            this.errores.push(`"${a.name}": ${Array.isArray(m) ? m.join('. ') : m}`);
            resolve(false);
          },
        });
      });
      if (ok) bien++;
    }
    this.subiendo = false;
    if (bien) {
      this.mensaje = `${bien} archivo${bien !== 1 ? 's' : ''} subido${bien !== 1 ? 's' : ''} a "${destino.nombre}".`;
      setTimeout(() => (this.mensaje = ''), 5000);
      this.abrir(destino.clave);
      this.cargar();
    }
  }

  mover(d: Documento, ev: Event): void {
    const clave = (ev.target as HTMLSelectElement).value;
    const c = this.carpetasDestino({ clave: '', nombre: '', tipo: '', carpetaId: null, obligatoria: false }).find((x) => x.clave === clave);
    if (!c) return;
    this.docs.mover(d.id, c.carpetaId ? { carpetaId: c.carpetaId } : { tipo: c.tipo }).subscribe({
      next: () => { this.mensaje = `Movido a "${c.nombre}".` + (this.esAsistente ? ' Le llegó a Anturi para que lo confirme.' : ''); setTimeout(() => (this.mensaje = ''), 4000); this.cargar(); },
      error: (e) => (this.errores = [e?.error?.message || 'No se pudo mover.']),
    });
  }

  eliminar(d: Documento): void {
    if (!confirm(`¿Eliminar "${d.nombre || d.nombreOriginal}"?`)) return;
    this.docs.eliminar(d.id).subscribe({
      next: () => (this.documentos = this.documentos.filter((x) => x.id !== d.id)),
      error: (e) => (this.errores = [e?.status === 403 ? 'Su usuario no tiene permiso para eliminar documentos.' : e?.error?.message || 'No se pudo eliminar.']),
    });
  }

  esPdf(d: Documento): boolean {
    return this.docs.esPdf(d.extension);
  }

  // 2026-10-22: tipos que el navegador puede mostrar; el resto (Word, Excel,
  // fotos HEIC) se descarga al tocar "Ver"
  private ext(d: Documento): string {
    return String(d.extension || (d.nombreOriginal ?? '').replace(/^.*(\.[^.]+)$/, '$1') || '').toLowerCase();
  }

  icono(d: Documento): string {
    const e = this.ext(d);
    if (e === '.pdf') return '📄';
    if (['.doc', '.docx'].includes(e)) return '📝';
    if (['.xls', '.xlsx'].includes(e)) return '📊';
    return '🖼️';
  }

  private sePuedeVer(d: Documento): boolean {
    return ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(this.ext(d));
  }

  ver(d: Documento): void {
    if (!this.sePuedeVer(d)) { this.descargar(d); return; }
    this.docs.archivo(d.id).subscribe({
      next: (recibido) => {
        this.cerrarVista();
        // 2026-10-30: si llega como "archivo desconocido" (se guardó sin
        // terminación), el navegador no lo muestra - se le dice qué es.
        const tipo = TIPO_VISIBLE[this.ext(d)];
        const blob = tipo && recibido.type !== tipo ? new Blob([recibido], { type: tipo }) : recibido;
        const crudo = URL.createObjectURL(blob);
        this.vista = { nombre: d.nombre || d.nombreOriginal, crudo, url: this.sanitizer.bypassSecurityTrustResourceUrl(crudo), pdf: this.esPdf(d) };
      },
      error: (e) => (this.errores = [this.mensajeAbrir(e)]),
    });
  }

  abrirEnVentana(): void {
    if (!this.vista) return;
    const w = window.open(this.vista.crudo, '_blank');
    if (!w) this.errores = ['El navegador bloqueó la ventana nueva. Use "Descargar".'];
  }

  private mensajeAbrir(e: any): string {
    return e?.status === 404 ? 'Ese archivo no está en el servidor. Súbalo de nuevo, por favor.' : 'No se pudo abrir el documento. Intente de nuevo.';
  }

  cerrarVista(): void {
    if (this.vista) URL.revokeObjectURL(this.vista.crudo);
    this.vista = null;
  }
}
