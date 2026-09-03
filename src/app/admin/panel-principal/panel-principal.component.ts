import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BarraLateralComponent } from '../barra-lateral/barra-lateral.component';
import { CalculadoraComponent } from '../../compartido/calculadora/calculadora.component';
import { TemaServicio } from '../../nucleo/servicios/tema.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

@Component({
  selector: 'anturi-panel-principal',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    TranslateModule,
    BarraLateralComponent,
    CalculadoraComponent,
  ],
  templateUrl: './panel-principal.component.html',
  styleUrls: ['./panel-principal.component.css'],
})
export class PanelPrincipalComponent implements OnInit, OnDestroy {
  barraLateralExpandida = true;
  menuPerfil = false;
  tiempoSesion = '';
  private timerSesion: ReturnType<typeof setInterval> | null = null;
  private inicioSesion = new Date();

  constructor(
    public temaServicio: TemaServicio,
    public auth: AutenticacionServicio
  ) {}

  ngOnInit(): void {
    this.timerSesion = setInterval(() => {
      const diff = Date.now() - this.inicioSesion.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      this.tiempoSesion = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerSesion) clearInterval(this.timerSesion);
  }

  alternarBarra(): void {
    this.barraLateralExpandida = !this.barraLateralExpandida;
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }

  get nombreCompleto(): string {
    const u = this.auth.usuarioActual;
    if (!u) return '';
    return u.rol === 'SUPER_ADMIN' ? u.nombre : `${u.nombre} ${u.apellido}`;
  }

  get rolTexto(): string {
    const u = this.auth.usuarioActual;
    if (!u || u.rol === 'SUPER_ADMIN') return '';
    return 'Administrador';
  }
}
