import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { rutas } from './app.routes';
import { tokenInterceptor } from './nucleo/interceptores/token.interceptor';

export function crearCargadorTraduccion(http: HttpClient) {
  // Se arma a partir de <base href> en vez de hardcodear '/assets/i18n/' -
  // en producción (base href '/') da exactamente lo mismo que antes; en un
  // despliegue bajo subruta (ej. entornos de prueba temporales) resuelve
  // correctamente sin depender de que el path sea la raíz del dominio.
  const rutaBase = new URL(document.baseURI).pathname;
  return new TranslateHttpLoader(http, `${rutaBase}assets/i18n/`, '.json');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(rutas, withViewTransitions()),
    provideHttpClient(withInterceptors([tokenInterceptor])),
    provideAnimations(),
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
