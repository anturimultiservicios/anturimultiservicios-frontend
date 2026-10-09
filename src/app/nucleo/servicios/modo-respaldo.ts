import { BehaviorSubject } from 'rxjs';

// 2026-10-09 (servidor de respaldo): si el servidor de Anturi se cae, la página
// la atiende el Dell en "modo respaldo" (solo consulta). Cada respuesta del
// respaldo trae la cabecera x-anturi-respaldo; con eso se muestra el aviso.
// Se apaga sola con la primera respuesta del servidor principal.
export const modoRespaldo$ = new BehaviorSubject<boolean>(false);

export function anotarRespaldo(cabecera: string | null): void {
  const activo = cabecera === '1';
  if (modoRespaldo$.value !== activo) modoRespaldo$.next(activo);
}
