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
    // 2026-09-29: se había corregido este mismo destino en
    // inicio-sesion.component.ts (SUPER_ADMIN ya no aterriza en
    // /super-admin, la pantalla nunca conectada) pero se quedó sin
    // corregir ACÁ - este guardia rebota a cualquier SUPER_ADMIN que caiga
    // en una ruta que no le corresponde, y seguía mandándolo al mismo
    // lugar muerto. Mismo criterio: SUPER_ADMIN siempre a /admin.
    const destino =
      usuario.rol === 'SUPER_ADMIN' || usuario.rol === 'ADMIN'
        ? '/admin'
        : '/asistente';
    return router.createUrlTree([destino]);
  }

  return router.createUrlTree(['/ingresar']);
};
