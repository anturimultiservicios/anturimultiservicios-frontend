import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of, Observable } from 'rxjs';
import {
  HallazgosReconciliacionServicio,
  HallazgoReconciliacion,
  EvidenciaHallazgo,
  IDENTIFICACION_PENDIENTE,
} from '../../../nucleo/servicios/hallazgos-reconciliacion.servicio';
import { SolicitudesServicio } from '../../../nucleo/servicios/solicitudes.servicio';
import { AutenticacionServicio } from '../../../nucleo/servicios/autenticacion.servicio';

// Categorías conocidas hasta hoy (las mismas usadas en los 237 documentos
// reales subidos en FASE 8) - lista fija por ahora. Pendiente: Cristopher
// pidió una versión con memoria (cualquier rol puede escribir una categoría
// nueva una vez y queda disponible para todos después, como un desplegable
// que se arma solo) - eso es un cambio aparte, todavía no construido acá.
const CATEGORIAS_CONOCIDAS = [
  'CEDULA', 'ARL', 'EPS', 'PENSION', 'CAJA_COMPENSACION', 'CESANTIAS',
  'REGISTRO_CIVIL', 'RUT_EMPLEADOR', 'CAMARA_COMERCIO', 'CERTIFICADO_BANCARIO',
  'DECLARACION', 'CONTRATO', 'OTRO',
];

const ESTADOS = ['PENDIENTE_MIGRACION_B', 'REVISADO', 'DESCARTADO', 'PENDIENTE_IDENTIFICACION'];

