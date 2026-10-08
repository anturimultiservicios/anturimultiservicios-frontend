import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { EventosIncapacidadServicio, EventoIncapacidad, CalculoReferencia } from '../../../nucleo/servicios/eventos-incapacidad.servicio';
import { AfiliadosServicio, Afiliado } from '../../../nucleo/servicios/afiliados.servicio';

// 2026-10-07 (autorización explícita de Cristopher): conecta el backend
// de EventoIncapacidad (agrupación documental por episodio) ya construido
// y desplegado, con su tabla de REFERENCIA legal (Ley 100/1993, Decreto
// 780/2016, Ley 776/2002) - Anturi no paga esto, lo paga la EPS/ARL. Sirve
// para verificar si lo que la persona recibió coincide con lo que la ley
// dice que le correspondía.
@Component({
  selector: 'anturi-incapacidades-afiliado',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="pagina-lista">
      <div class="pagina-encabezado">
        <div>
          <h2 class="pagina-titulo">Incapacidades{{ afiliado ? ' - ' + afiliado.nombres + ' ' + afiliado.apellidos : '' }}</h2>
          <p class="nota">Esto es una tabla de referencia de lo que la EPS o la ARL debería pagar según la ley - Anturi no realiza este pago.</p>
        </div>
        <a [routerLink]="[prefijo, 'afiliados', afiliadoId]" class="boton boton-secundario">Volver al afiliado</a>
      </div>

      <div class="tarjeta">
        <button class="boton boton-primario" (click)="abrirNuevo()" *ngIf="!formAbierto">+ Registrar episodio</button>

        <div *ngIf="formAbierto" class="form-nuevo">
          <div class="campos-grid-modal">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Tipo <span class="requerido">*</span></label>
              <select class="campo-input" [(ngModel)]="nuevoTipoEvento">
                <option value="EPS">EPS (enfermedad general)</option>
                <option value="ARL">ARL (accidente/enfermedad laboral)</option>
              </select>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Fecha de inicio <span class="requerido">*</span></label>
              <input type="date" class="campo-input" [(ngModel)]="nuevaFechaInicio">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Fecha de fin</label>
              <input type="date" class="campo-input" [(ngModel)]="nuevaFechaFin">
              <span class="nota">Déjelo vacío si la incapacidad sigue activa.</span>
            </div>
          </div>
          <div *ngIf="errorForm" class="alerta-error">{{ errorForm }}</div>
          <div class="form-acciones">
            <button class="boton boton-secundario" (click)="formAbierto = false" [disabled]="guardando">Cancelar</button>
            <button class="boton boton-primario" (click)="guardarNuevo()" [disabled]="guardando">
              <span *ngIf="guardando" class="spinner-inline"></span>
              {{ guardando ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>

      <div *ngIf="cargando" class="estado-carga-inline">Cargando...</div>
      <div *ngIf="!cargando && eventos.length === 0" class="tarjeta estado-vacio">No hay episodios de incapacidad registrados.</div>

      <div *ngFor="let ev of eventos" class="tarjeta evento-bloque">
        <div class="evento-encabezado" (click)="toggleEvento(ev)">
          <span class="badge-tipo" [ngClass]="ev.tipoEvento === 'ARL' ? 'badge-arl' : 'badge-eps'">{{ ev.tipoEvento }}</span>
          <strong>{{ ev.fechaInicio | date:'dd/MM/yyyy' }} - {{ ev.fechaFin ? (ev.fechaFin | date:'dd/MM/yyyy') : 'En curso' }}</strong>
          <span class="evento-flecha">{{ eventoExpandidoId === ev.id ? '▲' : '▼' }}</span>
        </div>

        <div *ngIf="eventoExpandidoId === ev.id" class="evento-detalle">
          <!-- Documentos -->
          <div class="seccion-titulo-fila">
            <h4 class="seccion-subtitulo">Documentos del episodio</h4>
            <label class="boton boton-sm boton-secundario">
              Subir documento
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" (change)="subirDocumento(ev, $event)">
            </label>
          </div>
          <div *ngIf="subiendoId === ev.id" class="estado-carga-inline">Subiendo...</div>
          <div *ngIf="documentosPorEvento[ev.id]?.length === 0" class="estado-vacio-inline">Sin documentos todavía.</div>
          <ul class="lista-documentos">
            <li *ngFor="let d of documentosPorEvento[ev.id]">
              <a [href]="urlVerDocumento(d.id)" target="_blank">{{ d.tipo }} ({{ d.extension }}, {{ d.tamanoKb }} KB)</a>
            </li>
          </ul>

          <!-- Cálculo de referencia -->
          <h4 class="seccion-subtitulo" style="margin-top: var(--espacio-4);">Referencia legal (lo que la EPS/ARL debería pagar)</h4>
          <div *ngIf="cargandoCalculo === ev.id" class="estado-carga-inline">Calculando...</div>
          <div *ngIf="errorCalculo[ev.id]" class="alerta-error">{{ errorCalculo[ev.id] }}</div>
          <div *ngIf="calculos[ev.id]" class="tabla-scroll">
            <table class="tabla">
              <thead><tr><th>Días</th><th>%</th><th>Valor diario</th><th>Subtotal</th><th>Quién paga</th></tr></thead>
              <tbody>
                <tr *ngFor="let t of calculos[ev.id].tramos">
                  <td>{{ t.desde }}-{{ t.hasta }} ({{ t.dias }} días)</td>
                  <td>{{ t.porcentaje }}%</td>
                  <td>{{ t.valorDiario | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td>{{ t.subtotal | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td>{{ t.quienPaga }}</td>
                </tr>
              </tbody>
            </table>
            <p><strong>Total de referencia: {{ calculos[ev.id].totalReferencia | currency:'COP':'symbol-narrow':'1.0-0' }}</strong> ({{ calculos[ev.id].diasTotales }} días{{ calculos[ev.id].abierto ? ', sigue en curso' : '' }})</p>
            <ul class="lista-advertencias">
              <li *ngFor="let a of calculos[ev.id].advertencias">{{ a }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-4); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--espacio-3); flex-wrap: wrap; }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .nota { color: var(--texto-terciario); font-size: var(--tamano-sm); margin: var(--espacio-1) 0 0; }
    .tarjeta { background: var(--fondo-tarjeta); border: 1px solid var(--borde-color); border-radius: var(--radio-md); padding: var(--espacio-4); }
    .estado-vacio { text-align: center; color: var(--texto-secundario); }
    .estado-carga-inline, .estado-vacio-inline { color: var(--texto-terciario); font-size: var(--tamano-sm); padding: var(--espacio-2) 0; }
    .campos-grid-modal { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--espacio-4); margin: var(--espacio-3) 0; }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .requerido { color: var(--color-error); }
    .form-acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); }
    .evento-encabezado { display: flex; align-items: center; gap: var(--espacio-3); cursor: pointer; }
    .evento-flecha { margin-left: auto; color: var(--texto-terciario); }
    .evento-detalle { margin-top: var(--espacio-4); padding-top: var(--espacio-4); border-top: 1px solid var(--borde-color); }
    .badge-tipo { display: inline-flex; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 700; }
    .badge-eps { background: rgba(27,50,112,0.12); color: var(--color-primario); }
    .badge-arl { background: rgba(245,158,11,0.12); color: #b45309; }
    .seccion-titulo-fila { display: flex; justify-content: space-between; align-items: center; }
    .seccion-subtitulo { font-size: var(--tamano-base); font-weight: 600; margin: 0; }
    .boton-sm { padding: 6px 12px; font-size: var(--tamano-sm); cursor: pointer; }
    .lista-documentos { margin: var(--espacio-2) 0; padding-left: var(--espacio-5); font-size: var(--tamano-sm); }
    .lista-advertencias { font-size: var(--tamano-sm); color: var(--texto-secundario); padding-left: var(--espacio-5); }
    .tabla-scroll { overflow-x: auto; }
    .tabla { width: 100%; border-collapse: collapse; margin-top: var(--espacio-2); }
    .tabla th, .tabla td { text-align: left; padding: var(--espacio-2) var(--espacio-3); border-bottom: 1px solid var(--borde-color); font-size: var(--tamano-sm); }
    .alerta-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: var(--radio-md); padding: var(--espacio-3); font-size: var(--tamano-sm); }
    .spinner-inline { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: 6px; }
    @keyframes girar { to { transform: rotate(360deg); } }
  `],
})
export class IncapacidadesAfiliadoComponent implements OnInit {
  afiliadoId!: number;
  afiliado: Afiliado | null = null;
  eventos: EventoIncapacidad[] = [];
  cargando = false;

  formAbierto = false;
  nuevoTipoEvento = 'EPS';
  nuevaFechaInicio = '';
  nuevaFechaFin = '';
  errorForm = '';
  guardando = false;

  eventoExpandidoId: number | null = null;
  documentosPorEvento: Record<number, any[]> = {};
  subiendoId: number | null = null;
  calculos: Record<number, CalculoReferencia> = {};
  errorCalculo: Record<number, string> = {};
  cargandoCalculo: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventosServicio: EventosIncapacidadServicio,
    private afiliadosServicio: AfiliadosServicio,
  ) {}

  get prefijo(): string {
    return this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
  }

  ngOnInit(): void {
    this.afiliadoId = Number(this.route.snapshot.paramMap.get('id'));
    this.afiliadosServicio.obtener(this.afiliadoId).pipe(catchError(() => of(null))).subscribe((a) => { this.afiliado = a; });
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.eventosServicio.listarPorAfiliado(this.afiliadoId).pipe(
      catchError(() => of([])),
      finalize(() => { this.cargando = false; }),
    ).subscribe((lista) => { this.eventos = lista; });
  }

  abrirNuevo(): void {
    this.formAbierto = true;
    this.nuevoTipoEvento = 'EPS';
    this.nuevaFechaInicio = '';
    this.nuevaFechaFin = '';
    this.errorForm = '';
  }

  guardarNuevo(): void {
    if (!this.nuevaFechaInicio) {
      this.errorForm = 'La fecha de inicio es obligatoria.';
      return;
    }
    this.guardando = true;
    this.errorForm = '';
    this.eventosServicio.crear({
      afiliadoId: this.afiliadoId,
      tipoEvento: this.nuevoTipoEvento,
      fechaInicio: this.nuevaFechaInicio,
      fechaFin: this.nuevaFechaFin || undefined,
    }).pipe(
      catchError((err) => { this.errorForm = err?.error?.message || 'Error al guardar.'; return of(null); }),
      finalize(() => { this.guardando = false; }),
    ).subscribe((res) => {
      if (res) { this.formAbierto = false; this.cargar(); }
    });
  }

  toggleEvento(ev: EventoIncapacidad): void {
    if (this.eventoExpandidoId === ev.id) {
      this.eventoExpandidoId = null;
      return;
    }
    this.eventoExpandidoId = ev.id;
    this.cargarDocumentos(ev.id);
    this.cargarCalculo(ev.id);
  }

  private cargarDocumentos(eventoId: number): void {
    this.eventosServicio.listarDocumentos(eventoId).pipe(catchError(() => of([]))).subscribe((docs) => {
      this.documentosPorEvento[eventoId] = docs;
    });
  }

  private cargarCalculo(eventoId: number): void {
    this.cargandoCalculo = eventoId;
    delete this.errorCalculo[eventoId];
    this.eventosServicio.calcularReferencia(eventoId).pipe(
      catchError((err) => { this.errorCalculo[eventoId] = err?.error?.message || 'Error al calcular.'; return of(null); }),
      finalize(() => { this.cargandoCalculo = null; }),
    ).subscribe((res) => { if (res) this.calculos[eventoId] = res; });
  }

  subirDocumento(ev: EventoIncapacidad, event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    this.subiendoId = ev.id;
    this.eventosServicio.subirDocumento(ev.id, 'SOPORTE_INCAPACIDAD', archivo).pipe(
      finalize(() => { this.subiendoId = null; input.value = ''; }),
    ).subscribe({
      next: () => this.cargarDocumentos(ev.id),
      error: () => { /* el usuario ve que no aparece en la lista */ },
    });
  }

  urlVerDocumento(documentoId: number): string {
    return this.eventosServicio.urlVerDocumento(documentoId);
  }
}
