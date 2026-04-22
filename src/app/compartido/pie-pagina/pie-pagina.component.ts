import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'anturi-pie-pagina',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './pie-pagina.component.html',
  styleUrls: ['./pie-pagina.component.css'],
})
export class PiePaginaComponent {
  readonly anioActual = new Date().getFullYear();
}
