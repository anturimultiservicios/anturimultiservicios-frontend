import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
  constructor(
    private temaServicio: TemaServicio,
    private idiomaServicio: IdiomaServicio,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.temaServicio.inicializar();
    this.idiomaServicio.inicializar();
  }
}
