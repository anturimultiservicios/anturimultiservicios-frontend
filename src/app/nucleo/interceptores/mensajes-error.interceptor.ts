import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

// 2026-10-16 (revisión de fallas): cuando el servidor rechaza varios datos a
// la vez manda una lista de mensajes, y las pantallas los mostraban pegados
// con comas. Se juntan en un solo texto legible para TODAS las pantallas.
export const mensajesErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const cuerpo = error?.error;
      if (cuerpo && typeof cuerpo === 'object' && Array.isArray(cuerpo.message)) {
        cuerpo.message = cuerpo.message.filter(Boolean).join('. ');
      }
      return throwError(() => error);
    }),
  );
