import { Injectable, NgZone } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';

// 2026-10-08 (bug real: "Afiliados no abre"): si la pestaña quedó abierta
// mientras se publicaba una versión nueva, sus pantallas apuntan a archivos
// que Cloudflare ya borró y el botón "no hace nada". Este servicio revisa
// cada 5 minutos (y al volver a la pestaña) si index.html trae otro
// main-*.js; si cambió, el SIGUIENTE clic carga la página completa en vez de
// navegar por dentro - así siempre queda con la versión nueva.
@Injectable({ providedIn: 'root' })
export class VersionServicio {
  private hayVersionNueva = false;
  private readonly actual = this.leerMainActual();

  constructor(private router: Router, private zona: NgZone) {}

  iniciar(): void {
    if (!this.actual) return; // en desarrollo (ng serve) no hay main-*.js con hash
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart && this.hayVersionNueva) {
        window.location.assign(e.url);
      }
    });
    this.zona.runOutsideAngular(() => {
      setInterval(() => this.revisar(), 5 * 60_000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.revisar();
      });
    });
  }

  private leerMainActual(): string | null {
    const script = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))
      .map((s) => s.getAttribute('src') || '')
      .find((src) => /main-[A-Z0-9]+\.js/i.test(src));
    return script ? script.match(/main-[A-Z0-9]+\.js/i)![0] : null;
  }

  private async revisar(): Promise<void> {
    if (this.hayVersionNueva) return;
    try {
      const html = await (await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' })).text();
      const publicado = html.match(/main-[A-Z0-9]+\.js/i)?.[0];
      if (publicado && publicado !== this.actual) this.hayVersionNueva = true;
    } catch {
      /* sin conexión: se revisa en la próxima vuelta */
    }
  }
}
