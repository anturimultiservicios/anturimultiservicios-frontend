import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface EstadoMantenimiento {
  activo: boolean;
  desde: string | null;
  avisoDesde: string | null;
  mensaje: string;
}

const CLAVE = 'anturi_mantenimiento';

// 2026-10-23 (Cristopher): mantenimiento programado de toda la página. Se
// guarda el último estado conocido para que, si durante el trabajo el
// servidor no responde, la página siga mostrando el letrero y no un error.
@Injectable({ providedIn: 'root' })
export class MantenimientoServicio {
  private readonly URL = `${entorno.urlApi}/mantenimiento`;
  private readonly URL_GESTION = `${entorno.urlApi}/horario-acceso/mantenimiento`;

  private estadoSubject = new BehaviorSubject<EstadoMantenimiento | null>(this.leerGuardado());
  readonly estado$ = this.estadoSubject.asObservable();

  constructor(private http: HttpClient) {}

  consultar(): Observable<EstadoMantenimiento> {
    return this.http.get<EstadoMantenimiento>(this.URL).pipe(tap((e) => this.guardar(e)));
  }

  // Si el servidor no contesta: vale lo guardado, ya con la hora de hoy.
  sinRespuesta(): void {
    const e = this.estadoSubject.value;
    if (e?.desde && new Date(e.desde).getTime() <= Date.now() && !e.activo) this.guardar({ ...e, activo: true });
  }

  // El backend cortó una petición por mantenimiento (interceptor).
  marcarActivo(mensaje: string): void {
    const e = this.estadoSubject.value;
    this.guardar({ activo: true, desde: e?.desde ?? new Date().toISOString(), avisoDesde: e?.avisoDesde ?? null, mensaje });
  }

  // Gestión: solo Super Admin (el backend también lo exige)
  programar(desde: string, avisoDesde: string | null): Observable<EstadoMantenimiento> {
    return this.http.put<EstadoMantenimiento>(this.URL_GESTION, { desde, ...(avisoDesde ? { avisoDesde } : {}) }).pipe(tap((e) => this.guardar(e)));
  }

  terminar(): Observable<EstadoMantenimiento> {
    return this.http.delete<EstadoMantenimiento>(this.URL_GESTION).pipe(tap((e) => this.guardar(e)));
  }

  private guardar(e: EstadoMantenimiento): void {
    try {
      if (e.desde) localStorage.setItem(CLAVE, JSON.stringify(e));
      else localStorage.removeItem(CLAVE);
    } catch {}
    this.estadoSubject.next(e);
  }

  private leerGuardado(): EstadoMantenimiento | null {
    try {
      const e = JSON.parse(localStorage.getItem(CLAVE) || 'null') as EstadoMantenimiento | null;
      if (e?.desde && new Date(e.desde).getTime() <= Date.now()) e.activo = true;
      return e;
    } catch {
      return null;
    }
  }
}
