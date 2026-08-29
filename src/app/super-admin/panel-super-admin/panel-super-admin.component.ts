import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TemaServicio } from '../../nucleo/servicios/tema.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

@Component({
  selector: 'anturi-panel-super-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div style="min-height: 100vh; display: flex; flex-direction: column;">
      <header style="display: flex; align-items: center; justify-content: space-between; height: 64px; padding: 0 var(--espacio-6); background: var(--fondo-tarjeta); border-bottom: 1px solid var(--borde-color); box-shadow: var(--sombra-sm);">
        <div style="display: flex; align-items: center; gap: var(--espacio-3);">
          <img src="/assets/imagenes/logo.png" alt="Anturi" style="height: 36px;">
          <span style="font-family: var(--fuente-titulos); font-weight: 800; color: var(--color-primario);">ANTURI — Super Admin</span>
        </div>
        <div style="display: flex; gap: var(--espacio-3);">
          <button class="boton-tema" (click)="temaServicio.alternar()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icono-tema">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
          <a routerLink="/admin" class="boton boton-primario" style="font-size: var(--tamano-sm);">Ir a Admin</a>
          <button class="boton boton-peligro" style="font-size: var(--tamano-sm);" (click)="auth.cerrarSesion()">Salir</button>
        </div>
      </header>
      <main style="flex: 1; padding: var(--espacio-8) var(--espacio-6); max-width: 1280px; margin: 0 auto; width: 100%;">
        <h2 style="font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin-bottom: var(--espacio-6);">Panel Super Administrador</h2>
        <div class="tarjeta" style="padding: var(--espacio-8); color: var(--texto-terciario);">
          <!-- HALLAZGO (29/08): decía "Conecte el backend para habilitar todas
               las funcionalidades" - texto de cuando el backend todavía no
               existía. El backend ya funciona; lo que falta acá es una
               pantalla propia de Super Admin (auditoría, correo, etc.), no
               una conexión. Se corrige el texto para no confundir a quien
               entre a probar el sistema hoy. -->
          <p>Como Super Admin tenés acceso global a todo lo que ya existe en el panel de Admin (empresas, sucursales, afiliados, documentos, usuarios, solicitudes) usando el botón "Ir a Admin".</p>
          <p style="margin-top: var(--espacio-4);">Todavía no hay pantallas exclusivas de Super Admin construidas para:</p>
          <ul style="margin-top: var(--espacio-2); padding-left: var(--espacio-6); display: flex; flex-direction: column; gap: var(--espacio-2);">
            <li>Configuración global del sistema</li>
            <li>Logs de auditoría completos</li>
            <li>Configuración del servidor de correo</li>
          </ul>
          <p style="margin-top: var(--espacio-6);">Esto queda pendiente de diseño — no se construye hasta decidir qué necesita ser exclusivo de Super Admin.</p>
        </div>
      </main>
    </div>
  `
})
export class PanelSuperAdminComponent {
  constructor(public temaServicio: TemaServicio, public auth: AutenticacionServicio) {}
}
