import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, catchError, of, finalize } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { AfiliadosServicio, Afiliado } from '../../../nucleo/servicios/afiliados.servicio';
import { DocumentosServicio, Documento, SlotDocumento } from '../../../nucleo/servicios/documentos.servicio';
import { SolicitudesServicio } from '../../../nucleo/servicios/solicitudes.servicio';
import { AutenticacionServicio } from '../../../nucleo/servicios/autenticacion.servicio';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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
            <div class="dato-item dato-item--ancho" *ngIf="afiliado.observaciones">
              <span class="dato-etiqueta">Notas internas</span>
              <span class="dato-valor dato-valor--nota">{{ afiliado.observaciones }}</span>
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
          <div class="campo-grupo campo-grupo--ancho">
            <label class="campo-etiqueta">Notas internas</label>
            <textarea class="campo-input campo-textarea" [(ngModel)]="edicionForm.observaciones" name="edit-observaciones" rows="3" placeholder="Notas internas del gestor (lugar de trabajo, recordatorios, etc.)"></textarea>
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

      <!-- SECCIÓN DOCUMENTOS - 4 SLOTS -->
      <div *ngIf="afiliado && !cargando" class="tarjeta seccion-datos">
        <div class="docs-encabezado">
          <h3 class="seccion-titulo">Documentos</h3>
          <span *ngIf="!cargandoDocs && slots.length" class="docs-resumen"
            [class.docs-resumen--ok]="slotsCompletos === slots.length"
            [class.docs-resumen--parcial]="slotsCompletos < slots.length">
            {{ slotsCompletos }}/{{ slots.length }} completados
          </span>
        </div>

        <!-- Cargando slots -->
        <div *ngIf="cargandoDocs" class="estado-carga" style="padding: var(--espacio-6);">
          <div class="spinner"></div>
        </div>

        <!-- Grid de slots -->
        <div *ngIf="!cargandoDocs" class="slots-grid">
          <div
            *ngFor="let slot of slots"
            class="slot-doc"
            [class.slot-doc--ok]="slot.presente"
            [class.slot-doc--falta]="!slot.presente"
          >
            <!-- Ícono estado -->
            <div class="slot-doc__icono">
              <svg *ngIf="slot.presente" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20" style="color: #16a34a;">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <svg *ngIf="!slot.presente" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20" style="color: #dc2626;">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>

            <!-- Info del slot -->
            <div class="slot-doc__info">
              <span class="slot-doc__label">{{ slot.label }}</span>
              <span *ngIf="slot.presente && slot.documentos[0]" class="slot-doc__meta slot-doc__meta--ok">
                Subido el {{ slot.documentos[0].creadoEn | date:'dd/MM/yyyy' }}
              </span>
              <span *ngIf="!slot.presente" class="slot-doc__meta slot-doc__meta--falta">
                Pendiente
              </span>
            </div>

            <!-- Acciones -->
            <div class="slot-doc__acciones">
              <!-- Slot con documento -->
              <ng-container *ngIf="slot.presente && slot.documentos[0] as doc">
                <button class="boton boton-icono" title="Ver documento" (click)="abrirDocumento(doc)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
                <button
                  class="boton boton-icono boton-peligro-suave"
                  title="Eliminar documento"
                  (click)="eliminarDocumentoSlot(doc, slot)"
                  [disabled]="eliminandoDocId === doc.id"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  </svg>
                </button>
              </ng-container>

              <!-- Slot sin documento -->
              <ng-container *ngIf="!slot.presente">
                <button class="boton boton-primario boton-sm" (click)="subirParaSlot(slot)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Subir
                </button>
              </ng-container>
            </div>
          </div>
        </div>

        <!-- Input oculto compartido -->
        <input
          type="file"
          id="inputSlotArchivo"
          style="display: none;"
          accept=".pdf,.jpg,.jpeg,.png"
          (change)="onArchivoSlotSeleccionado($event)"
        >

        <!-- Progreso subida -->
        <div *ngIf="subiendoArchivo" class="progreso-subida">
          <span>Subiendo: {{ nombreArchivoSubiendo }}</span>
          <div class="barra-progreso">
            <div class="barra-progreso__relleno" [style.width.%]="progresoSubida"></div>
          </div>
          <span>{{ progresoSubida }}%</span>
        </div>

        <!-- Error subida -->
        <div *ngIf="errorSubida" class="alerta-error" style="margin-top: var(--espacio-3);">
          {{ errorSubida }}
          <button style="margin-left: auto; background: none; border: none; cursor: pointer; color: inherit;" (click)="errorSubida = ''">✕</button>
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
            <p *ngIf="errorDocumento" class="alerta-error">{{ errorDocumento }}</p>
            <img
              *ngIf="!errorDocumento && urlDocSeguro && docActual && docServicio.esImagen(docActual.extension)"
              [src]="urlDocSeguro"
              [alt]="docActual.nombre"
              class="modal-doc__imagen"
            >
            <iframe
              *ngIf="!errorDocumento && urlDocSeguro && docActual && docServicio.esPdf(docActual.extension)"
              [src]="urlDocSeguro"
              class="modal-doc__iframe"
              frameborder="0"
            ></iframe>
          </div>
        </div>
      </div>

      <!-- MODAL: Confirmar eliminación afiliado -->
      <div *ngIf="modalEliminar" class="modal-overlay" (click)="modalEliminar = false">
        <div class="modal-confirm" (click)="$event.stopPropagation()">
          <h3 class="modal-confirm__titulo">Confirmar eliminación</h3>
          <p class="modal-confirm__texto">
            Esta acción eliminará al afiliado <strong>{{ afiliado?.nombres }} {{ afiliado?.apellidos }}</strong>.
          </p>
          <div *ngIf="esSecretaria" class="campo-grupo" style="margin: var(--espacio-4) 0;">
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
    .dato-valor { font-size: var(--tamano-base); color: var(--texto-principal); font-weight: 500; word-break: break-word; overflow-wrap: break-word; }

    .badge-estado { display: inline-flex; align-items: center; padding: 3px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-activo { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-retirado { background: rgba(249,115,22,0.12); color: #c2410c; }
    .badge-suspendido { background: rgba(239,68,68,0.12); color: #b91c1c; }

    /* Edición */
    .edicion-encabezado { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--espacio-3); margin-bottom: var(--espacio-4); }
    .aviso-secretaria { display: flex; align-items: center; gap: var(--espacio-2); font-size: var(--tamano-sm); color: var(--color-advertencia); background: rgba(249,115,22,0.08); padding: var(--espacio-2) var(--espacio-3); border-radius: var(--radio-sm); }
    .campos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .campo-grupo--ancho { grid-column: 1 / -1; }
    .campo-textarea { resize: vertical; min-height: 72px; font-family: inherit; }
    .dato-valor--nota { background: rgba(249,115,22,0.06); border: 1px solid rgba(249,115,22,0.2); border-radius: var(--radio-sm); padding: var(--espacio-2) var(--espacio-3); font-size: var(--tamano-sm); color: var(--texto-secundario); white-space: pre-wrap; }
    .form-acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); }

    /* Documentos - encabezado */
    .docs-encabezado { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--espacio-4); }
    .docs-resumen { font-size: var(--tamano-sm); font-weight: 600; padding: 3px var(--espacio-3); border-radius: var(--radio-full, 9999px); }
    .docs-resumen--ok { background: rgba(34,197,94,0.12); color: #15803d; }
    .docs-resumen--parcial { background: rgba(239,68,68,0.1); color: #b91c1c; }

    /* Slots de documentos */
    .slots-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--espacio-3); }
    .slot-doc { display: flex; align-items: center; gap: var(--espacio-3); padding: var(--espacio-4); border: 2px solid; border-radius: var(--radio-md); transition: var(--transicion-base); }
    .slot-doc--ok { border-color: rgba(34,197,94,0.35); background: rgba(34,197,94,0.04); }
    .slot-doc--falta { border-color: rgba(239,68,68,0.25); background: rgba(239,68,68,0.03); }
    .slot-doc__icono { flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .slot-doc--ok .slot-doc__icono { background: rgba(34,197,94,0.14); }
    .slot-doc--falta .slot-doc__icono { background: rgba(239,68,68,0.1); }
    .slot-doc__info { flex: 1; min-width: 0; }
    .slot-doc__label { display: block; font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-principal); }
    .slot-doc__meta { display: block; font-size: 0.72rem; margin-top: 3px; }
    .slot-doc__meta--ok { color: #16a34a; }
    .slot-doc__meta--falta { color: #dc2626; }
    .slot-doc__acciones { display: flex; gap: var(--espacio-1); flex-shrink: 0; }
    .boton-peligro-suave { color: var(--color-error); }
    .boton-peligro-suave:hover { background: rgba(239,68,68,0.08); }
    .boton-sm { font-size: var(--tamano-sm); padding: var(--espacio-1) var(--espacio-3); display: flex; align-items: center; gap: var(--espacio-1); }

    /* Progreso subida */
    .progreso-subida { display: flex; align-items: center; gap: var(--espacio-3); margin-top: var(--espacio-4); font-size: var(--tamano-sm); color: var(--texto-secundario); }
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
  slots: SlotDocumento[] = [];
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

  // Eliminación afiliado
  modalEliminar = false;
  motivoEliminacion = '';
  errorMotivoEliminar = '';
  eliminando = false;

  // Documentos
  tipoSlotActual = '';
  subiendoArchivo = false;
  progresoSubida = 0;
  nombreArchivoSubiendo = '';
  errorSubida = '';
  eliminandoDocId: number | null = null;

  // Modal documento - urlDocSeguro sirve tanto a <img> como a <iframe>: se
  // obtiene el archivo autenticado como Blob (ver abrirDocumento()) y se
  // sanitiza el object URL resultante, nunca la URL directa del backend.
  modalDoc = false;
  docActual: Documento | null = null;
  urlDocSeguro: SafeResourceUrl | null = null;
  errorDocumento = '';
  private objectUrlActual: string | null = null;

  private destruir$ = new Subject<void>();
  private afiliadoId!: number;

  get esSecretaria(): boolean {
    return this.auth.tieneRol(['SECRETARIA']);
  }

  get esAdmin(): boolean {
    return this.auth.tieneRol(['ADMIN', 'SUPER_ADMIN']);
  }

  get slotsCompletos(): number {
    return this.slots.filter(s => s.presente).length;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private afiliadosServicio: AfiliadosServicio,
    public docServicio: DocumentosServicio,
    private solicitudesServicio: SolicitudesServicio,
    private auth: AutenticacionServicio,
    private sanitizer: DomSanitizer
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
    this.liberarUrlDocumento();
  }

  cargarAfiliado(): void {
    this.cargando = true;
    this.errorCarga = '';
    this.afiliadosServicio.obtener(this.afiliadoId).pipe(
      catchError(() => {
        this.errorCarga = 'No se pudo cargar el afiliado. Verifique la conexión.';
        return of(null);
      }),
      takeUntil(this.destruir$)
    ).subscribe(af => {
      this.cargando = false;
      if (af) {
        this.afiliado = af;
        this.cargarCompletitud();
      }
    });
  }

  cargarCompletitud(): void {
    this.cargandoDocs = true;
    this.docServicio.completitudAfiliado(this.afiliadoId).pipe(
      catchError(() => of([])),
      takeUntil(this.destruir$)
    ).subscribe(slots => {
      this.slots = slots;
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
      this.solicitudesServicio.crear({
        tipo: 'EDICION',
        tabla: 'afiliados',
        registroId: this.afiliadoId,
        motivo: this.motivoEdicion,
        datosOriginales: this.afiliado,
        datosNuevos: this.edicionForm,
      }).pipe(
        catchError(() => {
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
      const motivo = this.motivoEdicion || 'Actualización desde panel de administración';
      this.afiliadosServicio.actualizar(this.afiliadoId, this.edicionForm, motivo).pipe(
        catchError((err: any) => {
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

  // ── ELIMINACIÓN AFILIADO ──────────────────────────────────
  confirmarEliminar(): void {
    if (this.esSecretaria && !this.motivoEliminacion.trim()) {
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
        catchError(() => {
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
        catchError((err: any) => {
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

  // ── DOCUMENTOS - SLOTS ────────────────────────────────────
  subirParaSlot(slot: SlotDocumento): void {
    this.tipoSlotActual = slot.tipo;
    const el = document.getElementById('inputSlotArchivo') as HTMLInputElement;
    if (el) el.click();
  }

  onArchivoSlotSeleccionado(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0 && this.tipoSlotActual) {
      this.subirArchivo(input.files[0]);
      input.value = '';
    }
  }

  private subirArchivo(archivo: File): void {
    this.subiendoArchivo = true;
    this.progresoSubida = 0;
    this.errorSubida = '';
    this.nombreArchivoSubiendo = archivo.name;

    this.docServicio.subir(this.afiliadoId, archivo, this.tipoSlotActual, archivo.name).pipe(
      takeUntil(this.destruir$)
    ).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progresoSubida = Math.round(100 * event.loaded / event.total);
        } else if (event.type === HttpEventType.Response) {
          this.subiendoArchivo = false;
          this.tipoSlotActual = '';
          this.cargarCompletitud();
        }
      },
      error: (err: any) => {
        this.subiendoArchivo = false;
        this.tipoSlotActual = '';
        this.errorSubida = err?.error?.mensaje || 'Error al subir el archivo. Intente nuevamente.';
      }
    });
  }

  eliminarDocumentoSlot(doc: Documento, slot: SlotDocumento): void {
    if (!confirm(`¿Eliminar "${slot.label}"?`)) return;
    this.eliminandoDocId = doc.id;
    this.docServicio.eliminar(doc.id).pipe(
      catchError(() => of(null)),
      finalize(() => { this.eliminandoDocId = null; })
    ).subscribe(() => {
      this.cargarCompletitud();
    });
  }

  // Visor autenticado (Bloque 2): GET /documentos/:id/ver exige JWT por
  // header, así que un <img>/<iframe> con la URL directa nunca podía
  // autenticarse - no hay mecanismo alternativo en el backend (investigado
  // antes de este cambio, ver documentos.controlador.ts). Se pide el
  // archivo vía HttpClient (con el interceptor de token ya existente) como
  // Blob, y se muestra desde un object URL local - mismo endpoint, mismas
  // guardias, mismos permisos, el JWT nunca viaja en ninguna URL.
  abrirDocumento(doc: Documento): void {
    this.docActual = doc;
    this.errorDocumento = '';
    this.modalDoc = true;
    this.docServicio.obtenerBlobVisualizacion(doc.id).pipe(
      takeUntil(this.destruir$)
    ).subscribe({
      next: (blob) => {
        this.liberarUrlDocumento();
        this.objectUrlActual = URL.createObjectURL(blob);
        this.urlDocSeguro = this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrlActual);
      },
      error: () => {
        this.errorDocumento = 'No se pudo cargar el documento. Intente nuevamente.';
      }
    });
  }

  cerrarModalDoc(): void {
    this.modalDoc = false;
    this.docActual = null;
    this.urlDocSeguro = null;
    this.errorDocumento = '';
    this.liberarUrlDocumento();
  }

  private liberarUrlDocumento(): void {
    if (this.objectUrlActual) {
      URL.revokeObjectURL(this.objectUrlActual);
      this.objectUrlActual = null;
    }
  }

  volver(): void {
    this.router.navigate([this.prefijo, 'afiliados']);
  }
}
