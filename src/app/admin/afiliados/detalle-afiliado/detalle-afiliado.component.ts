import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, catchError, of, finalize } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { AfiliadosServicio, Afiliado } from '../../../nucleo/servicios/afiliados.servicio';
import { DocumentosServicio, Documento } from '../../../nucleo/servicios/documentos.servicio';
import { SolicitudesServicio } from '../../../nucleo/servicios/solicitudes.servicio';
import { AutenticacionServicio } from '../../../nucleo/servicios/autenticacion.servicio';

@Component({
  selector: 'anturi-detalle-afiliado',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="detalle-contenedor">

      <!-- Encabezado con volver -->
      <div class="detalle-encabezado">
        <button class="boton boton-icono" (click)="volver()" title="Volver a la lista">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="detalle-encabezado__info">
          <h2 class="pagina-titulo" *ngIf="afiliado">{{ afiliado.nombres }} {{ afiliado.apellidos }}</h2>
          <h2 class="pagina-titulo" *ngIf="!afiliado && !cargando">Detalle de afiliado</h2>
          <span *ngIf="afiliado" class="badge-estado" [ngClass]="claseBadge(afiliado.estado)">{{ afiliado.estado }}</span>
        </div>
        <div class="detalle-acciones" *ngIf="afiliado && !modoEdicion">
          <button class="boton boton-secundario" (click)="activarEdicion()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Editar
          </button>
          <button class="boton boton-peligro" (click)="modalEliminar = true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
              <path d="M10 11v6"></path><path d="M14 11v6"></path>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg>
            Eliminar
          </button>
        </div>
      </div>

      <!-- Estado de carga -->
      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando datos del afiliado...</p>
      </div>

      <!-- Error de carga -->
      <div *ngIf="errorCarga && !cargando" class="tarjeta estado-vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40" style="color: var(--color-error);">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>{{ errorCarga }}</p>
        <button class="boton boton-secundario" (click)="cargarAfiliado()">Reintentar</button>
      </div>

      <!-- Mensaje de éxito/error -->
      <div *ngIf="mensajeExito" class="alerta-exito">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        {{ mensajeExito }}
      </div>
      <div *ngIf="mensajeError" class="alerta-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        {{ mensajeError }}
      </div>

      <!-- MODO VISUALIZACIÓN -->
      <ng-container *ngIf="afiliado && !cargando && !modoEdicion">
        <!-- Datos personales + laborales -->
        <div class="tarjeta seccion-datos">
          <h3 class="seccion-titulo">Datos personales y laborales</h3>
          <div class="datos-grid">
            <div class="dato-item">
              <span class="dato-etiqueta">Cédula</span>
              <span class="dato-valor">{{ afiliado.cedula }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Correo</span>
              <span class="dato-valor">{{ afiliado.correo || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Teléfono</span>
              <span class="dato-valor">{{ afiliado.telefono || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Fecha de nacimiento</span>
              <span class="dato-valor">{{ afiliado.fechaNacimiento ? (afiliado.fechaNacimiento | date:'dd/MM/yyyy') : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Cargo</span>
              <span class="dato-valor">{{ afiliado.cargo || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Clase aportante</span>
              <span class="dato-valor">{{ afiliado.claseAportante || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Asopagos</span>
              <span class="dato-valor">{{ afiliado.asopagos || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Días de pago</span>
              <span class="dato-valor">{{ afiliado.diasPago ?? '—' }}</span>
            </div>
            <div class="dato-item dato-item--ancho">
              <span class="dato-etiqueta">Actividad económica</span>
              <span class="dato-valor">{{ afiliado.actividadEconomica || '—' }}</span>
            </div>
          </div>
        </div>

        <!-- Seguros -->
        <div class="tarjeta seccion-datos">
          <h3 class="seccion-titulo">Seguros</h3>
          <div class="datos-grid">
            <div class="dato-item">
              <span class="dato-etiqueta">EPS</span>
              <span class="dato-valor">{{ obtenerSeguroNombre('EPS') || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">AFP (Pensión)</span>
              <span class="dato-valor">{{ obtenerSeguroNombre('AFP') || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">ARL (%)</span>
              <span class="dato-valor">{{ afiliado.porcentajeArl != null ? afiliado.porcentajeArl + '%' : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Caja de compensación</span>
              <span class="dato-valor">{{ obtenerSeguroNombre('CAJA') || '—' }}</span>
            </div>
          </div>
        </div>

        <!-- Valores económicos -->
        <div class="tarjeta seccion-datos">
          <h3 class="seccion-titulo">Valores económicos</h3>
          <div class="datos-grid">
            <div class="dato-item">
              <span class="dato-etiqueta">Valor base</span>
              <span class="dato-valor">{{ afiliado.valor != null ? ('$' + (afiliado.valor | number)) : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Comisión</span>
              <span class="dato-valor">{{ afiliado.comision != null ? ('$' + (afiliado.comision | number)) : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Total pago</span>
              <span class="dato-valor" style="font-weight: 700; color: var(--color-primario);">{{ afiliado.totalPago != null ? ('$' + (afiliado.totalPago | number)) : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">4 x Mil</span>
              <span class="dato-valor">{{ afiliado.cuatroXMil != null ? ('$' + (afiliado.cuatroXMil | number)) : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Cesantías</span>
              <span class="dato-valor">{{ afiliado.cesantias != null ? ('$' + (afiliado.cesantias | number)) : '—' }}</span>
            </div>
          </div>
        </div>

        <!-- Fechas -->
        <div class="tarjeta seccion-datos">
          <h3 class="seccion-titulo">Fechas y estado</h3>
          <div class="datos-grid">
            <div class="dato-item">
              <span class="dato-etiqueta">Estado actual</span>
              <span class="badge-estado" [ngClass]="claseBadge(afiliado.estado)">{{ afiliado.estado }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Fecha de ingreso</span>
              <span class="dato-valor">{{ afiliado.fechaIngreso ? (afiliado.fechaIngreso | date:'dd/MM/yyyy') : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Fecha de retiro</span>
              <span class="dato-valor">{{ afiliado.fechaRetiro ? (afiliado.fechaRetiro | date:'dd/MM/yyyy') : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Registrado el</span>
              <span class="dato-valor">{{ afiliado.creadoEn | date:'dd/MM/yyyy HH:mm' }}</span>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- MODO EDICIÓN -->
      <div *ngIf="afiliado && modoEdicion" class="tarjeta seccion-datos">
        <div class="edicion-encabezado">
          <h3 class="seccion-titulo">Editando datos del afiliado</h3>
          <div *ngIf="esSecretaria" class="aviso-secretaria">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Como secretaria, su solicitud quedará pendiente de aprobación.
          </div>
        </div>

        <div *ngIf="esSecretaria" class="campo-grupo" style="margin-bottom: var(--espacio-4);">
          <label class="campo-etiqueta">Motivo del cambio <span style="color: var(--color-error);">*</span></label>
          <input type="text" class="campo-input" [(ngModel)]="motivoEdicion" placeholder="Describa el motivo de la edición">
        </div>

        <div class="campos-grid">
          <div class="campo-grupo">
            <label class="campo-etiqueta">Nombres</label>
            <input type="text" class="campo-input" [(ngModel)]="edicionForm.nombres" name="edit-nombres">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Apellidos</label>
            <input type="text" class="campo-input" [(ngModel)]="edicionForm.apellidos" name="edit-apellidos">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Correo</label>
            <input type="email" class="campo-input" [(ngModel)]="edicionForm.correo" name="edit-correo">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Teléfono</label>
            <input type="tel" class="campo-input" [(ngModel)]="edicionForm.telefono" name="edit-telefono">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Cargo</label>
            <input type="text" class="campo-input" [(ngModel)]="edicionForm.cargo" name="edit-cargo">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Clase aportante</label>
            <select class="campo-input" [(ngModel)]="edicionForm.claseAportante" name="edit-clase">
              <option value="">Seleccionar...</option>
              <option value="Independiente">Independiente</option>
              <option value="Cooperativa">Cooperativa</option>
              <option value="Empresa">Empresa</option>
            </select>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Estado</label>
            <select class="campo-input" [(ngModel)]="edicionForm.estado" name="edit-estado">
              <option value="ACTIVO">Activo</option>
              <option value="RETIRADO">Retirado</option>
              <option value="SUSPENDIDO">Suspendido</option>
            </select>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Valor base</label>
            <input type="number" class="campo-input" [(ngModel)]="edicionForm.valor" name="edit-valor">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Comisión</label>
            <input type="number" class="campo-input" [(ngModel)]="edicionForm.comision" name="edit-comision">
          </div>
        </div>

        <div class="form-acciones" style="margin-top: var(--espacio-5);">
          <button class="boton boton-secundario" (click)="cancelarEdicion()" [disabled]="guardandoEdicion">Cancelar</button>
          <button class="boton boton-primario" (click)="guardarEdicion()" [disabled]="guardandoEdicion">
            <span *ngIf="guardandoEdicion" class="spinner-inline"></span>
            {{ guardandoEdicion ? 'Guardando...' : (esSecretaria ? 'Enviar solicitud' : 'Guardar cambios') }}
          </button>
        </div>
      </div>

      <!-- SECCIÓN DOCUMENTOS -->
      <div *ngIf="afiliado && !cargando" class="tarjeta seccion-datos">
        <div class="docs-encabezado">
          <h3 class="seccion-titulo">Documentos</h3>
          <button class="boton boton-secundario boton-sm" (click)="triggerInputArchivo()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Seleccionar archivo
          </button>
        </div>

        <!-- Zona Drag & Drop -->
        <div
          class="dropzone"
          [class.dropzone--activa]="arrastrando"
          (dragover)="onDragOver($event)"
          (dragleave)="arrastrando = false"
          (drop)="onDrop($event)"
          (click)="triggerInputArchivo()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36" style="color: var(--texto-terciario);">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <p>Arrastra archivos aquí o haz clic para seleccionar</p>
          <p class="dropzone__tipos">PDF, JPG, PNG</p>
          <input
            type="file"
            #inputArchivo
            style="display: none;"
            accept=".pdf,.jpg,.jpeg,.png"
            (change)="onArchivoSeleccionado($event)"
          >
        </div>

        <!-- Progreso de subida -->
        <div *ngIf="subiendoArchivo" class="progreso-subida">
          <span>Subiendo: {{ nombreArchivoSubiendo }}</span>
          <div class="barra-progreso">
            <div class="barra-progreso__relleno" [style.width.%]="progresoSubida"></div>
          </div>
          <span>{{ progresoSubida }}%</span>
        </div>

        <!-- Error de subida -->
        <div *ngIf="errorSubida" class="alerta-error" style="margin-top: var(--espacio-3);">
          {{ errorSubida }}
          <button style="margin-left: auto; background: none; border: none; cursor: pointer; color: inherit;" (click)="errorSubida = ''">✕</button>
        </div>

        <!-- Lista de documentos -->
        <div *ngIf="cargandoDocs" class="estado-carga" style="padding: var(--espacio-6);">
          <div class="spinner"></div>
        </div>

        <div *ngIf="!cargandoDocs && documentos.length === 0" class="docs-vacio">
          No hay documentos adjuntos para este afiliado.
        </div>

        <div *ngIf="!cargandoDocs && documentos.length > 0" class="docs-lista">
          <div *ngFor="let doc of documentos" class="doc-tarjeta">
            <div class="doc-tarjeta__icono" (click)="abrirDocumento(doc)" style="cursor: pointer;">
              <svg *ngIf="docServicio.esPdf(doc.extension)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28" style="color: #dc2626;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <svg *ngIf="docServicio.esImagen(doc.extension)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28" style="color: #2563eb;">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <svg *ngIf="!docServicio.esPdf(doc.extension) && !docServicio.esImagen(doc.extension)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28" style="color: var(--texto-terciario);">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <div class="doc-tarjeta__info" (click)="abrirDocumento(doc)" style="cursor: pointer;">
              <span class="doc-nombre">{{ doc.nombre || doc.nombreOriginal }}</span>
              <span class="doc-meta">{{ doc.tipo }} · {{ doc.creadoEn | date:'dd/MM/yyyy' }}</span>
            </div>
            <button
              class="boton boton-icono boton-peligro-suave"
              title="Eliminar documento"
              (click)="eliminarDocumento(doc)"
              [disabled]="eliminandoDocId === doc.id"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL: Visualizar documento -->
      <div *ngIf="modalDoc" class="modal-overlay" (click)="cerrarModalDoc()">
        <div class="modal-doc" (click)="$event.stopPropagation()">
          <div class="modal-doc__header">
            <span class="modal-doc__titulo">{{ docActual?.nombre || docActual?.nombreOriginal }}</span>
            <button class="boton boton-icono" (click)="cerrarModalDoc()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-doc__cuerpo">
            <img
              *ngIf="docActual && docServicio.esImagen(docActual.extension)"
              [src]="docServicio.obtenerUrlVisualizacion(docActual.id)"
              [alt]="docActual.nombre"
              class="modal-doc__imagen"
            >
            <iframe
              *ngIf="docActual && docServicio.esPdf(docActual.extension)"
              [src]="urlPdfSeguro"
              class="modal-doc__iframe"
              frameborder="0"
            ></iframe>
          </div>
        </div>
      </div>

      <!-- MODAL: Confirmar eliminación -->
      <div *ngIf="modalEliminar" class="modal-overlay" (click)="modalEliminar = false">
        <div class="modal-confirm" (click)="$event.stopPropagation()">
          <h3 class="modal-confirm__titulo">Confirmar eliminación</h3>
          <p class="modal-confirm__texto">
            Esta acción eliminará al afiliado <strong>{{ afiliado?.nombres }} {{ afiliado?.apellidos }}</strong>.
          </p>
          <div class="campo-grupo" style="margin: var(--espacio-4) 0;">
            <label class="campo-etiqueta">Motivo de eliminación <span style="color: var(--color-error);">*</span></label>
            <input
              type="text"
              class="campo-input"
              [(ngModel)]="motivoEliminacion"
              placeholder="Ingrese el motivo (obligatorio)"
            >
            <span *ngIf="errorMotivoEliminar" class="mensaje-error">{{ errorMotivoEliminar }}</span>
          </div>
          <div class="modal-confirm__acciones">
            <button class="boton boton-secundario" (click)="modalEliminar = false; motivoEliminacion = ''; errorMotivoEliminar = ''">Cancelar</button>
            <button class="boton boton-peligro" (click)="confirmarEliminar()" [disabled]="eliminando">
              <span *ngIf="eliminando" class="spinner-inline"></span>
              {{ eliminando ? 'Eliminando...' : (esSecretaria ? 'Enviar solicitud' : 'Eliminar definitivamente') }}
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .detalle-contenedor { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .detalle-encabezado { display: flex; align-items: center; gap: var(--espacio-4); flex-wrap: wrap; }
    .detalle-encabezado__info { display: flex; align-items: center; gap: var(--espacio-3); flex: 1; flex-wrap: wrap; }
    .detalle-acciones { display: flex; gap: var(--espacio-2); margin-left: auto; flex-wrap: wrap; }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); text-align: center; }
    .spinner { width: 36px; height: 36px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }

    .seccion-datos { padding: var(--espacio-5); }
    .seccion-titulo { font-size: var(--tamano-lg); font-weight: 600; color: var(--texto-principal); margin: 0 0 var(--espacio-4); }
    .datos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--espacio-4); }
    .dato-item { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .dato-item--ancho { grid-column: 1 / -1; }
    .dato-etiqueta { font-size: var(--tamano-sm); color: var(--texto-terciario); font-weight: 500; }
    .dato-valor { font-size: var(--tamano-base); color: var(--texto-principal); font-weight: 500; }

    .badge-estado { display: inline-flex; align-items: center; padding: 3px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-activo { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-retirado { background: rgba(249,115,22,0.12); color: #c2410c; }
    .badge-suspendido { background: rgba(239,68,68,0.12); color: #b91c1c; }

    /* Edición */
    .edicion-encabezado { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--espacio-3); margin-bottom: var(--espacio-4); }
    .aviso-secretaria { display: flex; align-items: center; gap: var(--espacio-2); font-size: var(--tamano-sm); color: var(--color-advertencia); background: rgba(249,115,22,0.08); padding: var(--espacio-2) var(--espacio-3); border-radius: var(--radio-sm); }
    .campos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .form-acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); }
    .boton-sm { font-size: var(--tamano-sm); padding: var(--espacio-1) var(--espacio-3); }

    /* Documentos */
    .docs-encabezado { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--espacio-4); }
    .dropzone { border: 2px dashed var(--borde-color, #d1d5db); border-radius: var(--radio-lg); padding: var(--espacio-8) var(--espacio-6); display: flex; flex-direction: column; align-items: center; gap: var(--espacio-2); cursor: pointer; transition: var(--transicion-base); text-align: center; color: var(--texto-terciario); }
    .dropzone:hover, .dropzone--activa { border-color: var(--color-primario); background: rgba(27,50,112,0.04); }
    .dropzone__tipos { font-size: var(--tamano-sm); }
    .docs-vacio { text-align: center; color: var(--texto-terciario); padding: var(--espacio-6); font-size: var(--tamano-sm); }
    .docs-lista { display: flex; flex-direction: column; gap: var(--espacio-2); margin-top: var(--espacio-4); }
    .doc-tarjeta { display: flex; align-items: center; gap: var(--espacio-3); padding: var(--espacio-3) var(--espacio-4); border: 1px solid var(--borde-color, #e5e7eb); border-radius: var(--radio-md); transition: var(--transicion-base); }
    .doc-tarjeta:hover { background: var(--fondo-tarjeta-hover, rgba(0,0,0,0.02)); }
    .doc-tarjeta__icono { flex-shrink: 0; }
    .doc-tarjeta__info { flex: 1; min-width: 0; }
    .doc-nombre { display: block; font-weight: 500; color: var(--texto-principal); font-size: var(--tamano-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .doc-meta { display: block; font-size: 0.72rem; color: var(--texto-terciario); margin-top: 2px; }
    .boton-peligro-suave { color: var(--color-error); }
    .boton-peligro-suave:hover { background: rgba(239,68,68,0.08); }

    /* Progreso subida */
    .progreso-subida { display: flex; align-items: center; gap: var(--espacio-3); margin-top: var(--espacio-3); font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .barra-progreso { flex: 1; height: 6px; background: var(--borde-color, #e5e7eb); border-radius: 3px; overflow: hidden; }
    .barra-progreso__relleno { height: 100%; background: var(--color-primario); transition: width 0.2s; }

    /* Modales */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: var(--espacio-4); }
    .modal-doc { background: var(--fondo-tarjeta, #fff); border-radius: var(--radio-xl); width: 100%; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--sombra-md); }
    .modal-doc__header { display: flex; align-items: center; justify-content: space-between; padding: var(--espacio-4) var(--espacio-5); border-bottom: 1px solid var(--borde-color, #e5e7eb); }
    .modal-doc__titulo { font-weight: 600; color: var(--texto-principal); font-size: var(--tamano-base); }
    .modal-doc__cuerpo { flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; padding: var(--espacio-4); }
    .modal-doc__imagen { max-width: 100%; max-height: 70vh; border-radius: var(--radio-md); object-fit: contain; }
    .modal-doc__iframe { width: 100%; height: 70vh; border: none; }
    .modal-confirm { background: var(--fondo-tarjeta, #fff); border-radius: var(--radio-xl); padding: var(--espacio-6); width: 100%; max-width: 480px; box-shadow: var(--sombra-md); }
    .modal-confirm__titulo { font-size: var(--tamano-xl); font-weight: 700; color: var(--texto-principal); margin: 0 0 var(--espacio-3); }
    .modal-confirm__texto { color: var(--texto-secundario); margin: 0; }
    .modal-confirm__acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); margin-top: var(--espacio-4); }

    .alerta-exito { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: var(--radio-md); color: #15803d; font-size: var(--tamano-sm); }
    .alerta-error { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radio-md); color: var(--color-error); font-size: var(--tamano-sm); }
    .mensaje-error { font-size: var(--tamano-sm); color: var(--color-error); }

    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }
  `]
})
export class DetalleAfiliadoComponent implements OnInit, OnDestroy {
  afiliado: Afiliado | null = null;
  documentos: Documento[] = [];
  cargando = false;
  cargandoDocs = false;
  errorCarga = '';
  mensajeExito = '';
  mensajeError = '';

  // Edición
  modoEdicion = false;
  edicionForm: Partial<Afiliado> = {};
  motivoEdicion = '';
  guardandoEdicion = false;

  // Eliminación
  modalEliminar = false;
  motivoEliminacion = '';
  errorMotivoEliminar = '';
  eliminando = false;

  // Documentos
  arrastrando = false;
  subiendoArchivo = false;
  progresoSubida = 0;
  nombreArchivoSubiendo = '';
  errorSubida = '';
  eliminandoDocId: number | null = null;

  // Modal documento
  modalDoc = false;
  docActual: Documento | null = null;
  urlPdfSeguro: any = null;

  private destruir$ = new Subject<void>();
  private afiliadoId!: number;

  get esSecretaria(): boolean {
    return this.auth.tieneRol(['SECRETARIA']);
  }

  get esAdmin(): boolean {
    return this.auth.tieneRol(['ADMIN', 'SUPER_ADMIN']);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private afiliadosServicio: AfiliadosServicio,
    public docServicio: DocumentosServicio,
    private solicitudesServicio: SolicitudesServicio,
    private auth: AutenticacionServicio
  ) {}

  private get prefijo(): string {
    return this.router.url.startsWith('/secretaria') ? '/secretaria' : '/admin';
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.afiliadoId = Number(idParam);
      this.cargarAfiliado();
    }
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  cargarAfiliado(): void {
    this.cargando = true;
    this.errorCarga = '';
    this.afiliadosServicio.obtener(this.afiliadoId).pipe(
      catchError(err => {
        this.errorCarga = 'No se pudo cargar el afiliado. Verifique la conexión.';
        return of(null);
      }),
      takeUntil(this.destruir$)
    ).subscribe(af => {
      this.cargando = false;
      if (af) {
        this.afiliado = af;
        this.cargarDocumentos();
      }
    });
  }

  cargarDocumentos(): void {
    this.cargandoDocs = true;
    this.docServicio.listarDeAfiliado(this.afiliadoId).pipe(
      catchError(() => of([])),
      takeUntil(this.destruir$)
    ).subscribe(docs => {
      this.documentos = docs;
      this.cargandoDocs = false;
    });
  }

  obtenerSeguroNombre(tipo: string): string {
    if (!this.afiliado?.seguros) return '';
    const seg = this.afiliado.seguros.find((s: any) => s.tipo === tipo);
    return seg?.nombre || '';
  }

  claseBadge(estado: string): string {
    const mapa: Record<string, string> = { ACTIVO: 'badge-activo', RETIRADO: 'badge-retirado', SUSPENDIDO: 'badge-suspendido' };
    return mapa[estado] ?? '';
  }

  // ── EDICIÓN ──────────────────────────────────────────────
  activarEdicion(): void {
    if (!this.afiliado) return;
    this.edicionForm = { ...this.afiliado };
    this.motivoEdicion = '';
    this.modoEdicion = true;
    this.mensajeExito = '';
    this.mensajeError = '';
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.edicionForm = {};
    this.motivoEdicion = '';
  }

  guardarEdicion(): void {
    if (this.esSecretaria && !this.motivoEdicion.trim()) {
      this.mensajeError = 'Debe indicar el motivo del cambio para enviar la solicitud.';
      return;
    }

    this.guardandoEdicion = true;
    this.mensajeError = '';

    if (this.esSecretaria) {
      // Secretaria: crea solicitud de cambio
      this.solicitudesServicio.crear({
        tipo: 'EDICION',
        tabla: 'afiliados',
        registroId: this.afiliadoId,
        motivo: this.motivoEdicion,
        datosOriginales: this.afiliado,
        datosNuevos: this.edicionForm,
      }).pipe(
        catchError(err => {
          this.mensajeError = 'Error al enviar la solicitud. Intente nuevamente.';
          return of(null);
        }),
        finalize(() => { this.guardandoEdicion = false; })
      ).subscribe(res => {
        if (res) {
          this.mensajeExito = 'Solicitud de cambio enviada correctamente. Pendiente de aprobación.';
          this.modoEdicion = false;
        }
      });
    } else {
      // Admin: actualiza directamente
      const motivo = this.motivoEdicion || 'Actualización desde panel de administración';
      this.afiliadosServicio.actualizar(this.afiliadoId, this.edicionForm, motivo).pipe(
        catchError(err => {
          this.mensajeError = err?.error?.mensaje || 'Error al guardar los cambios. Intente nuevamente.';
          return of(null);
        }),
        finalize(() => { this.guardandoEdicion = false; })
      ).subscribe(af => {
        if (af) {
          this.afiliado = af;
          this.modoEdicion = false;
          this.mensajeExito = 'Datos actualizados correctamente.';
          setTimeout(() => { this.mensajeExito = ''; }, 4000);
        }
      });
    }
  }

  // ── ELIMINACIÓN ───────────────────────────────────────────
  confirmarEliminar(): void {
    if (!this.motivoEliminacion.trim()) {
      this.errorMotivoEliminar = 'El motivo de eliminación es obligatorio.';
      return;
    }
    this.errorMotivoEliminar = '';
    this.eliminando = true;

    if (this.esSecretaria) {
      this.solicitudesServicio.crear({
        tipo: 'ELIMINACION',
        tabla: 'afiliados',
        registroId: this.afiliadoId,
        motivo: this.motivoEliminacion,
        datosOriginales: this.afiliado,
      }).pipe(
        catchError(err => {
          this.mensajeError = 'Error al enviar la solicitud. Intente nuevamente.';
          return of(null);
        }),
        finalize(() => { this.eliminando = false; this.modalEliminar = false; })
      ).subscribe(res => {
        if (res) {
          this.mensajeExito = 'Solicitud de eliminación enviada. Pendiente de aprobación del administrador.';
          this.motivoEliminacion = '';
        }
      });
    } else {
      this.afiliadosServicio.eliminar(this.afiliadoId).pipe(
        catchError(err => {
          this.mensajeError = err?.error?.mensaje || 'Error al eliminar el afiliado.';
          return of(null);
        }),
        finalize(() => { this.eliminando = false; this.modalEliminar = false; })
      ).subscribe(res => {
        if (res !== null) {
          this.router.navigate([this.prefijo, 'afiliados']);
        }
      });
    }
  }

  // ── DOCUMENTOS ────────────────────────────────────────────
  triggerInputArchivo(): void {
    const el = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (el) el.click();
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.arrastrando = true;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.arrastrando = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.subirArchivo(files[0]);
    }
  }

  onArchivoSeleccionado(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.subirArchivo(input.files[0]);
      input.value = '';
    }
  }

  private subirArchivo(archivo: File): void {
    this.subiendoArchivo = true;
    this.progresoSubida = 0;
    this.errorSubida = '';
    this.nombreArchivoSubiendo = archivo.name;

    const ext = archivo.name.split('.').pop() || '';
    const tipo = this.docServicio.esPdf(ext) ? 'OTRO' : (this.docServicio.esImagen(ext) ? 'OTRO' : 'OTRO');

    this.docServicio.subir(this.afiliadoId, archivo, tipo, archivo.name).pipe(
      takeUntil(this.destruir$)
    ).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progresoSubida = Math.round(100 * event.loaded / event.total);
        } else if (event.type === HttpEventType.Response) {
          this.subiendoArchivo = false;
          this.cargarDocumentos();
        }
      },
      error: (err) => {
        this.subiendoArchivo = false;
        this.errorSubida = err?.error?.mensaje || 'Error al subir el archivo. Intente nuevamente.';
      }
    });
  }

  eliminarDocumento(doc: Documento): void {
    if (!confirm(`¿Eliminar el documento "${doc.nombre || doc.nombreOriginal}"?`)) return;
    this.eliminandoDocId = doc.id;
    this.docServicio.eliminar(doc.id).pipe(
      catchError(() => of(null)),
      finalize(() => { this.eliminandoDocId = null; })
    ).subscribe(() => {
      this.documentos = this.documentos.filter(d => d.id !== doc.id);
    });
  }

  abrirDocumento(doc: Documento): void {
    this.docActual = doc;
    if (this.docServicio.esPdf(doc.extension)) {
      // Asignamos directamente — el DomSanitizer se puede usar si se necesita bypassSecurity
      this.urlPdfSeguro = this.docServicio.obtenerUrlVisualizacion(doc.id);
    }
    this.modalDoc = true;
  }

  cerrarModalDoc(): void {
    this.modalDoc = false;
    this.docActual = null;
    this.urlPdfSeguro = null;
  }

  volver(): void {
    this.router.navigate(['/admin/afiliados']);
  }
}
