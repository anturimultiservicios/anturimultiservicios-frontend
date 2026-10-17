import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { entorno } from '../../../environments/entorno';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

// 2026-10-15 (Cristopher): el bot recuerda lo que quedó quieto.
//  - A Anturi (Admin): solicitudes o avisos sin revisar de hace 2+ días;
//    al darle clic lo lleva a revisarlos (él tiene la última palabra).
//  - A la Asistente: a quién le toca llamar hoy.
// "Más tarde" lo esconde 2 horas. Para verlo de prueba: ?probar-bot
interface Recordatorio {
  tipo: 'revisar' | 'llamar' | 'tareas';
  tareas?: number;
  titulosTareas?: string[];
  cantidad: number;
  dias?: number;
  avisosViejos?: number;
  nombres?: string[];
  ruta: string | null;
}

const CADA = 30 * 60 * 1000;
const POSPONER = 2 * 60 * 60 * 1000;

@Component({
  selector: 'anturi-recordatorio-bot',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="r" class="bot" role="dialog" aria-live="polite">
      <div class="bot__cara">
        <video #v src="/assets/bot/bot-anturi.mp4" poster="/assets/bot/bot-anturi-poster.jpg"
          autoplay loop muted playsinline disablepictureinpicture [muted]="true"
          (loadedmetadata)="iniciarVideo(v)" (canplay)="iniciarVideo(v)"></video>
      </div>
      <div class="bot__nube">
        <p class="bot__saludo">¡{{ nombre ? nombre + ', ' : '' }}un recordatorio! 🔔</p>
        <ng-container *ngIf="r.tipo === 'revisar'">
          <p *ngIf="r.cantidad" class="bot__texto">
            Tiene <b>{{ r.cantidad }} {{ r.cantidad === 1 ? 'cambio' : 'cambios' }} por revisar</b>{{ r.dias ? ', el más viejo de hace ' + r.dias + ' días' : '' }}.
            La Asistente ya los ve hechos, pero usted tiene la última palabra.
          </p>
          <p *ngIf="r.tareas" class="bot__texto">Tiene <b>{{ r.tareas }} {{ r.tareas === 1 ? 'tarea' : 'tareas' }} por resolver</b>: {{ r.titulosTareas?.join(', ') }}.</p>
          <p *ngIf="!r.cantidad && !r.tareas && r.avisosViejos" class="bot__texto">
            Tiene <b>{{ r.avisosViejos }} {{ r.avisosViejos === 1 ? 'notificación' : 'notificaciones' }}</b> sin ver de hace más de 2 días.
          </p>
        </ng-container>
        <ng-container *ngIf="r.tipo === 'llamar'">
          <p class="bot__texto">Hoy le toca <b>llamar a {{ r.cantidad }} {{ r.cantidad === 1 ? 'persona' : 'personas' }}</b>{{ r.nombres?.length ? ': ' + r.nombres!.join(', ') + (r.cantidad > r.nombres!.length ? ' y más' : '') : '' }}.</p>
        </ng-container>
        <p *ngIf="r.tipo !== 'revisar' && r.tareas" class="bot__texto">Tiene <b>{{ r.tareas }} {{ r.tareas === 1 ? 'tarea' : 'tareas' }} por resolver</b>: {{ r.titulosTareas?.join(', ') }}.</p>
        <div class="bot__acciones">
          <button type="button" class="bot__btn bot__btn--ir" (click)="ir()">{{ r.tipo === 'llamar' ? 'Ver a quién llamar' : r.tipo === 'tareas' || (!r.cantidad && r.tareas) ? 'Ver mis tareas' : 'Revisar ahora' }}</button>
          <button *ngIf="r.tipo === 'llamar' && r.tareas" type="button" class="bot__btn bot__btn--luego" (click)="verTareas()">Ver mis tareas</button>
          <button type="button" class="bot__btn bot__btn--luego" (click)="masTarde()">Más tarde</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bot {
      position: fixed; right: 16px; bottom: 16px; z-index: 9990;
      display: flex; align-items: center; gap: 12px;
      width: min(420px, calc(100vw - 32px)); padding: 12px 14px 12px 12px;
      background: var(--fondo-tarjeta, #fff);
      border: 2px solid var(--color-primario, #1B3270); border-radius: 20px;
      box-shadow: 0 20px 50px rgba(27, 50, 112, 0.3), 0 0 0 5px rgba(232, 87, 12, 0.12);
      animation: botEntrar 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
    }
    .bot__cara { flex-shrink: 0; width: 76px; height: 76px; border-radius: 50%; overflow: hidden; background: #fff;
      box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--color-secundario, #E8570C); }
    .bot__cara video { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .bot__nube { flex: 1; min-width: 0; padding: 10px 12px; background: rgba(27, 50, 112, 0.05); border-radius: 14px 14px 14px 4px; }
    .bot__saludo { margin: 0 0 4px; font-size: 15px; font-weight: 800; color: var(--color-primario, #1B3270); }
    .bot__texto { margin: 0 0 8px; font-size: 13.5px; line-height: 1.4; color: var(--texto-principal, #1f2937); }
    .bot__texto b { color: var(--color-secundario, #E8570C); }
    .bot__acciones { display: flex; gap: 8px; flex-wrap: wrap; }
    .bot__btn { padding: 7px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 700; cursor: pointer; border: 2px solid transparent; }
    .bot__btn--ir { background: var(--color-secundario, #E8570C); color: #fff; }
    .bot__btn--ir:hover { background: #c94a08; }
    .bot__btn--luego { background: transparent; color: var(--color-primario, #1B3270); border-color: var(--color-primario, #1B3270); }
    @keyframes botEntrar { from { opacity: 0; transform: translateY(24px) scale(0.9); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .bot { animation: none; } }
    @media (max-width: 480px) { .bot { right: 8px; left: 8px; bottom: 8px; width: auto; } .bot__cara { width: 56px; height: 56px; } }
  `],
})
export class RecordatorioBotComponent implements OnInit, OnDestroy {
  r: Recordatorio | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private primero?: ReturnType<typeof setTimeout>;

  constructor(private http: HttpClient, private auth: AutenticacionServicio, private router: Router) {}

  ngOnInit(): void {
    this.primero = setTimeout(() => this.consultar(), 15000);
    this.timer = setInterval(() => this.consultar(), CADA);
  }

  ngOnDestroy(): void {
    clearTimeout(this.primero);
    clearInterval(this.timer);
  }

  private get clave(): string {
    return `anturi_bot_luego_${this.auth.usuarioActual?.id ?? ''}`;
  }

  private consultar(): void {
    const u = this.auth.usuarioActual;
    if (!u || !this.auth.estaAutenticado || !['ADMIN', 'SUPER_ADMIN', 'SECRETARIA'].includes(u.rol)) { this.r = null; return; }
    const prueba = /[?&]probar-bot\b/.test(window.location.search);
    if (!prueba) {
      try { if (Number(localStorage.getItem(this.clave) || 0) > Date.now()) return; } catch { /* sin almacenamiento */ }
    }
    this.http.get<Recordatorio | null>(`${entorno.urlApi}/notificaciones/recordatorio-bot`).subscribe({
      next: (r) => (this.r = r || (prueba ? { tipo: u.rol === 'SECRETARIA' ? 'llamar' : 'revisar', cantidad: 2, dias: 3, nombres: ['Ana Ríos'], ruta: null } : null)),
      error: () => undefined,
    });
  }

  get nombre(): string {
    const n = (this.auth.usuarioActual?.nombre || '').trim().split(/\s+/)[0] || '';
    if (/^crist[oó]pher$/i.test(n)) return 'Cris';
    return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : '';
  }

  iniciarVideo(v: HTMLVideoElement): void {
    v.muted = true;
    if (v.paused) v.play().catch(() => undefined);
  }

  verTareas(): void {
    this.r = null;
    this.posponer(POSPONER);
    // después del clic (si no, el mismo clic cierra la campana)
    setTimeout(() => window.dispatchEvent(new Event('anturi-abrir-campana')), 50);
  }

  ir(): void {
    const r = this.r;
    if (!r) return;
    if (r.tipo === 'tareas' || (r.tipo === 'revisar' && !r.cantidad && r.tareas)) { this.verTareas(); return; }
    this.r = null;
    this.posponer(POSPONER);
    // solo avisos viejos (sin solicitudes): la campana está en el panel
    this.router.navigateByUrl(r.ruta || (r.tipo === 'llamar' ? '/asistente/recordatorios-llamada' : '/admin'));
  }

  masTarde(): void {
    this.r = null;
    this.posponer(POSPONER);
  }

  private posponer(ms: number): void {
    try { localStorage.setItem(this.clave, String(Date.now() + ms)); } catch { /* sin almacenamiento */ }
  }
}
