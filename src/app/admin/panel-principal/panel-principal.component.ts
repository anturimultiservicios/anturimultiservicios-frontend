import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BarraLateralComponent } from '../barra-lateral/barra-lateral.component';
import { CalculadoraComponent } from '../../compartido/calculadora/calculadora.component';
import { CampanaNotificacionesComponent } from '../../compartido/campana-notificaciones/campana-notificaciones.component';
import { CredencialesPilaComponent } from '../../compartido/credenciales-pila/credenciales-pila.component';
import { CorreoRecuperacionComponent } from '../../compartido/correo-recuperacion/correo-recuperacion.component';
import { TemaServicio } from '../../nucleo/servicios/tema.servicio';
import { IdiomaServicio } from '../../nucleo/servicios/idioma.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

import { PresenciaServicio } from '../../nucleo/servicios/presencia.servicio';
import { DatosLocalesServicio } from '../../nucleo/servicios/datos-locales.servicio';
import { ColaCambiosServicio } from '../../nucleo/servicios/cola-cambios.servicio';
@Component({
  selector: 'anturi-panel-principal',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    TranslateModule,
    BarraLateralComponent,
    CalculadoraComponent,
    CampanaNotificacionesComponent,
    CredencialesPilaComponent,
    CorreoRecuperacionComponent,
  ],
  templateUrl: './panel-principal.component.html',
  styleUrls: ['./panel-principal.component.css'],
})
export class PanelPrincipalComponent implements OnInit, OnDestroy {
  barraLateralExpandida = true;
  menuIdioma = false;
  menuPerfil = false;
  tiempoSesion = '';
  private timerSesion: ReturnType<typeof setInterval> | null = null;

  constructor(
    public temaServicio: TemaServicio,
    public idiomaServicio: IdiomaServicio,
    public auth: AutenticacionServicio,
    private presencia: PresenciaServicio,
    private datosLocales: DatosLocalesServicio,
    private colaCambios: ColaCambiosServicio,
  ) {}

  ngOnInit(): void {
    this.presencia.iniciar();
    // copia para trabajar sin internet + cambios hechos sin internet que faltan por subir
    this.datosLocales.iniciar().then(() => this.colaCambios.iniciar());
    this.timerSesion = setInterval(() => {
      const diff = Date.now() - this.auth.inicioSesion.getTime();
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
    return u ? `${u.nombre} ${u.apellido}` : '';
  }

  get rolTexto(): string {
    const u = this.auth.usuarioActual;
    if (!u) return '';
    return u.rol === 'ADMIN' ? 'Administrador' : 'Super Administrador';
  }
}
