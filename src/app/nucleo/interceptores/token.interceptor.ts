import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, Observable, shareReplay, finalize } from 'rxjs';
import { AutenticacionServicio } from '../servicios/autenticacion.servicio';

// Refresco compartido (2026-09-28): si varias peticiones fallan con 401 al
// mismo tiempo (ej. el Resumen, que dispara 3 peticiones en paralelo por
// forkJoin), antes cada una llamaba a /refrescar por su cuenta. Si el
// backend rota el refresh token (invalida el viejo al emitir uno nuevo),
// solo la primera llamada ganaba y las demas recibian 401 en la propia
// llamada de refresco -> cerrarSesion() de mas, sin necesidad. Ahora todas
// las peticiones que fallan mientras ya hay un refresco en curso esperan
// ESE MISMO refresco (compartido via shareReplay) en vez de disparar uno
// cada una - se limpia con finalize para que el siguiente 401, ya con el
// refresco terminado, si dispare uno nuevo.
let refrescoEnCurso$: Observable<{ acceso: string }> | null = null;

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AutenticacionServicio);
  const token = auth.obtenerToken();

  const solicitudConToken = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(solicitudConToken).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('refrescar')) {
        if (!refrescoEnCurso$) {
          refrescoEnCurso$ = auth.refrescarToken().pipe(
            shareReplay({ bufferSize: 1, refCount: true }),
            finalize(() => { refrescoEnCurso$ = null; })
          );
        }
        return refrescoEnCurso$.pipe(
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
