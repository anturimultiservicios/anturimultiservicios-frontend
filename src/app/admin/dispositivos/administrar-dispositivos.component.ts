import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { DispositivosServicio, DispositivoUsuario } from '../../nucleo/servicios/dispositivos.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

type AccionPendiente = 'aprobar' | 'rechazar' | 'revocar';

@Component({
  selector: 'anturi-administrar-dispositivos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pagina-lista">
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Administrar dispositivos</h2>
        <div style="display:flex; gap: var(--espacio-3);">
          <button class="boton boton-secundario" (click)="verTodos = false; cargar()" [class.boton-primario]="!verTodos">Pendientes</button>
          <button *ngIf="esSuperAdmin" class="boton boton-secundario" (click)="verTodos = true; cargar()" [class.boton-primario]="verTodos">Todos</button>
        </div>
      </div>

      <p style="color: var(--texto-terciario); margin-bottom: var(--espacio-4);">
        Aprobar/rechazar/revocar acá tiene efecto real e inmediato en el dispositivo — queda auditado con motivo.
        Este panel reemplaza la aprobación temporal por API usada durante el bootstrap inicial.
      </p>

      <div *ngIf="mensajeExito" class="alerta-exito">{{ mensajeExito }}</div>
      <div *ngIf="mensajeError" class="alerta-error">{{ mensajeError }}</div>

      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando...</p>
      </div>

      <div *ngIf="!cargando && dispositivos.length === 0" class="tarjeta estado-vacio">
        <p style="color: var(--texto-terciario);">{{ verTodos ? 'No hay dispositivos registrados.' : 'No hay dispositivos pendientes de aprobación.' }}</p>
      </div>

      <div *ngIf="!cargando && dispositivos.length > 0" class="tarjeta tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Dispositivo</th>
              <th>Estado</th>
              <th>Solicitado</th>
              <th *ngIf="verTodos">Autorizado por</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let d of dispositivos" class="fila-tabla">
              <td>{{ d.usuario?.nombre }} {{ d.usuario?.apellido }}<br><span style="color: var(--texto-terciario); font-size: var(--tamano-sm);">{{ d.usuario?.correo }}</span></td>
              <td>{{ d.usuario?.rol }}</td>
              <td>{{ d.nombre || '(sin nombre)' }}<br><span style="color: var(--texto-terciario); font-size: var(--tamano-sm);">{{ d.sistemaOperativo }} / {{ d.navegador }}</span></td>
              <td>{{ d.estado }}</td>
              <td>{{ d.fechaSolicitud | date:'short' }}</td>
              <td *ngIf="verTodos">{{ d.autorizadoPor ? (d.autorizadoPor.nombre + ' ' + d.autorizadoPor.apellido) : '—' }}</td>
              <td style="display:flex; gap: var(--espacio-2);">
                <button *ngIf="d.estado === 'PENDIENTE'" class="boton boton-primario" style="font-size: var(--tamano-sm);" (click)="abrirModal(d, 'aprobar')">Aprobar</button>
                <button *ngIf="d.estado === 'PENDIENTE'" class="boton boton-secundario" style="font-size: var(--tamano-sm);" (click)="abrirModal(d, 'rechazar')">Rechazar</button>
                <button *ngIf="d.estado === 'AUTORIZADO'" class="boton boton-peligro" style="font-size: var(--tamano-sm);" (click)="abrirModal(d, 'revocar')">Revocar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal de motivo -->
    <div *ngIf="modalAbierto" class="modal-overlay" (click)="cerrarModal()">
      <div class="modal-form" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-titulo">{{ tituloAccion() }}</h3>
          <button class="boton boton-icono" (click)="cerrarModal()">×</button>
        </div>
        <div class="modal-cuerpo">
          <p style="margin-bottom: var(--espacio-3);">
            Dispositivo: <strong>{{ dispositivoSeleccionado?.nombre || '(sin nombre)' }}</strong><br>
            Usuario: <strong>{{ dispositivoSeleccionado?.usuario?.correo }}</strong>
          </p>
          <label>Motivo (obligatorio, mínimo 10 caracteres)</label>
          <textarea [(ngModel)]="motivo" rows="3" style="width:100%; padding: var(--espacio-3); border-radius: var(--radio-md); border: 1px solid var(--borde-color);"></textarea>
          <div *ngIf="errorModal" class="alerta-error" style="margin-top: var(--espacio-3);">{{ errorModal }}</div>
        </div>
        <div class="modal-pie">
          <button class="boton boton-secundario" (click)="cerrarModal()" [disabled]="guardando">Cancelar</button>
          <button class="boton boton-primario" (click)="confirmarAccion()" [disabled]="guardando || motivo.trim().length < 10">
            {{ guardando ? 'Guardando...' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AdministrarDispositivosComponent implements OnInit {
  dispositivos: DispositivoUsuario[] = [];
  cargando = false;
  verTodos = false;
  esSuperAdmin = false;
  mensajeExito = '';
  mensajeError = '';

  modalAbierto = false;
  dispositivoSeleccionado: DispositivoUsuario | null = null;
  accionSeleccionada: AccionPendiente | null = null;
  motivo = '';
  guardando = false;
  errorModal = '';

  constructor(private dispositivosServicio: DispositivosServicio, private auth: AutenticacionServicio) {}

  ngOnInit(): void {
    this.esSuperAdmin = this.auth.tieneRol(['SUPER_ADMIN']);
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.mensajeExito = '';
    const obs = this.verTodos ? this.dispositivosServicio.listarTodos() : this.dispositivosServicio.listarPendientes();
    obs.pipe(finalize(() => (this.cargando = false))).subscribe({
      next: (lista) => (this.dispositivos = lista),
      error: () => (this.mensajeError = 'No se pudieron cargar los dispositivos.'),
    });
  }

  abrirModal(d: DispositivoUsuario, accion: AccionPendiente): void {
    this.dispositivoSeleccionado = d;
    this.accionSeleccionada = accion;
    this.motivo = '';
    this.errorModal = '';
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.dispositivoSeleccionado = null;
    this.accionSeleccionada = null;
  }

  tituloAccion(): string {
    if (this.accionSeleccionada === 'aprobar') return 'Aprobar dispositivo';
    if (this.accionSeleccionada === 'rechazar') return 'Rechazar dispositivo';
    if (this.accionSeleccionada === 'revocar') return 'Revocar dispositivo';
    return '';
  }

  confirmarAccion(): void {
    if (!this.dispositivoSeleccionado || !this.accionSeleccionada) return;
    if (this.motivo.trim().length < 10) {
      this.errorModal = 'El motivo debe tener al menos 10 caracteres.';
      return;
    }
    this.guardando = true;
    this.errorModal = '';
    const id = this.dispositivoSeleccionado.id;
    const obs =
      this.accionSeleccionada === 'aprobar'
        ? this.dispositivosServicio.aprobar(id, this.motivo)
        : this.accionSeleccionada === 'rechazar'
        ? this.dispositivosServicio.rechazar(id, this.motivo)
        : this.dispositivosServicio.revocar(id, this.motivo);

    obs.pipe(finalize(() => (this.guardando = false))).subscribe({
      next: () => {
        this.mensajeExito = `Dispositivo ${this.accionSeleccionada === 'aprobar' ? 'aprobado' : this.accionSeleccionada === 'rechazar' ? 'rechazado' : 'revocado'} correctamente.`;
        this.cerrarModal();
        this.cargar();
      },
      error: (err) => (this.errorModal = err?.error?.message || 'No se pudo completar la acción.'),
    });
  }
}