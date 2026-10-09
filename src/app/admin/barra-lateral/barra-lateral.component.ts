import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';
import { SolicitudesServicio } from '../../nucleo/servicios/solicitudes.servicio';
import { HallazgosReconciliacionServicio } from '../../nucleo/servicios/hallazgos-reconciliacion.servicio';

interface ItemMenu {
  icono: string;
  etiqueta: string;
  ruta: string;
  soloAdmin?: boolean;
  soloSuperAdmin?: boolean;
  badge?: number;
}

@Component({
  selector: 'anturi-barra-lateral',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './barra-lateral.component.html',
  styleUrls: ['./barra-lateral.component.css'],
})
export class BarraLateralComponent implements OnInit, OnDestroy {
  @Input() expandida = true;
  @Output() alternarExpansion = new EventEmitter<void>();

  items: ItemMenu[] = [
    { icono: 'resumen', etiqueta: 'Resumen', ruta: '/admin/resumen' },
    { icono: 'afiliados', etiqueta: 'Afiliados', ruta: '/admin/afiliados' },
    { icono: 'empresas', etiqueta: 'Empresas', ruta: '/admin/empresas' },
    { icono: 'calendario', etiqueta: 'Calendario', ruta: '/admin/calendario' },
    { icono: 'llamadas', etiqueta: 'Llamadas y mensajes', ruta: '/admin/recordatorios-llamada' },
    { icono: 'pagos', etiqueta: 'Registrar pago', ruta: '/admin/registrar-pago' },
    // 2026-10-09: control del dinero (no lo ve la Asistente)
    { icono: 'recaudo', etiqueta: 'Recaudo', ruta: '/admin/recaudo', soloAdmin: true },
    { icono: 'solicitudes', etiqueta: 'Solicitudes', ruta: '/admin/solicitudes', soloAdmin: true },
    { icono: 'usuarios', etiqueta: 'Usuarios del sistema', ruta: '/admin/usuarios', soloAdmin: true },
    { icono: 'mis-dispositivos', etiqueta: 'Mis dispositivos', ruta: '/admin/mis-dispositivos' },
    { icono: 'dispositivos', etiqueta: 'Administrar dispositivos', ruta: '/admin/dispositivos', soloAdmin: true },
    { icono: 'horario', etiqueta: 'Horario de acceso', ruta: '/admin/horario-acceso', soloSuperAdmin: true },
    { icono: 'backup', etiqueta: 'Backups', ruta: '/admin/backup', soloSuperAdmin: true },
    { icono: 'hallazgos', etiqueta: 'Reconciliación empleadores', ruta: '/admin/hallazgos-reconciliacion', soloAdmin: true },
    { icono: 'parametros', etiqueta: 'Parámetros legales', ruta: '/admin/parametros-legales', soloAdmin: true },
    { icono: 'configuracion', etiqueta: 'Configuración', ruta: '/admin/configuracion' },
  ];

  esAdmin = false;
  esSuperAdmin = false;
  private destroy$ = new Subject<void>();

  constructor(
    private auth: AutenticacionServicio,
    private solicitudesServicio: SolicitudesServicio,
    private hallazgosServicio: HallazgosReconciliacionServicio,
  ) {}

  ngOnInit(): void {
    this.esAdmin = this.auth.tieneRol(['ADMIN', 'SUPER_ADMIN']);
    this.esSuperAdmin = this.auth.tieneRol(['SUPER_ADMIN']);
    if (this.esAdmin) {
      this.solicitudesServicio.contarPendientes().pipe(takeUntil(this.destroy$)).subscribe((n) => {
        const idx = this.items.findIndex((i) => i.icono === 'solicitudes');
        if (idx >= 0) this.items[idx].badge = n;
      });

      // Alerta persistente (FASE 8, 2026-10-06): hallazgos sin cédula real
      // (centinela PENDIENTE) - no desaparece sola, solo cuando alguien
      // complete la identificación real desde el detalle del hallazgo.
      this.hallazgosServicio.listar().pipe(takeUntil(this.destroy$)).subscribe((lista) => {
        const n = lista.filter((h) => h.estado === 'PENDIENTE_IDENTIFICACION').length;
        const idx = this.items.findIndex((i) => i.icono === 'hallazgos');
        if (idx >= 0 && n > 0) this.items[idx].badge = n;
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  alternar(): void {
    this.alternarExpansion.emit();
  }
}
