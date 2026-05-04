import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';
import { SolicitudesServicio } from '../../nucleo/servicios/solicitudes.servicio';

interface ItemMenu {
  icono: string;
  etiqueta: string;
  ruta: string;
  soloAdmin?: boolean;
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
    { icono: 'solicitudes', etiqueta: 'Solicitudes', ruta: '/admin/solicitudes', soloAdmin: true },
    { icono: 'usuarios', etiqueta: 'Usuarios del sistema', ruta: '/admin/usuarios', soloAdmin: true },
    { icono: 'configuracion', etiqueta: 'Configuración', ruta: '/admin/configuracion' },
  ];

  esAdmin = false;
  private destroy$ = new Subject<void>();

  constructor(
    private auth: AutenticacionServicio,
    private solicitudesServicio: SolicitudesServicio,
  ) {}

  ngOnInit(): void {
    this.esAdmin = this.auth.tieneRol(['ADMIN', 'SUPER_ADMIN']);
    if (this.esAdmin) {
      this.solicitudesServicio.contarPendientes().pipe(takeUntil(this.destroy$)).subscribe((n) => {
        const idx = this.items.findIndex((i) => i.icono === 'solicitudes');
        if (idx >= 0) this.items[idx].badge = n;
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
