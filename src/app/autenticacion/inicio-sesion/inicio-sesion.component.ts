import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TemaServicio } from '../../nucleo/servicios/tema.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';
import {
  opcionesAutenticacionACredentialOptions,
  credencialAutenticacionARespuesta,
} from '../../nucleo/utilidades/webauthn.util';

// D3+D4: 'verificar-dispositivo' y 'sin-dispositivo' son las dos ramas de
// segundo factor que puede devolver /ingresar cuando dispositivoObligatorio
// está activo. Con el flag apagado (estado actual) nunca se llega a
// ninguna de las dos - la respuesta siempre trae 'usuario' directo.
type VistaLogin = 'login' | 'recuperar' | 'enviado' | 'verificar-dispositivo' | 'sin-dispositivo';

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

  correo = '';
  contrasena = '';
  correoRecuperar = '';

  // Estado del segundo factor (D3+D4) - opcionesDispositivo viene ya en la
  // misma respuesta de /ingresar cuando alcance='pre-auth' (el backend evita
  // un viaje extra), así que no hace falta pedirlo aparte.
  opcionesDispositivo: any = null;
  verificandoDispositivo = false;
  soportaWebAuthn = typeof window !== 'undefined' && !!window.PublicKeyCredential;

  constructor(
    public temaServicio: TemaServicio,
    private auth: AutenticacionServicio,
    private router: Router
  ) {}

  alternarTema(): void {
    this.temaServicio.alternar();
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
        // Caso A (login normal, o dispositivoObligatorio=false): la
        // respuesta trae 'acceso' - comportamiento idéntico al de siempre,
        // sin ningún cambio. OJO: 'usuario' NO sirve para distinguir los
        // casos - el backend lo manda en AMBAS respuestas (también en el
        // segundo factor, para poder personalizar esa pantalla).
        if ('acceso' in res) {
          this.navegarSegunRol(res.usuario.rol);
          return;
        }
        // Caso B: segundo factor requerido - todavía NO hay sesión ni
        // tokens guardados (ver autenticacion.servicio.ts).
        if (res.alcance === 'pre-auth') {
          this.opcionesDispositivo = res.opcionesDispositivo;
          this.vista = 'verificar-dispositivo';
        } else {
          // 'solo-registro-dispositivo': no tiene ningún dispositivo
          // autorizado todavía. Registrar un dispositivo nuevo es un flujo
          // propio (ya construido en la rama de gestión de dispositivos,
          // sin publicar) - fuera del alcance de este bloque, que es
          // solo la orquestación del login. Se muestra el mensaje y se
          // detiene acá a propósito.
          this.vista = 'sin-dispositivo';
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

  // Paso 2: dispara el desafío WebAuthn con las opciones que ya llegaron de
  // /ingresar. Requiere un gesto explícito del usuario (este método se
  // llama desde un (click), nunca automáticamente al entrar a la vista) -
  // varios navegadores rechazan navigator.credentials.get() sin eso.
  async completarVerificacionDispositivo(): Promise<void> {
    if (!this.soportaWebAuthn) {
      this.error = 'Este navegador no soporta verificación de dispositivo (WebAuthn). Probá con otro navegador.';
      return;
    }

    this.error = '';
    this.verificandoDispositivo = true;

    let credential: PublicKeyCredential;
    try {
      credential = (await navigator.credentials.get(
        opcionesAutenticacionACredentialOptions(this.opcionesDispositivo)
      )) as PublicKeyCredential;
    } catch (e: any) {
      // Cancelado por el usuario, timeout del propio navegador, o cualquier
      // otro rechazo de la API WebAuthn - nunca llega a golpear el backend,
      // así que no hay ninguna sesión parcial que limpiar. Se puede
      // reintentar: el desafío en el servidor sigue vivo hasta que se
      // consuma con éxito o expire el tokenTemporal (5 min).
      this.verificandoDispositivo = false;
      this.error = 'No se pudo verificar el dispositivo. Podés volver a intentarlo.';
      return;
    }

    const respuesta = credencialAutenticacionARespuesta(credential);

    this.auth.verificarDispositivo(respuesta).subscribe({
      next: (res) => {
        this.verificandoDispositivo = false;
        this.navegarSegunRol(res.usuario.rol);
      },
      error: (err) => {
        this.verificandoDispositivo = false;
        // 401 genérico tanto si la aserción no verificó como si el
        // tokenTemporal ya expiró - en ambos casos "reintentar" es la
        // acción correcta; si el token expiró, el reintento fallará de
        // nuevo de inmediato y el botón "Volver a ingresar" cubre ese caso.
        this.error = err?.error?.message || 'No se pudo verificar el dispositivo. Podés volver a intentarlo.';
      },
    });
  }

  // "Volver"/cancelar durante el paso 2 - limpia el estado temporal (nunca
  // hubo tokens guardados, así que no hay nada más que deshacer) y vuelve
  // al formulario de credenciales.
  cancelarVerificacionDispositivo(): void {
    this.auth.cancelarVerificacionDispositivo();
    this.opcionesDispositivo = null;
    this.verificandoDispositivo = false;
    this.error = '';
    this.vista = 'login';
  }

  private navegarSegunRol(rol: string): void {
    if (rol === 'SECRETARIA') {
      this.router.navigate(['/secretaria']);
    } else {
      this.router.navigate(['/admin']);
    }
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
