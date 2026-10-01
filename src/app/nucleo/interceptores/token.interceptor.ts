import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, Observable, shareReplay, finalize } from 'rxjs';
import { AutenticacionServicio } from '../servicios/autenticacion.servicio';
import { HorarioAccesoServicio } from '../servicios/horario-acceso.servicio';

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

// 2026-10-01 (decisión de Cristopher, seguridad): el backend corta CUALQUIER
// request fuera del horario de acceso con un 401 que trae este mensaje
// exacto (JwtEstrategia, AutenticacionServicio.refrescarToken) - se detecta
// acá antes de intentar el refresco normal (que fallaría igual, con el
// mismo mensaje, por las dudas) y se muestra la pantalla completa en vez
// de un cierre de sesión silencioso.
const esCorteFueraDeHorario = (error: HttpErrorResponse): boolean =>
  typeof error.error?.message === 'string' && error.error.message.includes('Fuera de horario de acceso');

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AutenticacionServicio);
  const horarioServicio = inject(HorarioAccesoServicio);
  const token = auth.obtenerToken();

  const solicitudConToken = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(solicitudConToken).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && esCorteFueraDeHorario(error)) {
        auth.cerrarSesion();
        horarioServicio.anunciarCierreForzado(error.error.message);
        return throwError(() => error);
      }

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
