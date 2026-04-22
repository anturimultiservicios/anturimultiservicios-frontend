import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

export interface Idioma {
  codigo: string;
  nombre: string;
  bandera: string;
}

@Injectable({ providedIn: 'root' })
export class IdiomaServicio {
  private readonly CLAVE = 'anturi_idioma';

  readonly idiomasDisponibles: Idioma[] = [
    { codigo: 'es', nombre: 'Español', bandera: 'CO' },
    { codigo: 'en', nombre: 'English', bandera: 'US' },
    { codigo: 'fr', nombre: 'Français', bandera: 'FR' },
    { codigo: 'de', nombre: 'Deutsch', bandera: 'DE' },
  ];

  private idiomaActual$ = new BehaviorSubject<Idioma>(this.idiomasDisponibles[0]);

  get idioma$() {
    return this.idiomaActual$.asObservable();
  }

  get idiomaActual(): Idioma {
    return this.idiomaActual$.value;
  }

  constructor(private translate: TranslateService) {}

  inicializar(): void {
    const guardado = localStorage.getItem(this.CLAVE);
    const idioma = this.idiomasDisponibles.find((i) => i.codigo === guardado)
      ?? this.idiomasDisponibles[0];
    this.aplicar(idioma);
  }

  cambiar(codigo: string): void {
    const idioma = this.idiomasDisponibles.find((i) => i.codigo === codigo);
    if (idioma) {
      this.aplicar(idioma);
      localStorage.setItem(this.CLAVE, codigo);
    }
  }

  private aplicar(idioma: Idioma): void {
    this.translate.use(idioma.codigo);
    this.idiomaActual$.next(idioma);
    document.documentElement.lang = idioma.codigo;
  }
}
