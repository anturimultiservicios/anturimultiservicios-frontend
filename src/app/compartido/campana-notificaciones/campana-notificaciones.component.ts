import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, interval, startWith, switchMap, catchError, of, forkJoin } from 'rxjs';
import { NotificacionesSistemaServicio, NotificacionSistema, PendienteSistema } from '../../nucleo/servicios/notificaciones-sistema.servicio';

// Tipos cuyo referenciaId es un afiliado - al hacer clic se abre su ficha.
const TIPOS_AFILIADO = [
  'nuevo_afiliado', 'afiliado_editado', 'afiliado_eliminado', 'pago_registrado', 'toca_llamar',
  'documento_subido', 'documento_reclasificado', 'documento_eliminado',
  'incapacidad_registrada', 'incapacidad_documento', 'liquidacion_confirmada',
];

// Campana del panel (Admin/Super Admin/Secretaria). Consulta el contador
// cada 60 s - mismo backend que ya guardaba todo, sin depender del socket.
@Component({
  selector: 'anturi-campana-notificaciones',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="campana" (click)="$event.stopPropagation()">
      <button class="campana__boton" (click)="alternar()" title="Notificaciones" aria-label="Notificaciones">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span *ngIf="sinLeer + pendientes.length > 0" class="campana__contador">{{ sinLeer + pendientes.length > 99 ? '99+' : sinLeer + pendientes.length }}</span>
      </button>

      <div *ngIf="abierta" class="campana__panel">
        <div class="campana__encabezado">
          <strong>Notificaciones</strong>
          <button *ngIf="sinLeer > 0" class="campana__enlace" (click)="marcarTodas()">Marcar todas como leídas</button>
        </div>
        <div *ngIf="pendientes.length > 0" class="campana__seccion">Por resolver ({{ pendientes.length }})</div>
        <ul *ngIf="pendientes.length > 0" class="campana__lista campana__lista--pendientes">
          <li *ngFor="let p of pendientes" class="campana__item campana__item--pendiente" (click)="abrirPendiente(p)">
            <span class="campana__punto campana__punto--pendiente"></span>
            <div class="campana__texto">
              <span class="campana__titulo">{{ p.titulo }}</span>
              <span class="campana__mensaje">{{ p.mensaje }}</span>
              <button *ngIf="p.tipo === 'revision_valor'" type="button" class="campana__resolver" (click)="resolverRevision(p, $event)">Ya lo revisé</button>
            </div>
          </li>
        </ul>
        <div *ngIf="pendientes.length > 0" class="campana__seccion">Avisos</div>
        <div *ngIf="cargando" class="campana__vacio">Cargando...</div>
        <div *ngIf="!cargando && lista.length === 0" class="campana__vacio">No hay notificaciones.</div>
        <ul *ngIf="!cargando && lista.length > 0" class="campana__lista">
          <li *ngFor="let n of lista" class="campana__item" [class.campana__item--nueva]="!n.leida" (click)="abrir(n)">
            <span class="campana__punto" *ngIf="!n.leida"></span>
            <div class="campana__texto">
              <span class="campana__titulo">{{ n.titulo }}</span>
              <span class="campana__mensaje">{{ n.mensaje }}</span>
              <span class="campana__fecha">{{ n.creadoEn | date:'d MMM, h:mm a' }}</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .campana { position: relative; }
    .campana__boton { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--borde-color, #e5e7eb); background: var(--fondo-tarjeta, #fff); color: var(--texto-secundario, #4b5563); cursor: pointer; }
    .campana__boton:hover { color: var(--color-primario, #1e3a8a); }
    .campana__contador { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: var(--color-error, #dc2626); color: #fff; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; }
    .campana__panel { position: absolute; right: 0; top: calc(100% + 8px); width: min(380px, calc(100vw - 32px)); max-height: 70vh; display: flex; flex-direction: column; background: var(--fondo-tarjeta, #fff); border: 1px solid var(--borde-color, #e5e7eb); border-radius: var(--radio-lg, 12px); box-shadow: 0 10px 30px rgba(0,0,0,0.15); z-index: 1000; overflow: hidden; }
    .campana__encabezado { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--borde-color, #e5e7eb); color: var(--texto-principal, #111827); font-size: var(--tamano-sm, 14px); }
    .campana__enlace { background: none; border: none; color: var(--color-primario, #1e3a8a); font-size: var(--tamano-xs, 12px); cursor: pointer; padding: 0; }
    .campana__vacio { padding: 24px 14px; text-align: center; color: var(--texto-terciario, #6b7280); font-size: var(--tamano-sm, 14px); }
    .campana__lista { list-style: none; margin: 0; padding: 0; overflow-y: auto; }
    .campana__item { position: relative; display: flex; gap: 8px; padding: 10px 14px 10px 24px; border-bottom: 1px solid var(--borde-color, #f1f1f1); cursor: pointer; }
    .campana__item:hover { background: rgba(0,0,0,0.03); }
    .campana__item--nueva { background: rgba(30,58,138,0.05); }
    .campana__punto { position: absolute; left: 10px; top: 16px; width: 7px; height: 7px; border-radius: 50%; background: var(--color-primario, #1e3a8a); }
    .campana__seccion { padding: 8px 14px 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--texto-terciario, #6b7280); }
    .campana__lista--pendientes { overflow: visible; }
    .campana__item--pendiente { background: rgba(234,179,8,0.08); }
    .campana__punto--pendiente { background: #eab308; }
    .campana__resolver { align-self: flex-start; margin-top: 4px; border: 1px solid #ca8a04; background: transparent; color: inherit; border-radius: 6px; padding: 2px 8px; font-size: 12px; cursor: pointer; }
    .campana__resolver:hover { background: rgba(234,179,8,0.15); }
    .campana__texto { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .campana__titulo { font-weight: 600; font-size: var(--tamano-sm, 14px); color: var(--texto-principal, #111827); }
    .campana__mensaje { font-size: var(--tamano-xs, 12px); color: var(--texto-secundario, #4b5563); overflow-wrap: anywhere; }
    .campana__fecha { font-size: 11px; color: var(--texto-terciario, #9ca3af); }
  `],
})
export class CampanaNotificacionesComponent implements OnInit, OnDestroy {
  abierta = false;
  cargando = false;
  sinLeer = 0;
  lista: NotificacionSistema[] = [];
  pendientes: PendienteSistema[] = [];
  private sondeo?: Subscription;

  constructor(private servicio: NotificacionesSistemaServicio, private router: Router) {}

  ngOnInit(): void {
    this.sondeo = interval(60_000).pipe(
      startWith(0),
      switchMap(() => forkJoin({
        sinLeer: this.servicio.contarSinLeer().pipe(catchError(() => of(this.sinLeer))),
        pendientes: this.servicio.pendientes().pipe(catchError(() => of(this.pendientes))),
      })),
    ).subscribe(({ sinLeer, pendientes }) => {
      this.sinLeer = Number(sinLeer) || 0;
      this.pendientes = pendientes;
    });
  }

  ngOnDestroy(): void {
    this.sondeo?.unsubscribe();
  }

  @HostListener('document:click')
  cerrar(): void {
    this.abierta = false;
  }

  alternar(): void {
    this.abierta = !this.abierta;
    if (this.abierta) this.cargar();
  }

  private cargar(): void {
    this.cargando = true;
    this.servicio.listar().subscribe({
      next: (lista) => { this.lista = lista; this.cargando = false; },
      error: () => { this.lista = []; this.cargando = false; },
    });
  }

  marcarTodas(): void {
    this.servicio.marcarTodas().subscribe(() => {
      this.lista = this.lista.map((n) => ({ ...n, leida: true }));
      this.sinLeer = 0;
    });
  }

  abrirPendiente(p: PendienteSistema): void {
    const prefijo = this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
    this.abierta = false;
    if (p.tipo === 'duplicado_cedula' && p.referenciaId) {
      this.router.navigate([prefijo, 'afiliados', p.referenciaId]);
    } else if (p.tipo === 'solicitud_pendiente') {
      this.router.navigate(['/admin', 'solicitudes']);
    } else if (p.tipo === 'dispositivo_pendiente') {
      this.router.navigate(['/admin', 'dispositivos']);
    } else if (p.tipo === 'revision_valor') {
      if (p.empresaId) this.router.navigate([prefijo, 'empresas', p.empresaId]);
      else if (p.afiliadoId) this.router.navigate([prefijo, 'afiliados', p.afiliadoId]);
    }
  }

  // 2026-10-09: revisiones para la Asistente (valores del Excel que no
  // cuadran). Sigue en "Por resolver" hasta que alguien escribe qué encontró.
  resolverRevision(p: PendienteSistema, ev: Event): void {
    ev.stopPropagation();
    if (!p.referenciaId) return;
    const nota = prompt(`${p.titulo}

¿Qué encontró o qué corrigió? (le llega a Anturi)`);
    if (!nota || nota.trim().length < 3) return;
    this.servicio.resolverRevision(p.referenciaId, nota.trim()).subscribe({
      next: () => (this.pendientes = this.pendientes.filter((x) => x.clave !== p.clave)),
      error: () => alert('No se pudo marcar como revisado. Intente de nuevo.'),
    });
  }

  abrir(n: NotificacionSistema): void {
    if (!n.leida) {
      this.servicio.marcarLeida(n.id).subscribe();
      n.leida = true;
      this.sinLeer = Math.max(0, this.sinLeer - 1);
    }
    const prefijo = this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
    if (n.referenciaId && TIPOS_AFILIADO.includes(n.tipo)) {
      this.abierta = false;
      this.router.navigate([prefijo, 'afiliados', n.referenciaId]);
    } else if (n.tipo === 'solicitud_pendiente' || n.tipo === 'solicitud_aprobada' || n.tipo === 'solicitud_rechazada') {
      this.abierta = false;
      this.router.navigate([prefijo, prefijo === '/admin' ? 'solicitudes' : 'mis-solicitudes']);
    } else if (n.referenciaId && n.tipo === 'empresa_creada') {
      this.abierta = false;
      this.router.navigate([prefijo, 'empresas', n.referenciaId]);
    } else if (n.tipo === 'recuperar_contrasena' && prefijo === '/admin') {
      this.abierta = false;
      this.router.navigate(['/admin', 'usuarios']);
    } else if (n.tipo === 'dispositivo_pendiente' && prefijo === '/admin') {
      this.abierta = false;
      this.router.navigate(['/admin', 'dispositivos']);
    } else if (n.referenciaId && n.tipo === 'evidencia_subida') {
      this.abierta = false;
      this.router.navigate([prefijo, 'hallazgos-reconciliacion', n.referenciaId]);
    }
  }
}
