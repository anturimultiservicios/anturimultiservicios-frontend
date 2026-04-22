import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TemaServicio } from '../../nucleo/servicios/tema.servicio';
import { IdiomaServicio } from '../../nucleo/servicios/idioma.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

type VistaLogin = 'login' | 'recuperar' | 'enviado';

@Component({
  selector: 'anturi-inicio-sesion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './inicio-sesion.component.html',
  styleUrls: ['./inicio-sesion.component.css'],
})
export class InicioSesionComponent {
  vista: VistaLogin = 'login';
  cargando = false;
  error = '';
  verContrasena = false;
  menuIdioma = false;

  correo = '';
  contrasena = '';
  correoRecuperar = '';

  constructor(
    public temaServicio: TemaServicio,
    public idiomaServicio: IdiomaServicio,
    private auth: AutenticacionServicio,
    private router: Router
  ) {}

  alternarTema(): void {
    this.temaServicio.alternar();
  }

  cambiarIdioma(codigo: string): void {
    this.idiomaServicio.cambiar(codigo);
    this.menuIdioma = false;
  }

  ingresar(): void {
    if (!this.correo || !this.contrasena) {
      this.error = 'Por favor complete todos los campos.';
      return;
    }

    this.cargando = true;
    this.error = '';

    this.auth.iniciarSesion(this.correo, this.contrasena).subscribe({
      next: (res) => {
        this.cargando = false;
        const rol = res.usuario.rol;
        if (rol === 'SUPER_ADMIN') {
          this.router.navigate(['/super-admin']);
        } else if (rol === 'ADMIN') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/secretaria']);
        }
      },
      error: (err) => {
        this.cargando = false;
        if (err.status === 401) {
          this.error = 'Correo o contraseña incorrectos.';
        } else {
          this.error = 'Error de conexión. Intente nuevamente.';
        }
      },
    });
  }

  recuperarContrasena(): void {
    if (!this.correoRecuperar) {
      this.error = 'Por favor ingrese su correo.';
      return;
    }

    this.cargando = true;
    this.error = '';

    this.auth.recuperarContrasena(this.correoRecuperar).subscribe({
      next: () => {
        this.cargando = false;
        this.vista = 'enviado';
      },
      error: () => {
        this.cargando = false;
        this.error = 'Error al enviar el correo. Verifique la dirección.';
      },
    });
  }

  cambiarVista(v: VistaLogin): void {
    this.vista = v;
    this.error = '';
  }
}
