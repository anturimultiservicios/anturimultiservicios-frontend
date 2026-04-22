import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'anturi-lista-afiliados',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="pagina-lista">
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Afiliados</h2>
        <button class="boton boton-primario">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Nuevo afiliado
        </button>
      </div>
      <div class="tarjeta pagina-filtros">
        <input type="text" class="campo-input" placeholder="Buscar por nombre, cédula o empresa...">
      </div>
      <div class="tarjeta" style="padding: var(--espacio-8); text-align: center; color: var(--texto-terciario);">
        Conecte el backend para ver los afiliados registrados.
      </div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); }
    .pagina-filtros { padding: var(--espacio-4); }
  `]
})
export class ListaAfiliadosComponent {}
