import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { catchError, finalize, of } from 'rxjs';
import { entorno } from '../../../environments/entorno';

interface Recibo {
  id: number; numero: string; fecha: string; ciudad: string; valor: number | string; canceladoA: string;
  concepto: string; pagadorNombre: string; pagadorDocumento: string | null; codigo: string | null;
  aprobadoPor: string | null; anulado: boolean; motivoAnulacion: string | null; valorEnLetras: string;
}
interface Pagador { nombre: string; documento: string | null; recibos: number }
interface FormRecibo {
  periodo: string; fecha: string; valor: number | null; concepto: string; pagadorNombre: string;
  pagadorDocumento: string; ciudad: string; canceladoA: string; codigo: string; aprobadoPor: string;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// 2026-10-09 (pedido de Cristopher): RECIBOS DE CAJA MENOR en la página
// (antes un Excel con una hoja por mes). Todos los roles. El número sale solo
// (AAAAMM del mes que se paga + consecutivo), la suma en letras también, y el
// recibo se imprime con el mismo formato del Excel. No se borran: se anulan.
@Component({
  selector: 'anturi-caja-menor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="caja">
      <div class="caja__encabezado">
        <div>
          <h2 class="pagina-titulo">Caja menor</h2>
          <p class="caja__ayuda">Recibos de caja menor. El número y la suma en letras salen solos.</p>
        </div>
        <button type="button" class="boton boton-primario" (click)="nuevo()">+ Nuevo recibo</button>
      </div>

      <div class="tarjeta caja__filtros">
        <select class="campo-input" [(ngModel)]="anio" (ngModelChange)="cargar()" aria-label="Año">
          <option *ngFor="let a of anios" [ngValue]="a">{{ a }}</option>
        </select>
        <select class="campo-input" [(ngModel)]="mes" (ngModelChange)="cargar()" aria-label="Mes">
          <option [ngValue]="0">Todo el año</option>
          <option *ngFor="let m of meses; let i = index" [ngValue]="i + 1">{{ m }}</option>
        </select>
        <input type="search" class="campo-input caja__buscar" placeholder="Buscar por nombre, cédula, concepto o número" [(ngModel)]="buscar" (ngModelChange)="buscarConPausa()">
        <div class="caja__total" *ngIf="!cargando">
          <span>{{ cantidad }} recibo{{ cantidad !== 1 ? 's' : '' }}</span>
          <strong>{{ total | currency:'COP':'symbol-narrow':'1.0-0' }}</strong>
        </div>
      </div>

      <div *ngIf="mensaje" class="alerta-exito">{{ mensaje }}</div>
      <div *ngIf="error" class="alerta-error">{{ error }}</div>
      <div *ngIf="cargando" class="estado">Cargando...</div>

      <div class="tarjeta tabla-contenedor" *ngIf="!cargando">
        <div *ngIf="recibos.length === 0" class="estado">No hay recibos en este periodo.</div>
        <table class="tabla" *ngIf="recibos.length > 0">
          <thead>
            <tr><th>N°</th><th>Fecha</th><th>Pagó</th><th>Concepto</th><th class="num">Valor</th><th></th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of recibos" [class.anulado]="r.anulado">
              <td class="mono">{{ r.numero }}</td>
              <td>{{ r.fecha | date:'dd/MM/yyyy':'UTC' }}</td>
              <td>{{ r.pagadorNombre }}<div class="sub" *ngIf="r.pagadorDocumento">CC {{ r.pagadorDocumento }}</div></td>
              <td>{{ r.concepto }}<div class="sub" *ngIf="r.anulado">ANULADO: {{ r.motivoAnulacion }}</div></td>
              <td class="num">{{ +r.valor | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
              <td class="acciones">
                <button type="button" class="boton boton-texto boton-sm" (click)="abrirRecibo(r)">Ver y compartir</button>
                <button *ngIf="!r.anulado" type="button" class="boton boton-texto boton-sm" (click)="editar(r)">Editar</button>
                <button *ngIf="!r.anulado" type="button" class="boton boton-texto boton-sm peligro" (click)="anular(r)">Anular</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 2026-10-09: el recibo (PDF media carta con el logo de Anturi) y cómo compartirlo -->
    <div *ngIf="recibo" class="modal-overlay" (click)="cerrarRecibo()">
      <div class="modal-contenido visor" (click)="$event.stopPropagation()" role="dialog" aria-labelledby="tituloVisor">
        <div class="visor__cab">
          <h3 id="tituloVisor" class="modal-titulo">Recibo de caja menor N.º {{ recibo.numero }}</h3>
          <button type="button" class="boton boton-icono" (click)="cerrarRecibo()" aria-label="Cerrar">✕</button>
        </div>
        <div class="visor__hoja">
          <div *ngIf="cargandoPdf" class="estado">Preparando el recibo...</div>
          <iframe *ngIf="urlSegura && !esCelular" [src]="urlSegura" title="Vista previa del recibo"></iframe>
          <div *ngIf="urlSegura && esCelular" class="visor__celular">
            <b>{{ recibo.pagadorNombre }}</b>
            <span>{{ +recibo.valor | currency:'COP':'symbol-narrow':'1.0-0' }} · {{ recibo.concepto }}</span>
            <small>Toque "Descargar" para ver el recibo completo.</small>
          </div>
        </div>
        <div *ngIf="recibo.anulado" class="alerta-error">Este recibo está anulado: se puede ver y descargar, pero no enviar.</div>
        <div class="visor__acciones">
          <button type="button" class="boton boton-secundario" [disabled]="!pdf" (click)="descargar()">⬇ Descargar</button>
          <button type="button" class="boton boton-secundario" [disabled]="!pdf" (click)="imprimirPdf()">🖨 Imprimir</button>
          <button type="button" class="boton boton-secundario" [disabled]="!pdf || recibo.anulado" (click)="modoCorreo = !modoCorreo">✉ Enviar por correo</button>
          <button type="button" class="boton boton-primario whatsapp" [disabled]="!pdf || recibo.anulado" (click)="compartirWhatsapp()">WhatsApp</button>
        </div>
        <button *ngIf="intentoWhatsapp" type="button" class="boton boton-texto boton-sm visor__alterno" (click)="whatsappWeb()">¿No aparece WhatsApp? Descargar el recibo y abrir WhatsApp Web</button>
        <form *ngIf="modoCorreo" class="visor__correo" (ngSubmit)="enviarCorreo()">
          <label class="campo-etiqueta" for="correoRecibo">¿A qué correo se envía?</label>
          <div class="visor__correo-fila">
            <input id="correoRecibo" name="correoRecibo" type="email" class="campo-input" [(ngModel)]="correoDestino" placeholder="cliente@correo.com" autocomplete="email" required>
            <button type="submit" class="boton boton-primario" [disabled]="enviando || !correoValido">{{ enviando ? 'Enviando...' : 'Enviar' }}</button>
          </div>
          <small class="sub">Llega desde el correo de Anturi Multiservicios, con el recibo en PDF.</small>
        </form>
        <div *ngIf="mensajeVisor" class="alerta-exito">{{ mensajeVisor }}</div>
        <div *ngIf="errorVisor" class="alerta-error">{{ errorVisor }}</div>
      </div>
    </div>

    <!-- Formulario -->
    <div *ngIf="modal" class="modal-overlay" (click)="modal = false">
      <div class="modal-contenido caja__modal" (click)="$event.stopPropagation()" role="dialog" aria-labelledby="tituloRecibo">
        <h3 id="tituloRecibo" class="modal-titulo">{{ editando ? 'Editar recibo N° ' + editando.numero : 'Nuevo recibo de caja menor' }}</h3>
        <div class="rejilla">
          <div class="campo-grupo" *ngIf="!editando">
            <label class="campo-etiqueta" for="crPeriodo">Mes que se paga</label>
            <input id="crPeriodo" type="month" class="campo-input" [(ngModel)]="form.periodo" (ngModelChange)="verNumero()">
            <small class="sub">Número: <strong>{{ numeroSiguiente || '...' }}</strong></small>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="crFecha">Fecha del recibo</label>
            <input id="crFecha" type="date" class="campo-input" [(ngModel)]="form.fecha">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="crValor">Valor</label>
            <input id="crValor" type="number" min="1" class="campo-input" [(ngModel)]="form.valor">
            <small class="sub" *ngIf="form.valor">{{ form.valor | currency:'COP':'symbol-narrow':'1.0-0' }}</small>
          </div>
          <div class="campo-grupo ancho">
            <label class="campo-etiqueta" for="crPagador">Recibido de (nombre)</label>
            <input id="crPagador" type="text" class="campo-input" list="lista-pagadores" [(ngModel)]="form.pagadorNombre" (ngModelChange)="completarDocumento()">
            <datalist id="lista-pagadores"><option *ngFor="let p of pagadores" [value]="p.nombre"></option></datalist>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="crDoc">Cédula o NIT</label>
            <input id="crDoc" type="text" class="campo-input" [(ngModel)]="form.pagadorDocumento">
          </div>
          <div class="campo-grupo ancho">
            <label class="campo-etiqueta" for="crConcepto">Concepto</label>
            <input id="crConcepto" type="text" class="campo-input" [(ngModel)]="form.concepto" placeholder="Ej. Pago periodo Octubre 2026">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="crCiudad">Ciudad</label>
            <input id="crCiudad" type="text" class="campo-input" [(ngModel)]="form.ciudad">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="crCancelado">Cancelado a</label>
            <input id="crCancelado" type="text" class="campo-input" [(ngModel)]="form.canceladoA">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="crCodigo">Código (opcional)</label>
            <input id="crCodigo" type="text" class="campo-input" [(ngModel)]="form.codigo">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="crAprobado">Aprobado por (opcional)</label>
            <input id="crAprobado" type="text" class="campo-input" [(ngModel)]="form.aprobadoPor">
          </div>
        </div>
        <div *ngIf="errorForm" class="alerta-error">{{ errorForm }}</div>
        <div class="modal-acciones">
          <button type="button" class="boton boton-secundario" (click)="modal = false">Cancelar</button>
          <button type="button" class="boton boton-primario" [disabled]="guardando || !valido" (click)="guardar()">{{ guardando ? 'Guardando...' : (editando ? 'Guardar cambios' : 'Crear recibo') }}</button>
        </div>
      </div>
    </div>

  `,
  styles: [`
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: var(--espacio-4); }
    .modal-contenido { background: var(--fondo-tarjeta, #fff); border-radius: var(--radio-xl, 14px); width: 100%; max-width: 520px; padding: var(--espacio-5, 20px); box-shadow: var(--sombra-md, 0 10px 30px rgba(0,0,0,.2)); max-height: 92vh; overflow-y: auto; }
    .modal-titulo { font-size: var(--tamano-xl); font-weight: 700; color: var(--texto-principal); margin: 0 0 var(--espacio-3); }
    .modal-acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); margin-top: var(--espacio-4); }
    .caja { display: flex; flex-direction: column; gap: var(--espacio-4); min-width: 0; }
    .caja__encabezado { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--espacio-3); flex-wrap: wrap; }
    .pagina-titulo { margin: 0; font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); }
    .caja__ayuda { margin: 4px 0 0; color: var(--texto-secundario); font-size: var(--tamano-sm); }
    .caja__filtros { display: flex; gap: var(--espacio-3); align-items: center; flex-wrap: wrap; padding: var(--espacio-3); }
    .caja__filtros select { width: auto; }
    .caja__buscar { flex: 1; min-width: 220px; }
    .caja__total { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .caja__total strong { font-size: var(--tamano-lg); color: var(--texto-principal); }
    .num { text-align: right; white-space: nowrap; }
    .mono { font-family: monospace; }
    .sub { display: block; font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .acciones { white-space: nowrap; }
    .peligro { color: var(--color-error, #dc2626); }
    tr.anulado td { text-decoration: line-through; color: var(--texto-terciario); }
    tr.anulado td .sub { text-decoration: none; }
    .estado { padding: var(--espacio-4); color: var(--texto-terciario); }
    .caja__modal { max-width: 720px; width: 100%; }
    .visor { max-width: 760px; width: 100%; display: flex; flex-direction: column; gap: var(--espacio-3); }
    .visor__cab { display: flex; justify-content: space-between; align-items: center; }
    .visor__cab .modal-titulo { margin: 0; }
    .visor__hoja { background: #e9edf3; border-radius: var(--radio-md); padding: 10px; }
    .visor__hoja iframe { width: 100%; aspect-ratio: 612 / 396; border: none; background: #fff; border-radius: 6px; display: block; }
    .visor__celular { display: flex; flex-direction: column; gap: 4px; padding: 18px; background: #fff; border-radius: 6px; text-align: center; color: var(--texto-principal); }
    .visor__acciones { display: flex; gap: var(--espacio-2); flex-wrap: wrap; }
    .visor__acciones .boton { flex: 1; min-width: 140px; }
    .visor__alterno { align-self: flex-start; }
    .whatsapp { background: #1fa855 !important; border-color: #1fa855 !important; }
    .visor__correo { display: flex; flex-direction: column; gap: 6px; }
    .visor__correo-fila { display: flex; gap: var(--espacio-2); }
    .visor__correo-fila input { flex: 1; }
    .rejilla { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--espacio-3); margin: var(--espacio-3) 0; }
    .rejilla .ancho { grid-column: span 2; }
    @media (max-width: 700px) { .rejilla { grid-template-columns: 1fr; } .rejilla .ancho { grid-column: auto; } }
  `],
})
export class CajaMenorComponent implements OnInit, OnDestroy {
  private readonly URL = `${entorno.urlApi}/caja-menor`;
  meses = MESES;
  anios: number[] = [];
  anio = new Date().getFullYear();
  mes = 0;
  buscar = '';
  recibos: Recibo[] = [];
  total = 0;
  cantidad = 0;
  pagadores: Pagador[] = [];
  cargando = false;
  error = '';
  mensaje = '';
  modal = false;
  editando: Recibo | null = null;
  form: FormRecibo = this.formVacio();
  numeroSiguiente = '';
  guardando = false;
  errorForm = '';
  private pausa?: ReturnType<typeof setTimeout>;
  // visor del recibo
  recibo: Recibo | null = null;
  pdf: Blob | null = null;
  private urlPdf = '';
  urlSegura: SafeResourceUrl | null = null;
  cargandoPdf = false;
  modoCorreo = false;
  correoDestino = '';
  enviando = false;
  mensajeVisor = '';
  errorVisor = '';
  intentoWhatsapp = false;
  readonly esCelular = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {
    const actual = new Date().getFullYear();
    for (let a = actual + 1; a >= 2025; a--) this.anios.push(a);
  }

  ngOnInit(): void {
    this.cargar();
    this.http.get<Pagador[]>(`${this.URL}/pagadores`).pipe(catchError(() => of([] as Pagador[]))).subscribe((p) => (this.pagadores = p));
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    const q: Record<string, string> = { anio: String(this.anio) };
    if (this.mes) q['mes'] = String(this.mes);
    if (this.buscar.trim()) q['buscar'] = this.buscar.trim();
    this.http.get<{ recibos: Recibo[]; total: number; cantidad: number }>(this.URL, { params: q }).pipe(
      catchError(() => { this.error = 'No se pudieron cargar los recibos.'; return of(null); }),
      finalize(() => (this.cargando = false)),
    ).subscribe((r) => {
      if (!r) return;
      this.recibos = r.recibos;
      this.total = r.total;
      this.cantidad = r.cantidad;
    });
  }

  buscarConPausa(): void {
    if (this.pausa) clearTimeout(this.pausa);
    this.pausa = setTimeout(() => this.cargar(), 350);
  }

  private formVacio(): FormRecibo {
    // por defecto se paga el mes anterior (el recibo de enero se hace en febrero)
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    const periodo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
      periodo, fecha: hoyIso(), valor: null, concepto: `Pago periodo ${MESES[d.getMonth()]} ${d.getFullYear()}`,
      pagadorNombre: '', pagadorDocumento: '', ciudad: 'Quimbaya Quindío', canceladoA: 'Anturimultiservicios', codigo: '', aprobadoPor: '',
    };
  }

  get valido(): boolean {
    return !!this.form.fecha && !!this.form.valor && this.form.valor > 0 && this.form.concepto.trim().length >= 3 && this.form.pagadorNombre.trim().length >= 3;
  }

  nuevo(): void {
    this.editando = null;
    this.form = this.formVacio();
    this.errorForm = '';
    this.modal = true;
    this.verNumero();
  }

  verNumero(): void {
    this.numeroSiguiente = '';
    if (!/^\d{4}-\d{2}$/.test(this.form.periodo)) return;
    const [a, m] = this.form.periodo.split('-').map(Number);
    if (!this.editando) this.form.concepto = `Pago periodo ${MESES[m - 1]} ${a}`;
    this.http.get<{ numero: string }>(`${this.URL}/siguiente-numero`, { params: { periodo: this.form.periodo } })
      .pipe(catchError(() => of(null))).subscribe((r) => (this.numeroSiguiente = r?.numero ?? ''));
  }

  completarDocumento(): void {
    const p = this.pagadores.find((x) => x.nombre === this.form.pagadorNombre.trim().toUpperCase());
    if (p?.documento && !this.form.pagadorDocumento) this.form.pagadorDocumento = p.documento;
  }

  editar(r: Recibo): void {
    this.editando = r;
    this.errorForm = '';
    this.form = {
      periodo: '', fecha: String(r.fecha).slice(0, 10), valor: Number(r.valor), concepto: r.concepto,
      pagadorNombre: r.pagadorNombre, pagadorDocumento: r.pagadorDocumento ?? '', ciudad: r.ciudad, canceladoA: r.canceladoA,
      codigo: r.codigo ?? '', aprobadoPor: r.aprobadoPor ?? '',
    };
    this.modal = true;
  }

  guardar(): void {
    if (!this.valido) return;
    this.guardando = true;
    this.errorForm = '';
    const { periodo, ...resto } = this.form;
    const cuerpo = { ...resto, valor: Number(this.form.valor) };
    const peticion = this.editando
      ? this.http.patch<Recibo>(`${this.URL}/${this.editando.id}`, cuerpo)
      : this.http.post<Recibo>(this.URL, { ...cuerpo, periodo });
    peticion.pipe(finalize(() => (this.guardando = false))).subscribe({
      next: (r) => {
        this.modal = false;
        const nuevo = !this.editando;
        this.avisar(nuevo ? `Recibo N° ${r.numero} creado.` : `Recibo N° ${r.numero} actualizado.`);
        this.cargar();
        if (nuevo) this.abrirRecibo(r); // listo para descargar o compartir
      },
      error: (e) => (this.errorForm = e?.error?.message ? [].concat(e.error.message).join('. ') : 'No se pudo guardar.'),
    });
  }

  anular(r: Recibo): void {
    const motivo = prompt(`¿Por qué se anula el recibo N° ${r.numero}?`);
    if (!motivo || motivo.trim().length < 3) return;
    this.http.patch<Recibo>(`${this.URL}/${r.id}/anular`, { motivo: motivo.trim() }).pipe(
      catchError((e) => { this.error = e?.error?.message || 'No se pudo anular.'; return of(null); }),
    ).subscribe((x) => { if (x) { this.avisar(`Recibo N° ${x.numero} anulado.`); this.cargar(); } });
  }

  ngOnDestroy(): void {
    this.soltarPdf();
  }

  // ── Ver, descargar, imprimir y compartir el recibo (PDF del servidor) ──
  abrirRecibo(r: Recibo): void {
    this.soltarPdf();
    this.recibo = r;
    this.modoCorreo = false;
    this.intentoWhatsapp = false;
    this.correoDestino = '';
    this.mensajeVisor = '';
    this.errorVisor = '';
    this.cargandoPdf = true;
    this.http.get(`${this.URL}/${r.id}/pdf`, { responseType: 'blob' }).pipe(finalize(() => (this.cargandoPdf = false))).subscribe({
      next: (b) => {
        this.pdf = b;
        this.urlPdf = URL.createObjectURL(b);
        this.urlSegura = this.sanitizer.bypassSecurityTrustResourceUrl(this.urlPdf + '#toolbar=0&navpanes=0&view=FitH');
      },
      error: () => (this.errorVisor = 'No se pudo preparar el recibo. Revise la conexión e intente de nuevo.'),
    });
  }

  cerrarRecibo(): void {
    this.recibo = null;
    this.soltarPdf();
  }

  private soltarPdf(): void {
    if (this.urlPdf) URL.revokeObjectURL(this.urlPdf);
    this.urlPdf = '';
    this.urlSegura = null;
    this.pdf = null;
  }

  private get nombreArchivo(): string {
    return `Recibo-caja-menor-${this.recibo?.numero ?? ''}.pdf`;
  }

  descargar(): void {
    if (!this.urlPdf) return;
    const a = document.createElement('a');
    a.href = this.urlPdf;
    a.download = this.nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  imprimirPdf(): void {
    if (!this.urlPdf) return;
    if (this.esCelular) { window.open(this.urlPdf, '_blank'); return; }
    const marco = document.createElement('iframe');
    marco.style.position = 'fixed';
    marco.style.width = '0';
    marco.style.height = '0';
    marco.style.border = '0';
    marco.src = this.urlPdf;
    marco.onload = () => {
      try { marco.contentWindow?.focus(); marco.contentWindow?.print(); } catch { window.open(this.urlPdf, '_blank'); }
      setTimeout(() => marco.remove(), 60_000);
    };
    document.body.appendChild(marco);
  }

  get correoValido(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.correoDestino.trim());
  }

  enviarCorreo(): void {
    if (!this.recibo || !this.correoValido) return;
    this.enviando = true;
    this.errorVisor = '';
    this.mensajeVisor = '';
    this.http.post<{ correo: string }>(`${this.URL}/${this.recibo.id}/enviar`, { correo: this.correoDestino.trim() })
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: (r) => { this.mensajeVisor = `Listo: el recibo se envió a ${r.correo}.`; this.modoCorreo = false; },
        error: (e) => (this.errorVisor = e?.error?.message ? [].concat(e.error.message).join('. ') : 'No se pudo enviar el correo.'),
      });
  }

  // WhatsApp: en celular, tablet y PC con WhatsApp instalado se abre el menú de
  // compartir del equipo con el PDF adjunto (solo se elige el contacto). Si el
  // navegador no lo permite, se descarga el PDF y se abre WhatsApp para adjuntarlo.
  async compartirWhatsapp(): Promise<void> {
    if (!this.pdf || !this.recibo) return;
    const r = this.recibo;
    const texto = `Recibo de caja menor N.º ${r.numero} de Anturi Multiservicios por ${'$' + Math.round(+r.valor).toLocaleString('es-CO')} (${r.concepto}).`;
    const archivo = new File([this.pdf], this.nombreArchivo, { type: 'application/pdf' });
    this.intentoWhatsapp = true;
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.share && nav.canShare?.({ files: [archivo] })) {
      try {
        await nav.share({ files: [archivo], title: `Recibo N.º ${r.numero}`, text: texto });
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return; // la persona cerró el menú
      }
    }
    this.whatsappWeb();
  }

  whatsappWeb(): void {
    if (!this.recibo) return;
    const r = this.recibo;
    const texto = `Recibo de caja menor N.º ${r.numero} de Anturi Multiservicios por ${'$' + Math.round(+r.valor).toLocaleString('es-CO')} (${r.concepto}). Le adjunto el recibo en PDF.`;
    this.descargar();
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
    this.mensajeVisor = 'Se descargó el recibo y se abrió WhatsApp: elija el contacto y adjunte el PDF descargado.';
  }

  private avisar(m: string): void {
    this.mensaje = m;
    setTimeout(() => (this.mensaje = ''), 4000);
  }
}
