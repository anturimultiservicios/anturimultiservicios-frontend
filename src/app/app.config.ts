import { ApplicationConfig, importProvidersFrom, isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter, withViewTransitions, withNavigationErrorHandler, NavigationError } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { rutas } from './app.routes';
import { tokenInterceptor } from './nucleo/interceptores/token.interceptor';

export function crearCargadorTraduccion(http: HttpClient) {
  return new TranslateHttpLoader(http, '/assets/i18n/', '.json');
}

// 2026-10-08 (bug real): con el sistema abierto desde antes de una
// publicación nueva, la pestaña seguía pidiendo los archivos viejos de cada
// pantalla - Cloudflare ya los había reemplazado, así que el botón (ej.
// Afiliados) "no hacía nada". Si una pantalla no logra cargar su archivo, se
// recarga la página en esa misma dirección y queda con la versión nueva.
// Una sola vez por minuto, para no entrar en un ciclo si el problema es otro.
export function recargarSiFaltaArchivo(error: NavigationError): void {
  const texto = String((error.error as any)?.message ?? error.error ?? '');
  const faltaArchivo = /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|module script/i.test(texto);
  if (!faltaArchivo) return;
  try {
    const ultima = Number(sessionStorage.getItem('anturi_recarga_version') || 0);
    if (Date.now() - ultima < 60_000) return;
    sessionStorage.setItem('anturi_recarga_version', String(Date.now()));
  } catch { /* sin sessionStorage: igual se recarga */ }
  window.location.assign(error.url);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(rutas, withViewTransitions(), withNavigationErrorHandler(recargarSiFaltaArchivo)),
    provideHttpClient(withInterceptors([tokenInterceptor])),
    provideAnimations(),
    // 2026-10-09 (plan "sin internet", paso 1): la página queda guardada en
    // el equipo y abre/funciona aunque se vaya el internet. Solo en producción.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'es',
        loader: {
          provide: TranslateLoader,
          useFactory: crearCargadorTraduccion,
          deps: [HttpClient],
        },
      })
    ),
  ],
};
