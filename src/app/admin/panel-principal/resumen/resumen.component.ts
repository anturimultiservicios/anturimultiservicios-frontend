import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AfiliadosServicio } from '../../../nucleo/servicios/afiliados.servicio';
import { EmpresasServicio } from '../../../nucleo/servicios/empresas.servicio';
import { SolicitudesServicio } from '../../../nucleo/servicios/solicitudes.servicio';

@Component({
  selector: 'anturi-resumen',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="resumen-pagina">
      <h2 class="resumen-titulo">Resumen general</h2>

      <!-- Tarjetas de estadísticas -->
      <div class="resumen-tarjetas">
        <div class="resumen-tarjeta tarjeta">
          <div class="resumen-tarjeta__icono icono-afiliados">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="26" height="26">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <p class="resumen-tarjeta__numero">{{ cargando ? '...' : stats.afiliadosActivos }}</p>
            <p class="resumen-tarjeta__etiqueta">Afiliados activos</p>
          </div>
        </div>

        <div class="resumen-tarjeta tarjeta">
          <div class="resumen-tarjeta__icono icono-retirados">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="26" height="26">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
              <line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/>
            </svg>
          </div>
          <div>
            <p class="resumen-tarjeta__numero">{{ cargando ? '...' : stats.afiliadosRetirados }}</p>
            <p class="resumen-tarjeta__etiqueta">Afiliados retirados</p>
          </div>
        </div>

        <div class="resumen-tarjeta tarjeta">
          <div class="resumen-tarjeta__icono icono-empresas">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="26" height="26">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          </div>
          <div>
            <p class="resumen-tarjeta__numero">{{ cargando ? '...' : stats.empresasActivas }}</p>
            <p class="resumen-tarjeta__etiqueta">Empresas activas</p>
          </div>
        </div>

        <div class="resumen-tarjeta tarjeta" [class.resumen-tarjeta--alerta]="stats.solicitudesPendientes > 0">
          <div class="resumen-tarjeta__icono icono-solicitudes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="26" height="26">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <div>
            <p class="resumen-tarjeta__numero">{{ cargando ? '...' : stats.solicitudesPendientes }}</p>
            <p class="resumen-tarjeta__etiqueta">Solicitudes pendientes</p>
          </div>
          <a *ngIf="stats.solicitudesPendientes > 0" routerLink="/admin/solicitudes" class="resumen-tarjeta__link">
            Ver →
          </a>
        </div>
      </div>

      <!-- Accesos rápidos -->
      <div class="accesos-rapidos">
        <h3 class="accesos-rapidos__titulo">Accesos rápidos</h3>
        <div class="accesos-rapidos__grid">
          <a routerLink="/admin/afiliados/nuevo" class="acceso-rapido tarjeta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Nuevo afiliado</span>
          </a>
          <a routerLink="/admin/afiliados" class="acceso-rapido tarjeta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span>Buscar afiliado</span>
          </a>
          <a routerLink="/admin/empresas" class="acceso-rapido tarjeta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <span>Ver empresas</span>
          </a>
          <a routerLink="/admin/solicitudes" class="acceso-rapido tarjeta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
              <polyline points="9 11 12 14 22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <span>Solicitudes</span>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .resumen-pagina { display: flex; flex-direction: column; gap: var(--espacio-7); }
    .resumen-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .resumen-tarjetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: var(--espacio-4); }
    .resumen-tarjeta { display: flex; align-items: center; gap: var(--espacio-4); padding: var(--espacio-5); position: relative; }
    .resumen-tarjeta--alerta { border-left: 3px solid var(--color-advertencia); }
    .resumen-tarjeta__icono { width: 52px; height: 52px; border-radius: var(--radio-xl); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .icono-afiliados { background: rgba(21,101,192,0.12); color: var(--color-info); }
    .icono-retirados { background: rgba(198,40,40,0.10); color: var(--color-error); }
    .icono-empresas { background: rgba(27,50,112,0.12); color: var(--color-primario); }
    .icono-solicitudes { background: rgba(230,126,34,0.12); color: var(--color-advertencia); }
    .resumen-tarjeta__numero { font-size: 2.2rem; font-weight: 800; color: var(--texto-principal); line-height: 1; margin: 0; }
    .resumen-tarjeta__etiqueta { font-size: var(--tamano-sm); color: var(--texto-terciario); margin: var(--espacio-1) 0 0; }
    .resumen-tarjeta__link { position: absolute; top: var(--espacio-3); right: var(--espacio-4); font-size: var(--tamano-sm); color: var(--color-primario); text-decoration: none; font-weight: 600; }
    .accesos-rapidos__titulo { font-size: var(--tamano-lg); font-weight: 600; color: var(--texto-principal); margin: 0 0 var(--espacio-4); }
    .accesos-rapidos__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--espacio-3); }
    .acceso-rapido { display: flex; align-items: center; gap: var(--espacio-3); padding: var(--espacio-4) var(--espacio-5); text-decoration: none; color: var(--texto-principal); font-weight: 500; font-size: var(--tamano-sm); transition: var(--transicion-base); }
    .acceso-rapido:hover { color: var(--color-primario); transform: translateY(-2px); }
    .acceso-rapido svg { color: var(--color-primario); flex-shrink: 0; }
  `],
})
export class ResumenComponent implements OnInit {
  cargando = true;
  stats = { afiliadosActivos: 0, afiliadosRetirados: 0, afiliadosTotal: 0, empresasActivas: 0, solicitudesPendientes: 0 };

  constructor(
    private afiliados: AfiliadosServicio,
    private empresas: EmpresasServicio,
    private solicitudes: SolicitudesServicio,
  ) {}

  ngOnInit(): void {
    forkJoin({
      af: this.afiliados.estadisticas().pipe(catchError(() => of({ activos: 0, retirados: 0, total: 0 }))),
      em: this.empresas.estadisticas().pipe(catchError(() => of({ activas: 0 }))),
      sol: this.solicitudes.contarPendientes().pipe(catchError(() => of(0))),
    }).subscribe((res) => {
      this.stats.afiliadosActivos = res.af.activos ?? 0;
      this.stats.afiliadosRetirados = res.af.retirados ?? 0;
      this.stats.afiliadosTotal = res.af.total ?? 0;
      this.stats.empresasActivas = res.em.activas ?? 0;
      this.stats.solicitudesPendientes = res.sol ?? 0;
      this.cargando = false;
    });
  }
}
