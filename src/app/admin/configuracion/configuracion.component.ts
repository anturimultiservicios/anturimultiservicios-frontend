import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

@Component({
  selector: 'anturi-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="display: flex; flex-direction: column; gap: var(--espacio-6);">
      <h2 style="font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal);">Configuración</h2>
      <div class="tarjeta" style="padding: var(--espacio-8);">
        <h3 style="font-size: var(--tamano-xl); font-weight: 600; color: var(--texto-principal); margin-bottom: var(--espacio-4);">Mi perfil</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--espacio-4);">
          <div class="campo-grupo">
            <label class="campo-etiqueta">Nombre</label>
            <input class="campo-input" [value]="auth.usuarioActual?.nombre ?? ''" readonly>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Apellido</label>
            <input class="campo-input" [value]="auth.usuarioActual?.apellido ?? ''" readonly>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Correo electrónico</label>
            <input class="campo-input" [value]="auth.usuarioActual?.correo ?? ''" readonly>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Rol</label>
            <input class="campo-input" [value]="auth.usuarioActual?.rol ?? ''" readonly>
          </div>
        </div>
        <p style="color: var(--texto-terciario); font-size: var(--tamano-sm); margin-top: var(--espacio-4);">
          Para modificar su perfil, conecte el backend con los endpoints correspondientes.
        </p>
      </div>
    </div>
  `
})
export class ConfiguracionComponent {
  constructor(public auth: AutenticacionServicio) {}
}
