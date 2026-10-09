import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';
import { entorno } from '../../../environments/entorno';
import { esc, fechaCorta, imprimirHtml, pesos } from '../imprimir';

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
                <button type="button" class="boton boton-texto boton-sm" (click)="imprimir(r)">Imprimir</button>
                <button *ngIf="!r.anulado" type="button" class="boton boton-texto boton-sm" (click)="editar(r)">Editar</button>
                <button *ngIf="!r.anulado" type="button" class="boton boton-texto boton-sm peligro" (click)="anular(r)">Anular</button>
              </td>
            </tr>
          </tbody>
        </table>
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
    .rejilla { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--espacio-3); margin: var(--espacio-3) 0; }
    .rejilla .ancho { grid-column: span 2; }
    @media (max-width: 700px) { .rejilla { grid-template-columns: 1fr; } .rejilla .ancho { grid-column: auto; } }
  `],
})
export class CajaMenorComponent implements OnInit {
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

  constructor(private http: HttpClient) {
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
        this.avisar(this.editando ? `Recibo N° ${r.numero} actualizado.` : `Recibo N° ${r.numero} creado.`);
        this.cargar();
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

  // Mismo formato del Excel "RECIBOS DE CAJA MENOR".
  imprimir(r: Recibo): void {
    const cuerpo = `
      <div class="recibo">
        <div class="cab"><strong>RECIBO DE CAJA MENOR</strong><span>No. <strong>${esc(r.numero)}</strong></span></div>
        <div class="fila"><span><span class="et">Ciudad:</span> ${esc(r.ciudad)}</span><span><span class="et">Fecha:</span> ${fechaCorta(r.fecha)}</span><span class="valor">${pesos(r.valor)}</span></div>
        <div class="fila"><span><span class="et">Cancelado a:</span> ${esc(r.canceladoA)} — Cra 7 #15-24 Oficina 114</span></div>
        <div class="fila"><span><span class="et">Concepto:</span> ${esc(r.concepto)}</span></div>
        <div class="fila"><span><span class="et">Recibido de:</span> ${esc(r.pagadorNombre)}${r.pagadorDocumento ? ' — CC # ' + esc(r.pagadorDocumento) : ''}</span></div>
        <div class="fila"><span><span class="et">La suma de:</span> ${esc(r.valorEnLetras)}</span></div>
        <div class="firmas"><span><span class="et">Código:</span> ${esc(r.codigo)}</span><span><span class="et">Aprobado:</span> ${esc(r.aprobadoPor)}</span><span class="firma">Firma y sello<br><span class="et">C.C. o NIT</span></span></div>
        ${r.anulado ? '<div class="anulado">ANULADO</div>' : ''}
      </div>`;
    const css = `
      .recibo { border: 2px solid #000; padding: 18px; max-width: 760px; position: relative; }
      .cab { display: flex; justify-content: space-between; font-size: 18px; border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
      .fila { display: flex; gap: 24px; padding: 7px 0; border-bottom: 1px dotted #999; font-size: 14px; }
      .valor { margin-left: auto; font-size: 18px; font-weight: 700; border: 1px solid #000; padding: 2px 10px; }
      .firmas { display: flex; justify-content: space-between; margin-top: 48px; font-size: 13px; }
      .firma { border-top: 1px solid #000; padding-top: 4px; min-width: 200px; text-align: center; }
      .anulado { position: absolute; top: 35%; left: 25%; font-size: 64px; color: rgba(220,38,38,.35); transform: rotate(-20deg); font-weight: 900; }`;
    if (!imprimirHtml(`Recibo ${r.numero}`, cuerpo, css)) this.error = 'El navegador bloqueó la ventana para imprimir. Permita ventanas emergentes para esta página.';
  }

  private avisar(m: string): void {
    this.mensaje = m;
    setTimeout(() => (this.mensaje = ''), 4000);
  }
}
