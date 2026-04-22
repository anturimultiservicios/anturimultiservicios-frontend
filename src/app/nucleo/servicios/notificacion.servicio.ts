import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Notificacion {
  id: string;
  tipo: 'exito' | 'error' | 'advertencia' | 'info';
  titulo: string;
  mensaje?: string;
  duracion?: number;
}

@Injectable({ providedIn: 'root' })
export class NotificacionServicio {
  private notificaciones$ = new BehaviorSubject<Notificacion[]>([]);

  get notificaciones() {
    return this.notificaciones$.asObservable();
  }

  mostrar(notificacion: Omit<Notificacion, 'id'>): void {
    const nueva: Notificacion = {
      ...notificacion,
      id: crypto.randomUUID(),
      duracion: notificacion.duracion ?? 4000,
    };
    this.notificaciones$.next([...this.notificaciones$.value, nueva]);

    setTimeout(() => this.cerrar(nueva.id), nueva.duracion);
  }

  exito(titulo: string, mensaje?: string): void {
    this.mostrar({ tipo: 'exito', titulo, mensaje });
  }

  error(titulo: string, mensaje?: string): void {
    this.mostrar({ tipo: 'error', titulo, mensaje, duracion: 6000 });
  }

  advertencia(titulo: string, mensaje?: string): void {
    this.mostrar({ tipo: 'advertencia', titulo, mensaje });
  }

  info(titulo: string, mensaje?: string): void {
    this.mostrar({ tipo: 'info', titulo, mensaje });
  }

  cerrar(id: string): void {
    this.notificaciones$.next(
      this.notificaciones$.value.filter((n) => n.id !== id)
    );
  }
}
