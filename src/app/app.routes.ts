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
    path: 'secretaria',
    canActivate: [autenticacionGuardia, rolGuardia],
    data: { roles: ['SECRETARIA'] },
    loadChildren: () =>
      import('./secretaria/secretaria.routes').then((m) => m.rutasSecretaria),
  },

  // Página no encontrada
  {
    path: '**',
    loadComponent: () =>
      import('./publico/no-encontrado/no-encontrado.component').then(
        (m) => m.NoEncontradoComponent
      ),
  },
];
