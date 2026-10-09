import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';
import { AutenticacionServicio } from './autenticacion.servicio';

export type EstadoPresencia = 'EN_LINEA' | 'AUSENTE' | 'SIN_CONEXION' | 'SIN_SESION';

export interface PresenciaUsuario {
  id: number;
  estado: EstadoPresencia;
  ultimoLatido: string | null;
  ultimaActividad: string | null;
}

// 2026-10-09 (pedido de Cristopher): con la sesión abierta, el navegador
// avisa cada 30 s que sigue conectado y si la persona tocó algo. Con eso el
// Super Admin ve en "Usuarios del sistema" quién está en línea, ausente
// (40 min sin tocar nada), sin internet o sin sesión.
@Injectable({ providedIn: 'root' })
export class PresenciaServicio {
  private readonly URL = `${entorno.urlApi}/usuarios`;
  private iniciado = false;
  private huboActividad = true;

  constructor(private http: HttpClient, private auth: AutenticacionServicio, private zona: NgZone) {}

  iniciar(): void {
    if (this.iniciado) return;
    this.iniciado = true;
    // Fuera de Angular: escuchar el mouse/teclado no debe redibujar la pantalla.
    this.zona.runOutsideAngular(() => {
      const marcar = () => { this.huboActividad = true; };
      for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) {
        document.addEventListener(ev, marcar, { passive: true });
      }
      setInterval(() => this.latir(), 30_000);
      // Volvió el internet o volvió a la pestaña: avisar de una vez.
      window.addEventListener('online', () => this.latir());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.latir(); });
    });
    this.latir();
  }

  private latir(): void {
    if (!this.auth.estaAutenticado || !navigator.onLine) return;
    const activo = this.huboActividad;
    this.huboActividad = false;
    this.http.post(`${this.URL}/me/latido`, { activo }).subscribe({ error: () => { this.huboActividad = this.huboActividad || activo; } });
  }

  // Solo Super Admin.
  estados(): Observable<PresenciaUsuario[]> {
    return this.http.get<PresenciaUsuario[]>(`${this.URL}/presencia`);
  }
}
