import { Injectable, NgZone } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { BehaviorSubject, filter } from 'rxjs';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';

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
  // 2026-10-09: lo escucha el aviso del bot ("hay una actualización, recargue")
  readonly versionNueva$ = new BehaviorSubject<boolean>(false);

  constructor(private router: Router, private zona: NgZone, private sw: SwUpdate) {}

  iniciar(): void {
    if (!this.actual) return; // en desarrollo (ng serve) no hay main-*.js con hash
    // 2026-10-09: con la página guardada en el equipo (service worker), es
    // él quien descarga la versión nueva por detrás y avisa cuando está
    // lista; recargar la activa. Las pantallas viejas siguen guardadas, así
    // que ya no hay archivos "perdidos" mientras tanto.
    if (this.sw.isEnabled) {
      this.sw.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => { this.hayVersionNueva = true; this.versionNueva$.next(true); });
      this.zona.runOutsideAngular(() => {
        const revisar = () => { if (navigator.onLine) this.sw.checkForUpdate().catch(() => undefined); };
        setInterval(revisar, 2 * 60_000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisar(); });
        window.addEventListener('online', revisar);
      });
      return;
    }
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart && this.hayVersionNueva) {
        window.location.assign(e.url);
      }
    });
    this.zona.runOutsideAngular(() => {
      setInterval(() => this.revisar(), 2 * 60_000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.revisar();
      });
    });
  }

  // "Recargar ahora" del aviso: activa la versión nueva y recarga.
  recargar(): void {
    if (this.sw.isEnabled) {
      this.sw.activateUpdate().catch(() => undefined).finally(() => window.location.reload());
    } else {
      window.location.reload();
    }
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
      if (publicado && publicado !== this.actual) {
        this.hayVersionNueva = true;
        this.zona.run(() => this.versionNueva$.next(true));
      }
    } catch {
      /* sin conexión: se revisa en la próxima vuelta */
    }
  }
}
