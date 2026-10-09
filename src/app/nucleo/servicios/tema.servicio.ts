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

  // 2026-09-29 (decisión de Cristopher): el cambio de tema solo tiene
  // sentido DESPUÉS de iniciar sesión (admin/secretaria/super-admin) - la
  // página pública y el login se quedan siempre en modo claro, sin botón.
  // No se toca localStorage acá - la preferencia real de la persona sigue
  // guardada, se re-aplica sola en cuanto vuelve a una pantalla con sesión
  // (ver restaurarPreferencia()).
  forzarClaro(): void {
    const cuerpo = document.body;
    cuerpo.classList.remove('tema-claro', 'tema-oscuro', 'tema-bn');
    cuerpo.classList.add('tema-claro');
    this.temaActual$.next('tema-claro');
  }

  // 2026-10-09 (pedido de Cristopher): para Anyi, el modo oscuro es en
  // blanco y negro (fondo negro, letras blancas, botones gris oscuro
  // "levantados"; rojo solo para alertas; el bot sigue a color). Es una
  // preferencia por persona: viene activada para Anyi y cualquiera puede
  // activarla o quitarla en Configuración.
  private readonly ANYI_ID = 16;

  private claveBn(): string | null {
    try {
      const id = JSON.parse(localStorage.getItem('anturi_usuario') || 'null')?.id;
      return id ? `anturi_tema_bn_${id}` : null;
    } catch { return null; }
  }

  get blancoNegro(): boolean {
    const clave = this.claveBn();
    if (!clave) return false;
    const guardado = localStorage.getItem(clave);
    if (guardado !== null) return guardado === '1';
    return clave === `anturi_tema_bn_${this.ANYI_ID}`;
  }

  set blancoNegro(valor: boolean) {
    const clave = this.claveBn();
    if (clave) localStorage.setItem(clave, valor ? '1' : '0');
    this.aplicar(this.temaActual$.value);
  }

  restaurarPreferencia(): void {
    const guardado = localStorage.getItem(this.CLAVE) as Tema | null;
    this.aplicar(guardado ?? 'tema-claro');
  }

  private aplicar(tema: Tema): void {
    const cuerpo = document.body;
    cuerpo.classList.remove('tema-claro', 'tema-oscuro');
    cuerpo.classList.add(tema);
    cuerpo.classList.toggle('tema-bn', tema === 'tema-oscuro' && this.blancoNegro);
    this.temaActual$.next(tema);
  }
}
