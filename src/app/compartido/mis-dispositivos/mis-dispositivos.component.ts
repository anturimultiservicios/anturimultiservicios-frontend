import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { DispositivosServicio, DispositivoUsuario } from '../../nucleo/servicios/dispositivos.servicio';
import {
  opcionesRegistroACredentialOptions,
  credencialRegistroARespuesta,
  opcionesAutenticacionACredentialOptions,
  credencialAutenticacionARespuesta,
} from '../../nucleo/utilidades/webauthn.util';

@Component({
  selector: 'anturi-mis-dispositivos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pagina-lista">
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Mis dispositivos</h2>
        <button class="boton boton-primario" (click)="iniciarRegistro()" [disabled]="registrando">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Registrar este dispositivo
        </button>
      </div>

      <p style="color: var(--texto-terciario); margin-bottom: var(--espacio-4);">
        Registrá el equipo desde el que estás entrando ahora. Un dispositivo nuevo queda <strong>pendiente</strong>
        hasta que alguien con permiso lo apruebe. Esto todavía no cambia cómo entrás al sistema.
      </p>

      <div *ngIf="mensajeExito" class="alerta-exito">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>
        {{ mensajeExito }}
      </div>
      <div *ngIf="mensajeError" class="alerta-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        {{ mensajeError }}
      </div>

      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando dispositivos...</p>
      </div>

      <div *ngIf="!cargando && dispositivos.length === 0" class="tarjeta estado-vacio">
        <p style="color: var(--texto-terciario);">Todavía no registraste ningún dispositivo.</p>
      </div>

      <div *ngIf="!cargando && dispositivos.length > 0" class="tarjeta tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Sistema / navegador</th>
              <th>Solicitado</th>
              <th>Último uso</th>
              <th>Confirmar</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let d of dispositivos" class="fila-tabla">
              <td>{{ d.nombre || '(sin nombre)' }}</td>
              <td>
                <span class="etiqueta-estado" [ngClass]="claseEstado(d.estado)">{{ d.estado }}</span>
              </td>
              <td>{{ d.sistemaOperativo || '?' }} / {{ d.navegador || '?' }}</td>
              <td>{{ d.fechaSolicitud | date:'short' }}</td>
              <td>{{ d.ultimoUso ? (d.ultimoUso | date:'short') : '—' }}</td>
              <td>
                <button
                  *ngIf="d.estado === 'PENDIENTE'"
                  class="boton boton-secundario"
                  style="font-size: var(--tamano-sm);"
                  [disabled]="confirmandoId === d.id || !hayOtroAutorizado"
                  [title]="!hayOtroAutorizado ? 'Necesitás otro dispositivo ya autorizado para confirmar este' : 'Confirmar con un dispositivo ya autorizado'"
                  (click)="confirmarConExistente(d)"
                >
                  {{ confirmandoId === d.id ? 'Confirmando...' : 'Confirmar con otro dispositivo' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .etiqueta-estado { padding: 2px 10px; border-radius: 999px; font-size: var(--tamano-sm); font-weight: 600; }
    .estado-pendiente { background: rgba(217,119,6,0.12); color: #b45309; }
    .estado-autorizado { background: rgba(5,150,105,0.12); color: #047857; }
    .estado-revocado { background: rgba(220,38,38,0.12); color: #b91c1c; }
    .estado-bloqueado { background: rgba(107,114,128,0.15); color: #4b5563; }
  `],
})
export class MisDispositivosComponent implements OnInit {
  dispositivos: DispositivoUsuario[] = [];
  cargando = false;
  registrando = false;
  confirmandoId: number | null = null;
  mensajeExito = '';
  mensajeError = '';

  constructor(private dispositivosServicio: DispositivosServicio) {}

  ngOnInit(): void {
    this.cargar();
  }

  get hayOtroAutorizado(): boolean {
    return this.dispositivos.some((d) => d.estado === 'AUTORIZADO');
  }

  cargar(): void {
    this.cargando = true;
    this.dispositivosServicio
      .misDispositivos()
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (lista) => (this.dispositivos = lista),
        error: () => (this.mensajeError = 'No se pudieron cargar tus dispositivos.'),
      });
  }

  async iniciarRegistro(): Promise<void> {
    this.mensajeError = '';
    this.mensajeExito = '';
    if (!window.PublicKeyCredential) {
      this.mensajeError = 'Este navegador no soporta el registro de dispositivos (WebAuthn).';
      return;
    }
    this.registrando = true;
    try {
      const opciones = await this.dispositivosServicio.registrarInicio().toPromise();
      const credential = (await navigator.credentials.create(
        opcionesRegistroACredentialOptions(opciones)
      )) as PublicKeyCredential;
      const respuesta = credencialRegistroARespuesta(credential);
      const nombreSugerido = window.prompt('Nombre para este dispositivo (ej: "PC de la oficina"):') || undefined;
      await this.dispositivosServicio.registrarCompletar(respuesta, nombreSugerido).toPromise();
      this.mensajeExito = 'Dispositivo registrado. Queda pendiente hasta que alguien lo apruebe.';
      this.cargar();
    } catch (e: any) {
      this.mensajeError = e?.error?.message || e?.message || 'No se pudo registrar el dispositivo.';
    } finally {
      this.registrando = false;
    }
  }

  async confirmarConExistente(dispositivo: DispositivoUsuario): Promise<void> {
    this.mensajeError = '';
    this.mensajeExito = '';
    this.confirmandoId = dispositivo.id;
    try {
      const opciones = await this.dispositivosServicio.iniciarConfirmacionConExistente().toPromise();
      const credential = (await navigator.credentials.get(
        opcionesAutenticacionACredentialOptions(opciones)
      )) as PublicKeyCredential;
      const respuesta = credencialAutenticacionARespuesta(credential);
      await this.dispositivosServicio.completarConfirmacionConExistente(respuesta, dispositivo.id).toPromise();
      this.mensajeExito = `"${dispositivo.nombre}" quedó autorizado.`;
      this.cargar();
    } catch (e: any) {
      this.mensajeError = e?.error?.message || e?.message || 'No se pudo confirmar el dispositivo.';
    } finally {
      this.confirmandoId = null;
    }
  }

  claseEstado(estado: string): string {
    return 'estado-' + estado.toLowerCase();
  }
}