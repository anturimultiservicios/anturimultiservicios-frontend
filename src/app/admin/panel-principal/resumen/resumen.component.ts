import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'anturi-resumen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="resumen-pagina">
      <h2 class="resumen-titulo">Resumen</h2>
      <div class="resumen-tarjetas">
        <div class="resumen-tarjeta tarjeta">
          <div class="resumen-tarjeta__icono resumen-tarjeta__icono-empresas">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="2" y="7" width="20" height="14" rx="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
          </div>
          <div>
            <p class="resumen-tarjeta__numero">—</p>
            <p class="resumen-tarjeta__titulo">Empresas activas</p>
          </div>
        </div>
        <div class="resumen-tarjeta tarjeta">
          <div class="resumen-tarjeta__icono resumen-tarjeta__icono-afiliados">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div>
            <p class="resumen-tarjeta__numero">—</p>
            <p class="resumen-tarjeta__titulo">Afiliados activos</p>
          </div>
        </div>
        <div class="resumen-tarjeta tarjeta">
          <div class="resumen-tarjeta__icono resumen-tarjeta__icono-vencidos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div>
            <p class="resumen-tarjeta__numero">—</p>
            <p class="resumen-tarjeta__titulo">Seguros por vencer</p>
          </div>
        </div>
        <div class="resumen-tarjeta tarjeta">
          <div class="resumen-tarjeta__icono resumen-tarjeta__icono-pagos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
          </div>
          <div>
            <p class="resumen-tarjeta__numero">—</p>
            <p class="resumen-tarjeta__titulo">Pagos este mes</p>
          </div>
        </div>
      </div>
      <p class="resumen-info">Conecte el backend para ver estadísticas en tiempo real.</p>
    </div>
  `,
  styles: [`
    .resumen-pagina { display: flex; flex-direction: column; gap: var(--espacio-6); }
    .resumen-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); }
    .resumen-tarjetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--espacio-4); }
    .resumen-tarjeta { display: flex; align-items: center; gap: var(--espacio-4); padding: var(--espacio-6); }
    .resumen-tarjeta__icono { width: 52px; height: 52px; border-radius: var(--radio-xl); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .resumen-tarjeta__icono svg { width: 26px; height: 26px; }
    .resumen-tarjeta__icono-empresas { background: rgba(27,50,112,0.1); color: var(--color-primario); }
    .resumen-tarjeta__icono-afiliados { background: rgba(21,101,192,0.1); color: var(--color-info); }
    .resumen-tarjeta__icono-vencidos { background: rgba(198,40,40,0.1); color: var(--color-error); }
    .resumen-tarjeta__icono-pagos { background: rgba(46,125,50,0.1); color: var(--color-exito); }
    .resumen-tarjeta__numero { font-family: var(--fuente-titulos); font-size: var(--tamano-3xl); font-weight: 800; color: var(--texto-principal); line-height: 1; margin: 0; }
    .resumen-tarjeta__titulo { font-size: var(--tamano-sm); color: var(--texto-terciario); margin: var(--espacio-1) 0 0; }
    .resumen-info { color: var(--texto-terciario); font-size: var(--tamano-sm); }
  `]
})
export class ResumenComponent {}
