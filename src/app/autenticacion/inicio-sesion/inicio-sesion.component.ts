import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdiomaServicio } from '../../nucleo/servicios/idioma.servicio';
import { AutenticacionServicio, esLoginCompleto } from '../../nucleo/servicios/autenticacion.servicio';
import { DispositivosServicio } from '../../nucleo/servicios/dispositivos.servicio';
import {
  opcionesAutenticacionACredentialOptions,
  opcionesRegistroACredentialOptions,
  credencialAutenticacionARespuesta,
  credencialRegistroARespuesta,
} from '../../nucleo/utilidades/webauthn.util';

// 2026-09-29: 'cambiar-contrasena'/'verificar-dispositivo'/'registrar-
// dispositivo'/'dispositivo-pendiente' son las cuatro ramas que puede pedir
// el backend (D3+D4) despues de una contraseña correcta, antes de que haya
// sesion real - ver `RespuestaLoginParcial` en autenticacion.servicio.ts.
type VistaLogin =
  | 'login'
  | 'recuperar'
  | 'equipo-pendiente'
  | 'enviado'
  | 'cambiar-contrasena'
  | 'verificar-dispositivo'
  | 'registrar-dispositivo'
  | 'dispositivo-pendiente'
  | 'codigo-totp';

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

  // 2026-10-01 (decisión de Cristopher, seguridad): no-null = pantalla
  // completa en vez del formulario - el backend ya validó la contraseña
  // correcta pero el horario de acceso (7:00-19:00 hora Colombia) no deja
  // entrar en este momento.
  fueraDeHorarioMensaje: string | null = null;
  mensajeEquipo = '';
  equipoBloqueado = false;
  // Respuesta de "Olvidó su contraseña": enlace al correo personal, o aviso
  // al administrador si todavía no registró uno (2026-10-08).
  mensajeEnviado = '';

  // Estado de las ramas D3+D4 (dispositivo/contraseña temporal)
  mensajePaso = '';
  opcionesDispositivo: any = null;
  nuevaContrasena = '';
  confirmarContrasena = '';
  nombreDispositivo = '';
  // 2026-10-09: código de Google Authenticator (Super Admin)
  codigoTotp = '';

  constructor(
    public idiomaServicio: IdiomaServicio,
    private auth: AutenticacionServicio,
    private dispositivosServicio: DispositivosServicio,
    private router: Router
  ) {}

  cerrarAvisoHorario(): void {
    this.fueraDeHorarioMensaje = null;
    this.contrasena = '';
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

    const codigo = this.vista === 'codigo-totp' ? this.codigoTotp.replace(/\s/g, '') : undefined;
    this.auth.iniciarSesion(this.correo, this.contrasena, codigo).subscribe({
      next: (res) => {
        this.cargando = false;

        if (esLoginCompleto(res)) {
          this.codigoTotp = '';
          this.auth.guardarSesion(res);
          this.irSegunRol(res.usuario.rol);
          return;
        }

        // 2026-10-09: contraseña correcta, falta el código de Google Authenticator
        if (res.alcance === 'requiere-codigo') {
          this.mensajePaso = res.mensaje;
          this.codigoTotp = '';
          this.vista = 'codigo-totp';
          setTimeout(() => document.getElementById('codigo-totp')?.focus(), 50);
          return;
        }

        // Ramas parciales (D3+D4): guardar el tokenTemporal de alcance
        // acotado y pasar a la vista que corresponda - NUNCA hay sesion
        // real todavia en ninguna de las tres.
        this.auth.guardarTokenTemporal(res.tokenTemporal);
        this.mensajePaso = res.mensaje;

        if (res.alcance === 'debe-cambiar-contrasena') {
          this.vista = 'cambiar-contrasena';
        } else if (res.alcance === 'pre-auth') {
          this.opcionesDispositivo = res.opcionesDispositivo;
          this.vista = 'verificar-dispositivo';
        } else {
          this.vista = 'registrar-dispositivo';
        }
      },
      error: (err) => {
        this.cargando = false;
        const mensaje: string | undefined = err?.error?.message;
        if (err.status === 401 && mensaje?.includes('Fuera de horario de acceso')) {
          // La contraseña sí era correcta - distinto de "credenciales
          // incorrectas", por eso pantalla completa propia en vez del
          // mensaje de error genérico del formulario.
          this.fueraDeHorarioMensaje = mensaje;
        } else if (err.status === 403 && mensaje?.startsWith('EQUIPO_')) {
          // 2026-10-08: equipos autorizados - nuevo, pendiente o bloqueado.
          this.mensajeEquipo = mensaje.replace(/^EQUIPO_[A-Z_]+:\s*/, '');
          this.equipoBloqueado = mensaje.startsWith('EQUIPO_BLOQUEADO') || mensaje.startsWith('EQUIPO_SIN_ID');
          this.vista = 'equipo-pendiente';
        } else if (err.status === 401 && mensaje?.includes('Google Authenticator')) {
          this.error = 'Código incorrecto. Revise el de "Anturi Multiservicios" en Google Authenticator e intente con el código nuevo.';
          this.codigoTotp = '';
        } else if (err.status === 401) {
          this.error = 'Correo o contraseña incorrectos.';
        } else {
          this.error = 'Error de conexión. Intente nuevamente.';
        }
      },
    });
  }

  // 2026-09-29: SUPER_ADMIN entraba a /super-admin, una pantalla nunca
  // conectada ("Conecte el backend para habilitar todas las
  // funcionalidades") - Cristopher confirmó que quiere entrar directo al
  // panel real (mismo que ADMIN, que ya lo permite: rutasAdmin acepta
  // ['ADMIN', 'SUPER_ADMIN']). La ruta /super-admin se deja tal cual en el
  // árbol de rutas (no se borra nada), simplemente ya nadie aterriza ahí
  // por defecto.
  private irSegunRol(rol: string): void {
    if (rol === 'SUPER_ADMIN' || rol === 'ADMIN') {
      this.router.navigate(['/admin']);
    } else if (rol === 'EXTERNO') {
      // 2026-10-09: usuario de otro espacio (ej. Interrapidísimo)
      this.router.navigate(['/interrapidisimo']);
    } else {
      this.router.navigate(['/asistente']);
    }
  }

  // ===== Paso: contraseña temporal (alcance='debe-cambiar-contrasena') =====

  establecerContrasenaInicial(): void {
    if (!this.nuevaContrasena || this.nuevaContrasena.length < 8) {
      this.error = 'La contraseña nueva debe tener al menos 8 caracteres.';
      return;
    }
    if (this.nuevaContrasena !== this.confirmarContrasena) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }

    this.cargando = true;
    this.error = '';

    this.auth.establecerContrasenaInicial(this.nuevaContrasena).subscribe({
      next: () => {
        this.cargando = false;
        this.auth.limpiarTokenTemporal();
        this.contrasena = this.nuevaContrasena;
        this.nuevaContrasena = '';
        this.confirmarContrasena = '';
        // Sale del formulario de cambio ya mismo: si algo demora, no queda
        // a la vista para enviarse dos veces (bug real con Anyi, 2026-10-08).
        this.vista = 'login';
        // El backend no devuelve sesion en este paso - hay que iniciar
        // sesion de nuevo con la contraseña ya establecida.
        this.ingresar();
      },
      error: (err) => {
        this.cargando = false;
        if (err?.status === 403) {
          // La clave ya se había cambiado (otra pestaña, doble envío, token
          // viejo): no es un error de ella - volver a ingresar con la nueva.
          this.auth.limpiarTokenTemporal();
          this.nuevaContrasena = '';
          this.confirmarContrasena = '';
          this.contrasena = '';
          this.vista = 'login';
          this.error = 'Su contraseña ya quedó cambiada. Ingrese con la contraseña nueva que creó.';
          return;
        }
        this.error = err.error?.message || 'No se pudo guardar la contraseña. Intente nuevamente.';
      },
    });
  }

  // ===== Paso: verificar dispositivo autorizado (alcance='pre-auth') =====

  async verificarConEsteDispositivo(): Promise<void> {
    this.error = '';
    this.cargando = true;
    try {
      const credencial = (await navigator.credentials.get(
        opcionesAutenticacionACredentialOptions(this.opcionesDispositivo)
      )) as PublicKeyCredential;
      const respuesta = credencialAutenticacionARespuesta(credencial);
      const res = await this.auth.verificarDispositivo(respuesta).toPromise();
      this.auth.guardarSesion(res!);
      this.irSegunRol(res!.usuario.rol);
    } catch (e: any) {
      this.error = e?.error?.message || e?.message || 'No se pudo verificar el dispositivo.';
    } finally {
      this.cargando = false;
    }
  }

  // ===== Paso: registrar este dispositivo (alcance='solo-registro-dispositivo') =====

  async registrarEsteDispositivo(): Promise<void> {
    this.error = '';
    this.cargando = true;
    try {
      const opciones = await this.dispositivosServicio.registrarInicio().toPromise();
      const credencial = (await navigator.credentials.create(
        opcionesRegistroACredentialOptions(opciones)
      )) as PublicKeyCredential;
      const respuesta = credencialRegistroARespuesta(credencial);
      await this.dispositivosServicio.registrarCompletar(respuesta, this.nombreDispositivo || undefined).toPromise();
      this.auth.limpiarTokenTemporal();
      this.vista = 'dispositivo-pendiente';
    } catch (e: any) {
      this.error = e?.error?.message || e?.message || 'No se pudo completar el registro de este dispositivo.';
    } finally {
      this.cargando = false;
    }
  }

  cancelarPasoDispositivo(): void {
    this.auth.limpiarTokenTemporal();
    this.opcionesDispositivo = null;
    this.mensajePaso = '';
    this.contrasena = '';
    this.error = '';
    this.vista = 'login';
  }

  recuperarContrasena(): void {
    if (!this.correoRecuperar) {
      this.error = 'Por favor ingrese su correo.';
      return;
    }

    this.cargando = true;
    this.error = '';

    this.auth.recuperarContrasena(this.correoRecuperar).subscribe({
      next: (res) => {
        this.cargando = false;
        this.mensajeEnviado = res?.mensaje || '';
        this.vista = 'enviado';
      },
      error: () => {
        this.cargando = false;
        this.error = 'No se pudo enviar la solicitud. Intente de nuevo en un momento.';
      },
    });
  }

  cambiarVista(v: VistaLogin): void {
    this.vista = v;
    this.error = '';
  }
}
