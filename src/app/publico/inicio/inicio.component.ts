import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { BarraNavComponent } from '../../compartido/barra-nav/barra-nav.component';
import { PiePaginaComponent } from '../../compartido/pie-pagina/pie-pagina.component';
import { ChatbotWhatsappComponent } from '../../compartido/chatbot-whatsapp/chatbot-whatsapp.component';

interface Servicio {
  icono: string;
  claveTitulo: string;
  claveDescripcion: string;
}

@Component({
  selector: 'anturi-inicio',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    BarraNavComponent,
    PiePaginaComponent,
    ChatbotWhatsappComponent,
  ],
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.css'],
})
export class InicioComponent implements OnInit, OnDestroy {
  indiceCarrusel = 0;
  private intervalCarrusel: ReturnType<typeof setInterval> | null = null;

  readonly servicios: Servicio[] = [
    {
      icono: 'salud',
      claveTitulo: 'servicios.eps.titulo',
      claveDescripcion: 'servicios.eps.descripcion',
    },
    {
      icono: 'pension',
      claveTitulo: 'servicios.pension.titulo',
      claveDescripcion: 'servicios.pension.descripcion',
    },
    {
      icono: 'arl',
      claveTitulo: 'servicios.arl.titulo',
      claveDescripcion: 'servicios.arl.descripcion',
    },
    {
      icono: 'caja',
      claveTitulo: 'servicios.cajaCompensacion.titulo',
      claveDescripcion: 'servicios.cajaCompensacion.descripcion',
    },
    {
      icono: 'asesoria',
      claveTitulo: 'servicios.asesorias.titulo',
      claveDescripcion: 'servicios.asesorias.descripcion',
    },
    {
      icono: 'catastro',
      claveTitulo: 'servicios.catastro.titulo',
      claveDescripcion: 'servicios.catastro.descripcion',
    },
    {
      icono: 'tramites',
      claveTitulo: 'servicios.tramites.titulo',
      claveDescripcion: 'servicios.tramites.descripcion',
    },
  ];

  ngOnInit(): void {
    this.iniciarCarrusel();
  }

  ngOnDestroy(): void {
    this.detenerCarrusel();
  }

  irASeccion(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  abrirWhatsApp(): void {
    const texto = encodeURIComponent(
      'Hola, quisiera más información sobre sus servicios de seguridad social.'
    );
    window.open(`https://wa.me/573162852138?text=${texto}`, '_blank');
  }

  // Carrusel
  private iniciarCarrusel(): void {
    this.intervalCarrusel = setInterval(() => {
      this.siguiente();
    }, 4500);
  }

  private detenerCarrusel(): void {
    if (this.intervalCarrusel) {
      clearInterval(this.intervalCarrusel);
    }
  }

  siguiente(): void {
    this.indiceCarrusel = (this.indiceCarrusel + 1) % this.servicios.length;
    this.reiniciarCarrusel();
  }

  anterior(): void {
    this.indiceCarrusel =
      (this.indiceCarrusel - 1 + this.servicios.length) % this.servicios.length;
    this.reiniciarCarrusel();
  }

  irASlide(i: number): void {
    this.indiceCarrusel = i;
    this.reiniciarCarrusel();
  }

  private reiniciarCarrusel(): void {
    this.detenerCarrusel();
    this.iniciarCarrusel();
  }

  obtenerIndicadoresCarrusel(): number[] {
    return Array.from({ length: this.servicios.length }, (_, i) => i);
  }
}
