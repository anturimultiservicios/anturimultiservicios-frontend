import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CalculadoraComponent } from '../../compartido/calculadora/calculadora.component';
import { TemaServicio } from '../../nucleo/servicios/tema.servicio';
import { IdiomaServicio } from '../../nucleo/servicios/idioma.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

@Component({
  selector: 'anturi-panel-secretaria',
  standalone: true,
  imports: [CommonModule, RouterLink, CalculadoraComponent],
  templateUrl: './panel-secretaria.component.html',
  styleUrls: ['./panel-secretaria.component.css'],
})
export class PanelSecretariaComponent {
  constructor(
    public temaServicio: TemaServicio,
    public idiomaServicio: IdiomaServicio,
    public auth: AutenticacionServicio
  ) {}

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }

  get nombreCompleto(): string {
    const u = this.auth.usuarioActual;
    return u ? `${u.nombre} ${u.apellido}` : '';
  }
}
