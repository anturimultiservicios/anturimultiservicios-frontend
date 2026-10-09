import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, finalize, of, takeUntil } from 'rxjs';
import { RecaudoServicio, Recaudo, PagoRecaudo } from '../../nucleo/servicios/recaudo.servicio';

type Periodo = 'DIA' | 'SEMANA' | 'MES' | 'ANIO';

// 2026-10-09 (pedido de Cristopher): RECAUDO - cuánto entró en el día,
// semana, mes o año, quién pagó (nombre y cédula) y de qué se compone:
// seguridad social (se gira a las entidades), 4x1000 (bancos), comisión
// de Anturi, afiliaciones y "No aporta" (solo trámite). Solo Administrador
// y Super Admin - la Asistente registra pagos, pero no entra aquí.
@Component({
  selector: 'anturi-recaudo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="recaudo">
      <div class="recaudo__encabezado">
        <div>
          <h2 class="pagina-titulo">Recaudo</h2>
          <p class="recaudo__rango">{{ textoRango }}</p>
        </div>
        <div class="recaudo__controles">
          <div class="periodos" role="tablist">
            <button *ngFor="let p of periodos" type="button" role="tab" class="periodos__btn" [class.periodos__btn--activo]="periodo === p.valor" (click)="cambiarPeriodo(p.valor)">{{ p.texto }}</button>
          </div>
          <div class="navegar">
            <button type="button" class="boton boton-icono" (click)="mover(-1)" title="Anterior">‹</button>
            <button type="button" class="boton boton-secundario boton-sm" (click)="irAHoy()">Hoy</button>
            <button type="button" class="boton boton-icono" (click)="mover(1)" title="Siguiente">›</button>
          </div>
        </div>
      </div>

      <div *ngIf="cargando" class="estado-carga"><div class="spinner"></div></div>
      <div *ngIf="error && !cargando" class="tarjeta estado-vacio">{{ error }}</div>

      <ng-container *ngIf="datos && !cargando">
        <div class="tarjetas">
          <div class="tarjeta dato dato--principal">
            <span class="dato__etiqueta">Recaudado</span>
            <span class="dato__valor">{{ datos.totales.recaudado | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
            <span class="dato__nota">{{ datos.totales.cantidad }} pago{{ datos.totales.cantidad !== 1 ? 's' : '' }} · {{ datos.totales.personas }} persona{{ datos.totales.personas !== 1 ? 's' : '' }} o cuenta{{ datos.totales.personas !== 1 ? 's' : '' }}</span>
          </div>
          <div class="tarjeta dato">
            <span class="dato__etiqueta">Seguridad social</span>
            <span class="dato__valor">{{ datos.totales.seguridadSocial | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
            <span class="dato__nota">Se gira a EPS, pensión, ARL y caja</span>
          </div>
          <div class="tarjeta dato">
            <span class="dato__etiqueta">4 x 1000</span>
            <span class="dato__valor">{{ datos.totales.cuatroXMil | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
            <span class="dato__nota">Para los bancos</span>
          </div>
          <div class="tarjeta dato">
            <span class="dato__etiqueta">Comisión Anturi</span>
            <span class="dato__valor">{{ datos.totales.comision | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <div class="tarjeta dato" *ngIf="datos.totales.afiliacion > 0">
            <span class="dato__etiqueta">Afiliaciones</span>
            <span class="dato__valor">{{ datos.totales.afiliacion | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <div class="tarjeta dato">
            <span class="dato__etiqueta">No aporta (trámites)</span>
            <span class="dato__valor">{{ datos.totales.noAporta | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <div class="tarjeta dato dato--anturi">
            <span class="dato__etiqueta">Le queda a Anturi</span>
            <span class="dato__valor">{{ datos.totales.paraAnturi | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
            <span class="dato__nota">4x1000 + comisión + afiliaciones + no aporta</span>
          </div>
          <div class="tarjeta dato">
            <span class="dato__etiqueta">Efectivo / Transferencia</span>
            <span class="dato__valor dato__valor--doble">{{ datos.totales.efectivo | currency:'COP':'symbol-narrow':'1.0-0' }}<small> / </small>{{ datos.totales.transferencia | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
          </div>
        </div>

        <div class="tarjeta tabla-tarjeta">
          <div class="tabla-cabecera">
            <h3 class="seccion-titulo">Quiénes pagaron</h3>
            <input type="search" class="campo-input buscar" placeholder="Buscar por nombre o cédula..." [(ngModel)]="filtro">
          </div>
          <div *ngIf="!filtrados.length" class="estado-vacio-inline">{{ datos.pagos.length ? 'Nadie coincide con la búsqueda.' : 'No hay pagos en este período.' }}</div>
          <div class="tabla-scroll" *ngIf="filtrados.length">
            <table class="tabla">
              <thead>
                <tr>
                  <th>Fecha</th><th>Nombre</th><th>Documento</th><th>Tipo</th><th>Canal</th>
                  <th class="num">Total</th><th class="num">Seg. social</th><th class="num">4x1000</th><th class="num">Comisión</th><th class="num">Afiliación</th><th>Registró</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of filtrados">
                  <td class="nowrap">{{ p.fecha | date:'dd/MM/yy HH:mm' }}</td>
                  <td>
                    <strong>{{ p.nombre }}</strong>
                    <div *ngIf="p.cuenta" class="sub">{{ p.cuenta }}</div>
                    <div *ngIf="p.motivo" class="sub">{{ p.motivo }}</div>
                  </td>
                  <td class="nowrap">{{ p.tipoDocumento }} {{ p.documento }}</td>
                  <td><span class="etiqueta-tipo" [ngClass]="'tipo-' + p.tipo">{{ textoTipo(p) }}</span></td>
                  <td>{{ p.canal === 'EFECTIVO' ? 'Efectivo' : p.canal === 'TRANSFERENCIA' ? 'Transferencia' : '—' }}</td>
                  <td class="num"><strong>{{ p.monto | currency:'COP':'symbol-narrow':'1.0-0' }}</strong></td>
                  <td class="num">{{ p.seguridadSocial | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td class="num">{{ p.cuatroXMil | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td class="num">{{ p.comision | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td class="num">{{ p.afiliacion ? (p.afiliacion | currency:'COP':'symbol-narrow':'1.0-0') : '—' }}</td>
                  <td class="sub">{{ p.registradoPor || '—' }}<span *ngIf="p.estimado" class="estimado" title="Pago anterior al módulo de Recaudo: el desglose se calculó con los valores actuales de la ficha"> · estimado</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .recaudo { display: flex; flex-direction: column; gap: var(--espacio-5); min-width: 0; }
    .recaudo__encabezado { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--espacio-4); flex-wrap: wrap; }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .recaudo__rango { margin: 4px 0 0; color: var(--texto-secundario); font-size: var(--tamano-sm); text-transform: capitalize; }
    .recaudo__controles { display: flex; gap: var(--espacio-3); align-items: center; flex-wrap: wrap; }
    .periodos { display: inline-flex; background: var(--fondo-tarjeta); border: 1px solid var(--borde-color); border-radius: 999px; padding: 3px; }
    .periodos__btn { border: none; background: none; padding: 6px 14px; border-radius: 999px; font-weight: 600; font-size: var(--tamano-sm); color: var(--texto-secundario); cursor: pointer; }
    .periodos__btn--activo { background: var(--color-primario); color: #fff; }
    .navegar { display: inline-flex; gap: 4px; align-items: center; }
    .navegar .boton-icono { font-size: 1.3rem; width: 34px; height: 34px; }
    .tarjetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--espacio-3); }
    .dato { padding: var(--espacio-4); display: flex; flex-direction: column; gap: 4px; }
    .dato__etiqueta { font-size: var(--tamano-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--texto-terciario); }
    .dato__valor { font-size: 1.45rem; font-weight: 800; color: var(--texto-principal); }
    .dato__valor--doble { font-size: 1.05rem; }
    .dato__nota { font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .dato--principal { border-left: 4px solid var(--color-primario); }
    .dato--anturi { border-left: 4px solid var(--color-secundario); }
    .tabla-tarjeta { padding: var(--espacio-4); min-width: 0; }
    .tabla-cabecera { display: flex; justify-content: space-between; align-items: center; gap: var(--espacio-3); flex-wrap: wrap; margin-bottom: var(--espacio-3); }
    .seccion-titulo { margin: 0; font-size: var(--tamano-lg); }
    .buscar { max-width: 280px; }
    .tabla-scroll { overflow-x: auto; }
    .tabla { width: 100%; border-collapse: collapse; font-size: var(--tamano-sm); }
    .tabla th { text-align: left; padding: 8px; color: var(--texto-secundario); border-bottom: 1px solid var(--borde-color); white-space: nowrap; }
    .tabla td { padding: 8px; border-bottom: 1px solid var(--borde-color); vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .nowrap { white-space: nowrap; }
    .sub { font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .estimado { color: var(--color-advertencia); }
    .etiqueta-tipo { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: var(--tamano-xs); font-weight: 700; white-space: nowrap; background: rgba(27,50,112,0.08); color: var(--color-primario); }
    .tipo-NO_APORTA { background: rgba(232,87,12,0.12); color: var(--color-secundario); }
    .tipo-COOPERATIVA { background: rgba(34,197,94,0.12); color: #15803d; }
    .tipo-EMPRESA { background: rgba(100,116,139,0.15); color: var(--texto-secundario); }
    .estado-carga { display: flex; justify-content: center; padding: var(--espacio-8); }
    .spinner { width: 34px; height: 34px; border: 3px solid var(--borde-color); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }
    .estado-vacio, .estado-vacio-inline { padding: var(--espacio-4); color: var(--texto-terciario); text-align: center; }
  `],
})
export class RecaudoComponent implements OnInit, OnDestroy {
  readonly periodos: { valor: Periodo; texto: string }[] = [
    { valor: 'DIA', texto: 'Día' },
    { valor: 'SEMANA', texto: 'Semana' },
    { valor: 'MES', texto: 'Mes' },
    { valor: 'ANIO', texto: 'Año' },
  ];
  periodo: Periodo = 'DIA';
  referencia = new Date();
  datos: Recaudo | null = null;
  cargando = false;
  error = '';
  filtro = '';
  private destruir$ = new Subject<void>();

  constructor(private servicio: RecaudoServicio) {}

  ngOnInit(): void {
    try {
      const p = localStorage.getItem('anturi_recaudo_periodo') as Periodo | null;
      if (p && ['DIA', 'SEMANA', 'MES', 'ANIO'].includes(p)) this.periodo = p;
    } catch { /* */ }
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  // ── Rango del período ──
  get rango(): { desde: Date; hasta: Date } {
    const r = new Date(this.referencia.getFullYear(), this.referencia.getMonth(), this.referencia.getDate());
    switch (this.periodo) {
      case 'DIA': return { desde: r, hasta: r };
      case 'SEMANA': {
        const dia = (r.getDay() + 6) % 7; // lunes = 0
        const desde = new Date(r); desde.setDate(r.getDate() - dia);
        const hasta = new Date(desde); hasta.setDate(desde.getDate() + 6);
        return { desde, hasta };
      }
      case 'MES': return { desde: new Date(r.getFullYear(), r.getMonth(), 1), hasta: new Date(r.getFullYear(), r.getMonth() + 1, 0) };
      default: return { desde: new Date(r.getFullYear(), 0, 1), hasta: new Date(r.getFullYear(), 11, 31) };
    }
  }

  get textoRango(): string {
    const { desde, hasta } = this.rango;
    const f = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('es-CO', o);
    switch (this.periodo) {
      case 'DIA': return f(desde, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      case 'SEMANA': return `Semana del ${f(desde, { day: 'numeric', month: 'long' })} al ${f(hasta, { day: 'numeric', month: 'long', year: 'numeric' })}`;
      case 'MES': return f(desde, { month: 'long', year: 'numeric' });
      default: return `Año ${desde.getFullYear()}`;
    }
  }

  cambiarPeriodo(p: Periodo): void {
    this.periodo = p;
    try { localStorage.setItem('anturi_recaudo_periodo', p); } catch { /* */ }
    this.cargar();
  }

  mover(delta: number): void {
    const r = new Date(this.referencia);
    if (this.periodo === 'DIA') r.setDate(r.getDate() + delta);
    else if (this.periodo === 'SEMANA') r.setDate(r.getDate() + 7 * delta);
    else if (this.periodo === 'MES') r.setMonth(r.getMonth() + delta, 1);
    else r.setFullYear(r.getFullYear() + delta, 0, 1);
    this.referencia = r;
    this.cargar();
  }

  irAHoy(): void {
    this.referencia = new Date();
    this.cargar();
  }

  private iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  cargar(): void {
    const { desde, hasta } = this.rango;
    this.cargando = true;
    this.error = '';
    this.servicio.obtener(this.iso(desde), this.iso(hasta)).pipe(
      catchError((err) => { this.error = err?.error?.message || 'No se pudo cargar el recaudo.'; return of(null); }),
      finalize(() => { this.cargando = false; }),
      takeUntil(this.destruir$),
    ).subscribe((d) => { this.datos = d; });
  }

  get filtrados(): PagoRecaudo[] {
    const t = this.filtro.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const lista = this.datos?.pagos ?? [];
    if (!t) return lista;
    return lista.filter((p) => `${p.nombre} ${p.documento}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t));
  }

  textoTipo(p: PagoRecaudo): string {
    return { AFILIADO: 'Afiliado', COOPERATIVA: 'Cooperativa', EMPRESA: 'Empresa', NO_APORTA: 'No aporta', OTRO: 'Otro' }[p.tipo] ?? p.tipo;
  }
}
