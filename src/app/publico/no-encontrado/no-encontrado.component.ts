import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'anturi-no-encontrado',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: var(--espacio-6); text-align: center; padding: var(--espacio-8);">
      <div style="font-size: 6rem; font-weight: 800; color: var(--color-primario); font-family: var(--fuente-titulos); line-height: 1;">404</div>
      <h2 style="font-size: var(--tamano-2xl); color: var(--texto-principal);">Página no encontrada</h2>
      <p style="color: var(--texto-terciario); max-width: 400px;">La página que busca no existe o ha sido movida.</p>
      <a routerLink="/" class="boton boton-primario">Volver al inicio</a>
    </div>
  `
})
export class NoEncontradoComponent {}
