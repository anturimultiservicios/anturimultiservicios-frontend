import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TemaServicio } from '../../nucleo/servicios/tema.servicio';
import { IdiomaServicio, Idioma } from '../../nucleo/servicios/idioma.servicio';

@Component({
  selector: 'anturi-barra-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './barra-nav.component.html',
  styleUrls: ['./barra-nav.component.css'],
})
export class BarraNavComponent implements OnInit {
  menuAbierto = false;
  menuIdiomaAbierto = false;
  desplazado = false;
  idiomaActual!: Idioma;
  idiomasDisponibles!: Idioma[];

  constructor(
    public temaServicio: TemaServicio,
    public idiomaServicio: IdiomaServicio
  ) {}

  ngOnInit(): void {
    this.idiomaActual = this.idiomaServicio.idiomaActual;
    this.idiomasDisponibles = this.idiomaServicio.idiomasDisponibles;
    this.idiomaServicio.idioma$.subscribe((i) => (this.idiomaActual = i));
  }

  @HostListener('window:scroll')
  alDesplazar(): void {
    this.desplazado = window.scrollY > 30;
  }

  alternarMenu(): void {
    this.menuAbierto = !this.menuAbierto;
    this.menuIdiomaAbierto = false;
  }

  alternarMenuIdioma(): void {
    this.menuIdiomaAbierto = !this.menuIdiomaAbierto;
  }

  seleccionarIdioma(codigo: string): void {
    this.idiomaServicio.cambiar(codigo);
    this.menuIdiomaAbierto = false;
  }

  alternarTema(): void {
    this.temaServicio.alternar();
  }

  cerrarMenus(): void {
    this.menuAbierto = false;
    this.menuIdiomaAbierto = false;
  }

  irASeccion(idSeccion: string): void {
    this.cerrarMenus();
    const elemento = document.getElementById(idSeccion);
    elemento?.scrollIntoView({ behavior: 'smooth' });
  }
}
