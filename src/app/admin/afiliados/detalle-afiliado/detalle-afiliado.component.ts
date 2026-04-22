import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'anturi-detalle-afiliado',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div style="padding: var(--espacio-4);">
      <a routerLink="/admin/afiliados" class="boton boton-contorno" style="margin-bottom: var(--espacio-6); display: inline-flex;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        Volver a afiliados
      </a>
      <h2 style="font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal);">Detalle afiliado</h2>
      <p style="color: var(--texto-terciario); margin-top: var(--espacio-3);">
        Conecte el backend para ver el perfil completo del afiliado ID: {{ id }}
      </p>
    </div>
  `
})
export class DetalleAfiliadoComponent {
  id: string | null = null;
  constructor(route: ActivatedRoute) {
    this.id = route.snapshot.paramMap.get('id');
  }
}
