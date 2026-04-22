import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AutenticacionServicio } from '../servicios/autenticacion.servicio';

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AutenticacionServicio);
  const token = auth.obtenerToken();

  const solicitudConToken = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(solicitudConToken).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('refrescar')) {
        return auth.refrescarToken().pipe(
          switchMap((res) => {
            const reintentoConToken = req.clone({
              setHeaders: { Authorization: `Bearer ${res.acceso}` },
            });
            return next(reintentoConToken);
          }),
          catchError(() => {
            auth.cerrarSesion();
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
