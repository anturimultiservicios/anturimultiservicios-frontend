import { Routes } from '@angular/router';
import { autenticacionGuardia } from './nucleo/guardias/autenticacion.guardia';
import { rolGuardia } from './nucleo/guardias/rol.guardia';

export const rutas: Routes = [
  // Ruta raíz → página de inicio pública
  {
    path: '',
    loadComponent: () =>
      import('./publico/inicio/inicio.component').then((m) => m.InicioComponent),
  },

  // Login
  {
    path: 'ingresar',
    loadComponent: () =>
      import('./autenticacion/inicio-sesion/inicio-sesion.component').then(
        (m) => m.InicioSesionComponent
      ),
  },

  // Enlace del correo de recuperación (2026-10-08)
  {
    path: 'restablecer-contrasena',
    loadComponent: () =>
      import('./autenticacion/restablecer-contrasena/restablecer-contrasena.component').then(
        (m) => m.RestablecerContrasenaComponent
      ),
  },

  // Panel super admin
  {
    path: 'super-admin',
    canActivate: [autenticacionGuardia, rolGuardia],
    data: { roles: ['SUPER_ADMIN'] },
    loadChildren: () =>
      import('./super-admin/super-admin.routes').then((m) => m.rutasSuperAdmin),
  },

  // Panel admin
  {
    path: 'admin',
    canActivate: [autenticacionGuardia, rolGuardia],
    data: { roles: ['ADMIN', 'SUPER_ADMIN'] },
    loadChildren: () =>
      import('./admin/admin.routes').then((m) => m.rutasAdmin),
  },

  // Panel secretaria
  {
    path: 'asistente',
    canActivate: [autenticacionGuardia, rolGuardia],
    data: { roles: ['SECRETARIA'] },
    loadChildren: () =>
      import('./secretaria/secretaria.routes').then((m) => m.rutasSecretaria),
  },

  // 2026-10-09: espacio Interrapidísimo (en desarrollo: solo Super Admin; el
  // servidor decide quién entra de verdad - EspacioGuardia)
  {
    path: 'interrapidisimo',
    canActivate: [autenticacionGuardia, rolGuardia],
    data: { roles: ['SUPER_ADMIN', 'EXTERNO'] },
    loadComponent: () =>
      import('./interrapidisimo/interrapidisimo.component').then((m) => m.InterrapidisimoComponent),
  },

  // 2026-10-08: el rol se llama "Asistente" en todo el front; la URL vieja
  // /secretaria/... sigue funcionando por si alguien la tenía guardada.
  { path: 'secretaria', redirectTo: 'asistente' },

  // Página no encontrada
  {
    path: '**',
    loadComponent: () =>
      import('./publico/no-encontrado/no-encontrado.component').then(
        (m) => m.NoEncontradoComponent
      ),
  },
];
