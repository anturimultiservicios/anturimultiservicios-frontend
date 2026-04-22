import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Tema = 'tema-claro' | 'tema-oscuro';

@Injectable({ providedIn: 'root' })
export class TemaServicio {
  private readonly CLAVE = 'anturi_tema';
  private temaActual$ = new BehaviorSubject<Tema>('tema-claro');

  get tema$() {
    return this.temaActual$.asObservable();
  }

  get esOscuro(): boolean {
    return this.temaActual$.value === 'tema-oscuro';
  }

  inicializar(): void {
    const guardado = localStorage.getItem(this.CLAVE) as Tema | null;
    const tema: Tema = guardado ?? 'tema-claro';
    this.aplicar(tema);
  }

  alternar(): void {
    const nuevo: Tema =
      this.temaActual$.value === 'tema-claro' ? 'tema-oscuro' : 'tema-claro';
    this.aplicar(nuevo);
    localStorage.setItem(this.CLAVE, nuevo);
  }

  private aplicar(tema: Tema): void {
    const cuerpo = document.body;
    cuerpo.classList.remove('tema-claro', 'tema-oscuro');
    cuerpo.classList.add(tema);
    this.temaActual$.next(tema);
  }
}
