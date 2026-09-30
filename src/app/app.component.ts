import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TemaServicio } from './nucleo/servicios/tema.servicio';
import { IdiomaServicio } from './nucleo/servicios/idioma.servicio';

@Component({
  selector: 'anturi-raiz',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: [':host { display: block; min-height: 100vh; }'],
})
export class AppComponent implements OnInit {
  // 2026-09-29 (decisión de Cristopher): rutas SIN sesión (público + login)
  // - siempre modo claro, sin botón de cambiar tema. Adentro (admin/
  // secretaria/super-admin) sí se respeta la preferencia guardada de cada
  // quien. Se decide acá, centralizado por ruta, en vez de en cada
  // componente - así no depende de que cada pantalla pública/login se
  // acuerde de forzarlo.
  private readonly PREFIJOS_AUTENTICADOS = ['/admin', '/secretaria', '/super-admin'];

  constructor(
    private router: Router,
    private temaServicio: TemaServicio,
    private idiomaServicio: IdiomaServicio,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.temaServicio.inicializar();
    this.idiomaServicio.inicializar();

    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd)
    ).subscribe((evento) => {
      const esAutenticada = this.PREFIJOS_AUTENTICADOS.some((p) => evento.urlAfterRedirects.startsWith(p));
      if (esAutenticada) {
        this.temaServicio.restaurarPreferencia();
      } else {
        this.temaServicio.forzarClaro();
      }
    });
  }
}
