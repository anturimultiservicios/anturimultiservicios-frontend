import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

interface ItemMenu {
  icono: string;
  etiqueta: string;
  ruta: string;
  soloAdmin?: boolean;
}

@Component({
  selector: 'anturi-barra-lateral',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './barra-lateral.component.html',
  styleUrls: ['./barra-lateral.component.css'],
})
export class BarraLateralComponent implements OnInit {
  @Input() expandida = true;
  @Output() alternarExpansion = new EventEmitter<void>();

  readonly items: ItemMenu[] = [
    { icono: 'resumen', etiqueta: 'Resumen', ruta: '/admin/resumen' },
    { icono: 'empresas', etiqueta: 'Empresas', ruta: '/admin/empresas' },
    { icono: 'afiliados', etiqueta: 'Afiliados', ruta: '/admin/afiliados' },
    { icono: 'usuarios', etiqueta: 'Usuarios del sistema', ruta: '/admin/usuarios', soloAdmin: true },
    { icono: 'configuracion', etiqueta: 'Configuración', ruta: '/admin/configuracion' },
  ];

  esAdmin = false;

  constructor(private auth: AutenticacionServicio) {}

  ngOnInit(): void {
    this.esAdmin = this.auth.tieneRol(['ADMIN', 'SUPER_ADMIN']);
  }

  alternar(): void {
    this.alternarExpansion.emit();
  }
}
