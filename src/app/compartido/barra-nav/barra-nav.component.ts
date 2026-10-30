import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdiomaServicio, Idioma } from '../../nucleo/servicios/idioma.servicio';

@Component({
  selector: 'anturi-barra-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './barra-nav.component.html',
  styleUrls: ['./barra-nav.component.css'],
})
export class BarraNavComponent implements OnInit, OnDestroy {
  menuAbierto = false;
  menuIdiomaAbierto = false;
  desplazado = false;
  // 2026-10-30: acceso oculto (ver nota en el HTML). No es seguridad - el
  // acceso lo protegen la contraseña y el código; solo evita que llame la atención.
  accesoVisible = false;
  private yaBajo = window.scrollY > 40;
  private inicioToque: number | null = null;
  private overscrollAntes = '';
  idiomaActual!: Idioma;
  idiomasDisponibles!: Idioma[];

  constructor(
    public idiomaServicio: IdiomaServicio
  ) {}

  ngOnInit(): void {
    this.idiomaActual = this.idiomaServicio.idiomaActual;
    this.idiomasDisponibles = this.idiomaServicio.idiomasDisponibles;
    this.idiomaServicio.idioma$.subscribe((i) => (this.idiomaActual = i));
    // en celulares, tirar hacia abajo estando arriba no recarga: descubre el acceso
    this.overscrollAntes = document.documentElement.style.overscrollBehaviorY;
    document.documentElement.style.overscrollBehaviorY = 'none';
  }

  ngOnDestroy(): void {
    document.documentElement.style.overscrollBehaviorY = this.overscrollAntes;
  }

  @HostListener('window:scroll')
  alDesplazar(): void {
    this.desplazado = window.scrollY > 30;
    if (window.scrollY > 40) this.yaBajo = true;
  }

  private mostrarAcceso(): void {
    if (!this.yaBajo) this.accesoVisible = true;
  }

  @HostListener('window:wheel', ['$event'])
  alRodar(e: WheelEvent): void {
    if (window.scrollY <= 0 && e.deltaY < -4) this.mostrarAcceso();
  }

  @HostListener('window:touchstart', ['$event'])
  alTocar(e: TouchEvent): void {
    this.inicioToque = window.scrollY <= 0 ? e.touches[0].clientY : null;
  }

  @HostListener('window:touchmove', ['$event'])
  alArrastrar(e: TouchEvent): void {
    if (this.inicioToque !== null && e.touches[0].clientY - this.inicioToque > 60) this.mostrarAcceso();
  }

  @HostListener('window:keydown', ['$event'])
  alTeclear(e: KeyboardEvent): void {
    if (window.scrollY <= 0 && (e.key === 'ArrowUp' || e.key === 'PageUp')) this.mostrarAcceso();
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
