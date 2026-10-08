import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { PagosServicio, DiaCalendario, AfiliadoDiaCalendario } from '../../nucleo/servicios/pagos.servicio';
import { siglaDocumento } from '../../nucleo/utilidades/tipos-documento';

// 2026-09-29 (decisión de Cristopher): calendario visual de vencimientos,
// para los 3 roles - verde quien está al día, rojo quien está vencido,
// click en un día muestra el detalle. Se reutiliza tal cual entre
// /admin/calendario y /secretaria/calendario (mismo patrón que
// ResumenComponent/ListaAfiliadosComponent ya usan con `prefijo`).
@Component({
  selector: 'anturi-calendario-pagos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="calendario-pagina">
      <div class="calendario-encabezado">
        <h2 class="pagina-titulo">Calendario de vencimientos</h2>
        <div class="calendario-nav">
          <button class="boton boton-icono" (click)="mesAnterior()" title="Mes anterior">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <span class="calendario-mes">{{ nombreMes }} {{ anio }}</span>
          <button class="boton boton-icono" (click)="mesSiguiente()" title="Mes siguiente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
          <button class="boton boton-secundario" (click)="irAHoy()">Hoy</button>
        </div>
      </div>

      <div class="calendario-leyenda">
        <span class="leyenda-item"><span class="punto punto--verde"></span> Ya pagó</span>
        <span class="leyenda-item"><span class="punto punto--rojo"></span> Sin pagar</span>
        <span class="leyenda-nota">Cada persona vence en su fecha límite de la PILA (según los dos últimos dígitos del documento).</span>
      </div>

      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando...</p>
      </div>

      <div class="calendario-grid" *ngIf="!cargando">
        <div class="calendario-diasem" *ngFor="let d of diasSemana">{{ d }}</div>
        <div
          *ngFor="let celda of celdas"
          class="calendario-celda"
          [class.calendario-celda--vacia]="!celda"
          [class.calendario-celda--hoy]="celda?.esHoy"
          [class.calendario-celda--seleccionada]="celda && diaSeleccionado === celda.fecha"
          (click)="celda && seleccionarDia(celda)"
        >
          <ng-container *ngIf="celda">
            <span class="celda-numero">{{ celda.numero }}</span>
            <div class="celda-badges" *ngIf="celda.alDia || celda.vencidos">
              <span class="badge-punto badge-punto--verde" *ngIf="celda.alDia">{{ celda.alDia }}</span>
              <span class="badge-punto badge-punto--rojo" *ngIf="celda.vencidos">{{ celda.vencidos }}</span>
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Detalle del día seleccionado -->
      <div class="tarjeta detalle-dia" *ngIf="diaSeleccionado">
        <h3 class="seccion-titulo">{{ diaSeleccionadoFormato }}</h3>
        <div *ngIf="afiliadosDelDia.length === 0" class="estado-vacio-chico">Nadie vence este día.</div>
        <p *ngIf="afiliadosDelDia.length > 0" class="resumen-dia">{{ afiliadosDelDia.length }} vencen este día · <span class="txt-rojo">{{ contarSinPagar() }} sin pagar</span> · <span class="txt-verde">{{ afiliadosDelDia.length - contarSinPagar() }} ya pagaron</span></p>
        <div class="tabla-scroll" *ngIf="afiliadosDelDia.length > 0">
          <table class="tabla">
            <thead>
              <tr><th>Afiliado</th><th>Documento</th><th>Celular</th><th>Valor mes</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of afiliadosDelDia">
                <td>{{ item.afiliado.nombres }} {{ item.afiliado.apellidos }}</td>
                <td>{{ sigla(item.afiliado.tipoDocumento) }} {{ item.afiliado.cedula }}</td>
                <td>{{ item.afiliado.telefono || '—' }}</td>
                <td>{{ item.valorMes != null ? ('$' + (item.valorMes | number:'1.0-0')) : '—' }}</td>
                <td>
                  <span class="badge-estado" [ngClass]="item.estado === 'PAGADO' ? 'badge-activo' : 'badge-inactivo-rojo'">
                    {{ item.estado === 'PAGADO' ? 'Ya pagó' : (item.vencido ? 'Sin pagar · vencido' : 'Sin pagar') }}
                  </span>
                </td>
                <td>
                  <a [routerLink]="[prefijo, 'afiliados', item.afiliado.id]" class="boton boton-secundario" style="padding: 4px 12px; font-size: var(--tamano-sm);">
                    Ver
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calendario-pagina { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .calendario-encabezado { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--espacio-3); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .calendario-nav { display: flex; align-items: center; gap: var(--espacio-2); }
    .calendario-mes { font-weight: 600; color: var(--texto-principal); min-width: 160px; text-align: center; text-transform: capitalize; }

    .calendario-leyenda { display: flex; gap: var(--espacio-4); font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .leyenda-item { display: flex; align-items: center; gap: var(--espacio-1); }
    .punto { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .leyenda-nota { font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .resumen-dia { margin: 0 0 var(--espacio-3); font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .txt-rojo { color: #b91c1c; font-weight: 600; }
    .txt-verde { color: #15803d; font-weight: 600; }
    .punto--verde { background: #22c55e; }
    .punto--rojo { background: #ef4444; }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .spinner { width: 36px; height: 36px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }

    .calendario-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .calendario-diasem { text-align: center; font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-terciario); padding: var(--espacio-2) 0; }
    .calendario-celda { min-height: 72px; border: 1px solid var(--borde-color, #e5e7eb); border-radius: var(--radio-sm); padding: var(--espacio-2); cursor: pointer; display: flex; flex-direction: column; gap: 4px; transition: var(--transicion-base); background: var(--fondo-tarjeta, #fff); }
    .calendario-celda:hover { border-color: var(--color-primario); }
    .calendario-celda--vacia { border: none; cursor: default; background: transparent; }
    .calendario-celda--hoy { border-color: var(--color-primario); border-width: 2px; }
    .calendario-celda--seleccionada { background: rgba(27,50,112,0.06); border-color: var(--color-primario); }
    .celda-numero { font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-principal); }
    .celda-badges { display: flex; gap: 4px; flex-wrap: wrap; }
    .badge-punto { font-size: 0.68rem; font-weight: 700; padding: 1px 6px; border-radius: 10px; color: white; }
    .badge-punto--verde { background: #22c55e; }
    .badge-punto--rojo { background: #ef4444; }

    .detalle-dia { padding: var(--espacio-5); }
    .seccion-titulo { font-size: var(--tamano-lg); font-weight: 600; color: var(--texto-principal); margin: 0 0 var(--espacio-4); text-transform: capitalize; }
    .estado-vacio-chico { color: var(--texto-terciario); font-size: var(--tamano-sm); }

    .tabla-scroll { overflow-x: auto; }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla thead th { padding: var(--espacio-2) var(--espacio-3); text-align: left; font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-secundario); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); border-bottom: 1px solid var(--borde-color, #e5e7eb); }
    .tabla tbody td { padding: var(--espacio-2) var(--espacio-3); border-bottom: 1px solid var(--borde-color, #e5e7eb); font-size: var(--tamano-sm); color: var(--texto-principal); }
    .tabla tbody tr:last-child td { border-bottom: none; }

    .badge-estado { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-activo { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-inactivo-rojo { background: rgba(239,68,68,0.12); color: #b91c1c; }
  `],
})
export class CalendarioPagosComponent implements OnInit {
  cargando = false;
  anio = new Date().getFullYear();
  mes = new Date().getMonth(); // 0-11
  diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  celdas: Array<{ fecha: string; numero: number; esHoy: boolean; alDia: number; vencidos: number } | null> = [];
  private datosPorDia = new Map<string, DiaCalendario>();

  diaSeleccionado: string | null = null;
  afiliadosDelDia: AfiliadoDiaCalendario[] = [];

  constructor(private pagosServicio: PagosServicio, private router: Router) {}

  get prefijo(): string {
    return this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
  }

  get nombreMes(): string {
    return new Date(this.anio, this.mes, 1).toLocaleDateString('es-CO', { month: 'long' });
  }

  get diaSeleccionadoFormato(): string {
    if (!this.diaSeleccionado) return '';
    return new Date(this.diaSeleccionado + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  ngOnInit(): void {
    this.cargarMes();
  }

  mesAnterior(): void {
    this.mes--;
    if (this.mes < 0) { this.mes = 11; this.anio--; }
    this.cargarMes();
  }

  mesSiguiente(): void {
    this.mes++;
    if (this.mes > 11) { this.mes = 0; this.anio++; }
    this.cargarMes();
  }

  irAHoy(): void {
    const hoy = new Date();
    this.anio = hoy.getFullYear();
    this.mes = hoy.getMonth();
    this.cargarMes();
  }

  // 2026-09-29: NUNCA usar toISOString() para la clave del día - convierte
  // a UTC y en Colombia (UTC-5) corre el día uno hacia atrás en cualquier
  // hora de la madrugada. Se arma la clave a mano con los componentes
  // locales de la fecha.
  private fechaLocal(d: Date): string {
    const anio = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private cargarMes(): void {
    this.cargando = true;
    this.diaSeleccionado = null;
    this.afiliadosDelDia = [];
    const desde = new Date(this.anio, this.mes, 1);
    const hasta = new Date(this.anio, this.mes + 1, 0);

    this.pagosServicio.calendario(this.fechaLocal(desde), this.fechaLocal(hasta)).pipe(
      catchError(() => of([] as DiaCalendario[]))
    ).subscribe(dias => {
      this.datosPorDia = new Map(dias.map(d => [d.fecha, d]));
      this.construirCeldas(desde, hasta);
      this.cargando = false;
    });
  }

  private construirCeldas(desde: Date, hasta: Date): void {
    const celdas: typeof this.celdas = [];
    const primerDiaSemana = desde.getDay(); // 0=domingo
    for (let i = 0; i < primerDiaSemana; i++) celdas.push(null);

    const hoyStr = this.fechaLocal(new Date());
    for (let dia = 1; dia <= hasta.getDate(); dia++) {
      const fecha = new Date(this.anio, this.mes, dia);
      const clave = this.fechaLocal(fecha);
      const datosDia = this.datosPorDia.get(clave);
      const alDia = datosDia?.afiliados.filter(a => a.estado === 'PAGADO').length ?? 0;
      const vencidos = datosDia?.afiliados.filter(a => a.estado === 'SIN_PAGAR').length ?? 0;
      celdas.push({ fecha: clave, numero: dia, esHoy: clave === hoyStr, alDia, vencidos });
    }
    this.celdas = celdas;
  }

  readonly sigla = siglaDocumento;

  contarSinPagar(): number {
    return this.afiliadosDelDia.filter((a) => a.estado === 'SIN_PAGAR').length;
  }

  seleccionarDia(celda: { fecha: string }): void {
    this.diaSeleccionado = celda.fecha;
    this.afiliadosDelDia = this.datosPorDia.get(celda.fecha)?.afiliados ?? [];
  }
}