@Component({
  selector: 'anturi-detalle-hallazgo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pagina-detalle" *ngIf="!cargando">
      <div class="pagina-encabezado">
        <button class="boton boton-texto" (click)="volver()">← Volver</button>
      </div>

      <div *ngIf="error" class="tarjeta estado-vacio"><p>{{ error }}</p></div>

      <ng-container *ngIf="hallazgo">
        <!-- Solicitudes pendientes sobre este hallazgo (visibles en tiempo real) -->
        <div *ngIf="solicitudesPendientes.length > 0" class="tarjeta alerta-solicitud">
          <div *ngFor="let s of solicitudesPendientes">
            ⏳ <strong>{{ s.tipo }}</strong> pedida por {{ s.creadoPor.nombre }} {{ s.creadoPor.apellido }} - "{{ s.motivo }}" - pendiente de aprobación de un ADMIN/SUPER_ADMIN.
          </div>
        </div>

        <!-- ALERTA de identificación pendiente -->
        <div *ngIf="hallazgo.numeroIdentificacion === PENDIENTE" class="tarjeta alerta-pendiente">
          <div class="alerta-pendiente__icono">⚠</div>
          <div class="alerta-pendiente__texto">
            <strong>Falta la identificación real de esta persona.</strong>
            <p>{{ hallazgo.observaciones }}</p>
          </div>
          <div class="alerta-pendiente__form">
            <select class="campo-input" [(ngModel)]="correccionTipo">
              <option value="CEDULA">Cédula</option>
              <option value="REGISTRO_CIVIL">Registro civil</option>
              <option value="PT">PT (migración)</option>
            </select>
            <input type="text" class="campo-input" placeholder="Número real" [(ngModel)]="correccionNumero">
            <button class="boton boton-primario" [disabled]="!correccionNumero || guardandoCorreccion" (click)="guardarCorreccion()">
              {{ guardandoCorreccion ? 'Guardando...' : (esSecretaria ? 'Pedir corrección (necesita aprobación)' : 'Guardar identificación real') }}
            </button>
          </div>
        </div>

        <div class="tarjeta seccion-datos">
          <div class="encabezado-persona">
            <div class="avatar-grande">{{ (hallazgo.nombreEncontrado || '?').charAt(0).toUpperCase() }}</div>
            <div>
              <h2 class="nombre-titulo">{{ hallazgo.nombreEncontrado }}</h2>
              <p class="subtitulo-rol">{{ hallazgo.rolDetectado }}</p>
            </div>
          </div>

          <div class="datos-grid">
            <div class="dato"><span class="dato-label">Identificación</span><span class="dato-valor">{{ hallazgo.tipoIdentificacion }} {{ hallazgo.numeroIdentificacion }}</span></div>
            <div class="dato" *ngIf="hallazgo.relacionDescripcion"><span class="dato-label">Relación</span><span class="dato-valor">{{ hallazgo.relacionDescripcion }}</span></div>
            <div class="dato" *ngIf="hallazgo.afiliadoId"><span class="dato-label">Afiliado real</span><span class="dato-valor">id {{ hallazgo.afiliadoId }}</span></div>
            <div class="dato" *ngIf="hallazgo.empresaId"><span class="dato-label">Empresa real</span><span class="dato-valor">id {{ hallazgo.empresaId }}</span></div>
            <div class="dato" *ngIf="empleador"><span class="dato-label">Empleador</span><span class="dato-valor dato-valor--link" (click)="irAHallazgo(empleador.id)">{{ empleador.nombreEncontrado }}</span></div>
            <div class="dato"><span class="dato-label">Origen</span><span class="dato-valor">{{ hallazgo.origenArchivo }}</span></div>
          </div>

          <div class="form-estado">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Estado</label>
              <select class="campo-input" [(ngModel)]="formEstado">
                <option *ngFor="let e of ESTADOS" [value]="e">{{ e }}</option>
              </select>
            </div>
            <div class="campo-grupo" style="flex: 1;">
              <label class="campo-etiqueta">Observaciones</label>
              <textarea class="campo-input" rows="2" [(ngModel)]="formObservaciones"></textarea>
            </div>
            <button class="boton boton-secundario" [disabled]="guardandoEstado" (click)="guardarEstado()">
              {{ guardandoEstado ? 'Guardando...' : (esSecretaria ? 'Pedir aprobación' : 'Guardar') }}
            </button>
          </div>
        </div>

        <!-- Trabajadores (solo si este hallazgo es un empleador) -->
        <div class="tarjeta seccion-datos" *ngIf="trabajadores.length > 0">
          <h3 class="seccion-titulo">Trabajadores ({{ trabajadores.length }})</h3>
          <div class="lista-trabajadores">
            <div *ngFor="let t of trabajadores" class="trabajador-fila" (click)="irAHallazgo(t.id)">
              <span class="nombre-completo">{{ t.nombreEncontrado }}</span>
              <span *ngIf="t.numeroIdentificacion !== PENDIENTE" class="celda-cedula">{{ t.numeroIdentificacion }}</span>
              <span *ngIf="t.numeroIdentificacion === PENDIENTE" class="badge-estado badge-alerta">SIN CÉDULA</span>
            </div>
          </div>
        </div>

        <!-- Documentos -->
        <div class="tarjeta seccion-datos">
          <div class="docs-encabezado">
            <h3 class="seccion-titulo">Documentos ({{ evidencias.length }})</h3>
          </div>

          <input type="file" #inputArchivo style="display: none;" accept=".pdf,.jpg,.jpeg,.png" (change)="onArchivoSeleccionado($event)">

          <div class="subir-form">
            <select class="campo-input" [(ngModel)]="categoriaParaSubir">
              <option *ngFor="let c of CATEGORIAS" [value]="c">{{ c }}</option>
            </select>
            <button class="boton boton-secundario" (click)="inputArchivo.click()">Subir documento</button>
          </div>

          <div *ngIf="subiendoArchivo" class="progreso-subida">
            <span>Subiendo: {{ nombreArchivoSubiendo }}</span>
            <div class="barra-progreso"><div class="barra-progreso__relleno" [style.width.%]="progresoSubida"></div></div>
            <span>{{ progresoSubida }}%</span>
          </div>
          <div *ngIf="errorSubida" class="alerta-error">
            {{ errorSubida }}
            <button style="margin-left: auto; background: none; border: none; cursor: pointer;" (click)="errorSubida = ''">✕</button>
          </div>

          <div *ngIf="cargandoEvidencias" class="estado-carga" style="padding: var(--espacio-6);"><div class="spinner"></div></div>

          <div *ngIf="!cargandoEvidencias && evidencias.length === 0" class="estado-vacio" style="padding: var(--espacio-6);">
            <p style="color: var(--texto-terciario);">Sin documentos subidos todavía.</p>
          </div>

          <div *ngIf="!cargandoEvidencias && evidencias.length > 0" class="docs-lista">
            <div *ngFor="let ev of evidencias" class="doc-tarjeta">
              <div class="doc-tarjeta__icono" (click)="abrirDocumento(ev)">
                <svg *ngIf="servicio.esPdf(ev.extension)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="24" height="24" style="color: #dc2626;">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <svg *ngIf="servicio.esImagen(ev.extension)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="24" height="24" style="color: #2563eb;">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </div>
              <div class="doc-tarjeta__info" (click)="abrirDocumento(ev)">
                <span class="doc-tarjeta__tipo">{{ ev.tipo }}</span>
                <span class="doc-tarjeta__meta">{{ ev.tamanoKb }} KB</span>
              </div>
              <button class="doc-tarjeta__eliminar" title="Eliminar" (click)="eliminarDocumento(ev)">✕</button>
            </div>
          </div>
        </div>
      </ng-container>
    </div>

    <div *ngIf="cargando" class="estado-carga"><div class="spinner"></div></div>
  `,
  styles: [`
    .pagina-detalle { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .boton-texto { background: none; border: none; color: var(--color-primario); cursor: pointer; font-weight: 500; padding: 0; }

    .alerta-pendiente { display: flex; align-items: flex-start; gap: var(--espacio-4); padding: var(--espacio-5); background: rgba(234,88,12,0.08); border: 1.5px solid rgba(234,88,12,0.3); flex-wrap: wrap; }
    .alerta-pendiente__icono { font-size: 1.5rem; }
    .alerta-pendiente__texto { flex: 1; min-width: 200px; }
    .alerta-pendiente__texto p { margin: var(--espacio-1) 0 0; color: var(--texto-secundario); font-size: var(--tamano-sm); }
    .alerta-pendiente__form { display: flex; gap: var(--espacio-2); flex-wrap: wrap; align-items: center; }

    .encabezado-persona { display: flex; align-items: center; gap: var(--espacio-4); margin-bottom: var(--espacio-5); }
    .avatar-grande { width: 56px; height: 56px; border-radius: 50%; background: rgba(27,50,112,0.12); color: var(--color-primario); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: var(--tamano-xl); flex-shrink: 0; }
    .nombre-titulo { margin: 0; font-size: var(--tamano-xl); }
    .subtitulo-rol { margin: 2px 0 0; color: var(--texto-terciario); font-size: var(--tamano-sm); }

    .datos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--espacio-4); margin-bottom: var(--espacio-5); }
    .dato { display: flex; flex-direction: column; gap: 2px; }
    .dato-label { font-size: var(--tamano-xs); color: var(--texto-terciario); text-transform: uppercase; letter-spacing: 0.04em; }
    .dato-valor { font-size: var(--tamano-sm); color: var(--texto-principal); font-weight: 500; }
    .dato-valor--link { color: var(--color-primario); cursor: pointer; text-decoration: underline; }

    .form-estado { display: flex; gap: var(--espacio-3); align-items: flex-end; flex-wrap: wrap; border-top: 1px solid var(--borde-color); padding-top: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: 4px; }
    .campo-etiqueta { font-size: var(--tamano-xs); color: var(--texto-terciario); }

    .seccion-titulo { margin: 0 0 var(--espacio-3); font-size: var(--tamano-lg); }

    .lista-trabajadores { display: flex; flex-direction: column; gap: var(--espacio-2); }
    .trabajador-fila { display: flex; justify-content: space-between; align-items: center; padding: var(--espacio-3); border: 1px solid var(--borde-color); border-radius: var(--radio-md); cursor: pointer; }
    .trabajador-fila:hover { background: var(--fondo-tarjeta-hover, rgba(0,0,0,0.02)); }
    .nombre-completo { font-weight: 600; }
    .celda-cedula { font-family: monospace; color: var(--texto-secundario); }

    .badge-estado { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-alerta { background: rgba(234,88,12,0.14); color: #c2410c; }

    .docs-encabezado { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espacio-3); }
    .subir-form { display: flex; gap: var(--espacio-2); margin-bottom: var(--espacio-4); }

    .progreso-subida { display: flex; align-items: center; gap: var(--espacio-3); padding: var(--espacio-3); background: rgba(27,50,112,0.06); border-radius: var(--radio-md); margin-bottom: var(--espacio-3); font-size: var(--tamano-sm); }
    .barra-progreso { flex: 1; height: 6px; background: rgba(0,0,0,0.08); border-radius: 999px; overflow: hidden; }
    .barra-progreso__relleno { height: 100%; background: var(--color-primario); transition: width 0.2s; }
    .alerta-error { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3); background: rgba(239,68,68,0.08); color: #b91c1c; border-radius: var(--radio-md); margin-bottom: var(--espacio-3); font-size: var(--tamano-sm); }

    .docs-lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--espacio-3); }
    .doc-tarjeta { position: relative; display: flex; flex-direction: column; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3); border: 1px solid var(--borde-color); border-radius: var(--radio-md); text-align: center; }
    .doc-tarjeta:hover { background: var(--fondo-tarjeta-hover, rgba(0,0,0,0.02)); }
    .doc-tarjeta__icono, .doc-tarjeta__info { cursor: pointer; }
    .doc-tarjeta__info { display: flex; flex-direction: column; gap: 2px; }
    .doc-tarjeta__tipo { font-size: var(--tamano-xs); font-weight: 600; }
    .doc-tarjeta__meta { font-size: 0.7rem; color: var(--texto-terciario); }
    .doc-tarjeta__eliminar { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; border: none; background: rgba(239,68,68,0.1); color: #b91c1c; cursor: pointer; font-size: 0.7rem; line-height: 1; }
    .doc-tarjeta__eliminar:hover { background: rgba(239,68,68,0.2); }

    .alerta-solicitud { background: rgba(37,99,235,0.08); border: 1.5px solid rgba(37,99,235,0.25); padding: var(--espacio-4); font-size: var(--tamano-sm); display: flex; flex-direction: column; gap: var(--espacio-2); }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .spinner { width: 40px; height: 40px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }
    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); text-align: center; }
  `],
})
export class DetalleHallazgoComponent implements OnInit {
  readonly PENDIENTE = IDENTIFICACION_PENDIENTE;
  readonly ESTADOS = ESTADOS;
  readonly CATEGORIAS = CATEGORIAS_CONOCIDAS;

  hallazgoId = 0;
  hallazgo: HallazgoReconciliacion | null = null;
  empleador: HallazgoReconciliacion | null = null;
  trabajadores: HallazgoReconciliacion[] = [];
  evidencias: EvidenciaHallazgo[] = [];

  cargando = false;
  cargandoEvidencias = false;
  error = '';

  formEstado = '';
  formObservaciones = '';
  guardandoEstado = false;

  correccionTipo = 'CEDULA';
  correccionNumero = '';
  guardandoCorreccion = false;

  categoriaParaSubir = 'CEDULA';
  subiendoArchivo = false;
  nombreArchivoSubiendo = '';
  progresoSubida = 0;
  errorSubida = '';

  esSecretaria = false;
  solicitudesPendientes: any[] = [];

  constructor(
    public servicio: HallazgosReconciliacionServicio,
    private solicitudesServicio: SolicitudesServicio,
    private auth: AutenticacionServicio,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.esSecretaria = this.auth.tieneRol(['SECRETARIA']);
    this.route.params.subscribe((params) => {
      this.hallazgoId = +params['id'];
      this.cargar();
    });
  }

  private cargarSolicitudesPendientes(): void {
    this.solicitudesServicio.listar('PENDIENTE').pipe(
      catchError(() => of([])),
    ).subscribe((lista) => {
      this.solicitudesPendientes = lista.filter(
        (s) =>
          (s.tabla === 'hallazgos_reconciliacion' && s.registroId === this.hallazgoId) ||
          (s.tabla === 'evidencias_hallazgo' && this.evidencias.some((e) => e.id === s.registroId)),
      );
    });
  }

  private cargar(): void {
    this.cargando = true;
    this.error = '';
    this.servicio.listar().pipe(
      catchError(() => {
        this.error = 'Error al cargar. Verifique la conexión.';
        return of([] as HallazgoReconciliacion[]);
      }),
    ).subscribe((todos) => {
      this.hallazgo = todos.find((h) => h.id === this.hallazgoId) || null;
      if (!this.hallazgo) {
        this.error = 'Hallazgo no encontrado.';
        this.cargando = false;
        return;
      }
      this.formEstado = this.hallazgo.estado;
      this.formObservaciones = this.hallazgo.observaciones || '';
      this.empleador = this.hallazgo.empleadorHallazgoId
        ? todos.find((h) => h.id === this.hallazgo!.empleadorHallazgoId) || null
        : null;
      this.trabajadores = todos.filter((h) => h.empleadorHallazgoId === this.hallazgoId);
      this.cargando = false;
      this.cargarEvidencias();
    });
  }

  private cargarEvidencias(): void {
    this.cargandoEvidencias = true;
    this.servicio.listarEvidencias(this.hallazgoId).pipe(
      catchError(() => of([] as EvidenciaHallazgo[])),
    ).subscribe((lista) => {
      this.evidencias = lista;
      this.cargandoEvidencias = false;
      this.cargarSolicitudesPendientes();
    });
  }

  protected get prefijo(): string {
    return this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
  }

  irAHallazgo(id: number): void {
    this.router.navigate([this.prefijo, 'hallazgos-reconciliacion', id]);
  }

  volver(): void {
    this.router.navigate([this.prefijo, 'hallazgos-reconciliacion']);
  }

  // Secretaria: pide la edición vía SolicitudCambio (tabla='hallazgos_reconciliacion'),
  // un ADMIN/SUPER_ADMIN la aprueba después desde "Solicitudes". ADMIN/
  // SUPER_ADMIN: aplica directo, como siempre.
  guardarEstado(): void {
    this.guardandoEstado = true;
    const datosNuevos = { estado: this.formEstado, observaciones: this.formObservaciones };

    const operacion: Observable<any> = this.esSecretaria
      ? this.solicitudesServicio.crear({
          tipo: 'EDICION', tabla: 'hallazgos_reconciliacion', registroId: this.hallazgoId,
          motivo: this.formObservaciones || `Cambiar estado a ${this.formEstado}`,
          datosNuevos,
        })
      : this.servicio.actualizar(this.hallazgoId, datosNuevos);

    operacion.pipe(catchError(() => { this.guardandoEstado = false; return of(null); }))
      .subscribe((resultado) => {
        this.guardandoEstado = false;
        if (!resultado) return;
        if (this.esSecretaria) {
          this.cargarSolicitudesPendientes();
        } else {
          this.hallazgo = resultado as HallazgoReconciliacion;
        }
      });
  }

  guardarCorreccion(): void {
    if (!this.correccionNumero) return;
    this.guardandoCorreccion = true;
    const datosNuevos = {
      tipoIdentificacion: this.correccionTipo,
      numeroIdentificacion: this.correccionNumero,
      estado: 'REVISADO',
    };

    const operacion: Observable<any> = this.esSecretaria
      ? this.solicitudesServicio.crear({
          tipo: 'EDICION', tabla: 'hallazgos_reconciliacion', registroId: this.hallazgoId,
          motivo: `Identificación real conseguida: ${this.correccionTipo} ${this.correccionNumero}`,
          datosNuevos,
        })
      : this.servicio.actualizar(this.hallazgoId, datosNuevos);

    operacion.pipe(catchError(() => { this.guardandoCorreccion = false; return of(null); }))
      .subscribe((resultado) => {
        this.guardandoCorreccion = false;
        if (!resultado) return;
        if (this.esSecretaria) {
          this.cargarSolicitudesPendientes();
        } else {
          this.hallazgo = resultado as HallazgoReconciliacion;
          this.formEstado = this.hallazgo.estado;
        }
      });
  }

  // Eliminar un documento: ADMIN/SUPER_ADMIN directo; Secretaria pide la
  // eliminación vía SolicitudCambio (tabla='evidencias_hallazgo') - el
  // documento sigue visible hasta que se apruebe de verdad.
  eliminarDocumento(ev: EvidenciaHallazgo): void {
    const motivo = window.prompt('¿Por qué se elimina este documento? (obligatorio)');
    if (!motivo || !motivo.trim()) return;

    const operacion = this.esSecretaria
      ? this.solicitudesServicio.crear({ tipo: 'ELIMINACION', tabla: 'evidencias_hallazgo', registroId: ev.id, motivo: motivo.trim() })
      : this.servicio.eliminarEvidencia(ev.id, motivo.trim());

    operacion.subscribe(() => {
      if (this.esSecretaria) {
        this.cargarSolicitudesPendientes();
      } else {
        this.cargarEvidencias();
      }
    });
  }

  onArchivoSeleccionado(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    this.subiendoArchivo = true;
    this.nombreArchivoSubiendo = archivo.name;
    this.progresoSubida = 0;
    this.errorSubida = '';

    this.servicio.subirEvidencia(this.hallazgoId, archivo, this.categoriaParaSubir).subscribe({
      next: (evento: any) => {
        if (evento.type === 1 && evento.total) {
          this.progresoSubida = Math.round((100 * evento.loaded) / evento.total);
        } else if (evento.type === 4) {
          this.subiendoArchivo = false;
          this.cargarEvidencias();
        }
      },
      error: () => {
        this.subiendoArchivo = false;
        this.errorSubida = 'Error al subir el documento.';
      },
    });
    input.value = '';
  }

  abrirDocumento(ev: EvidenciaHallazgo): void {
    window.open(this.servicio.obtenerUrlVisualizacionEvidencia(ev.id), '_blank');
  }
}
