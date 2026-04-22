import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AutenticacionServicio } from '../servicios/autenticacion.servicio';

export const rolGuardia: CanActivateFn = (ruta: ActivatedRouteSnapshot) => {
  const auth = inject(AutenticacionServicio);
  const router = inject(Router);

  const rolesRequeridos: string[] = ruta.data['roles'] ?? [];

  if (rolesRequeridos.length === 0 || auth.tieneRol(rolesRequeridos)) {
    return true;
  }

  const usuario = auth.usuarioActual;
  if (usuario) {
    const destino =
      usuario.rol === 'SUPER_ADMIN'
        ? '/super-admin'
        : usuario.rol === 'ADMIN'
        ? '/admin'
        : '/secretaria';
    return router.createUrlTree([destino]);
  }

  return router.createUrlTree(['/ingresar']);
};
