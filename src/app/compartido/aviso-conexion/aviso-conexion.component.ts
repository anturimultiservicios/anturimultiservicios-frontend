import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DatosLocalesServicio } from '../../nucleo/servicios/datos-locales.servicio';

// 2026-10-09 (plan "sin internet", pasos 1 y 2): avisito arriba en la mitad
// cuando se va el internet. Si hay datos guardados en el equipo, dice desde
// qué hora son (se puede buscar y consultar); si el navegador se cerró sin
// internet, pide la contraseña para abrirlos. Guardar cambios sin internet
// llega en el paso 3.
@Component({
  selector: 'anturi-aviso-conexion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="sinInternet" class="conexion conexion--sin" role="status">
      <span class="conexion__punto"></span>
      <ng-container [ngSwitch]="estado">
        <span *ngSwitchCase="'lista'">
          <b>Sin internet.</b> Puede buscar y consultar con los datos guardados {{ textoHora }}; para guardar cambios espere a que vuelva.
        </span>
        <span *ngSwitchCase="'bloqueada'" class="conexion__bloqueo">
          <b>Sin internet.</b> Escriba su contraseña para abrir los datos guardados:
          <form (ngSubmit)="desbloquear()" class="conexion__form">
            <input type="password" [(ngModel)]="contrasena" name="clave-local" autocomplete="current-password" placeholder="Contraseña">
            <button type="submit" [disabled]="abriendo || !contrasena">{{ abriendo ? '...' : 'Abrir' }}</button>
          </form>
          <span *ngIf="error" class="conexion__error">{{ error }}</span>
        </span>
        <span *ngSwitchDefault>
          <b>Sin internet.</b> La página sigue abierta; para guardar cambios espere a que vuelva la conexión.
        </span>
      </ng-container>
    </div>
    <div *ngIf="!sinInternet && volvio" class="conexion conexion--volvio" role="status">
      <span class="conexion__punto"></span>
      <span><b>Volvió el internet.</b> Ya puede guardar normalmente.</span>
    </div>
  `,
  styles: [`
    .conexion {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      z-index: 10001; display: flex; align-items: center; gap: 10px;
      max-width: calc(100vw - 24px); padding: 10px 16px; border-radius: 999px;
      font-size: 13.5px; line-height: 1.35; box-shadow: 0 10px 30px rgba(0,0,0,0.18);
      animation: entrar 0.3s ease-out both;
    }
    .conexion--sin { background: #fff7ed; color: #9a3412; border: 2px solid #f97316; }
    .conexion--volvio { background: #f0fdf4; color: #166534; border: 2px solid #22c55e; }
    .conexion__punto { flex-shrink: 0; width: 10px; height: 10px; border-radius: 50%; background: currentColor; }
    .conexion--sin .conexion__punto { background: #f97316; animation: latir 1.6s ease-in-out infinite; }
    .conexion--volvio .conexion__punto { background: #22c55e; }
    .conexion__bloqueo { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .conexion__form { display: inline-flex; gap: 6px; }
    .conexion__form input { padding: 4px 10px; border-radius: 999px; border: 1px solid #f97316; font-size: 13px; min-width: 150px; }
    .conexion__form button { padding: 4px 12px; border-radius: 999px; border: none; background: #ea580c; color: #fff; font-weight: 700; cursor: pointer; }
    .conexion__error { color: #b91c1c; font-weight: 600; }
    @keyframes entrar { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }
    @keyframes latir { 0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.5); } 60% { box-shadow: 0 0 0 6px rgba(249,115,22,0); } }
    @media (max-width: 480px) { .conexion { border-radius: 14px; font-size: 12.5px; } }
  `],
})
export class AvisoConexionComponent implements OnInit, OnDestroy {
  sinInternet = !navigator.onLine;
  volvio = false;
  estado: 'sin-copia' | 'bloqueada' | 'lista' = 'sin-copia';
  generado: Date | null = null;
  contrasena = '';
  abriendo = false;
  error = '';
  private subs: Subscription[] = [];
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private readonly alPerder = () => this.zona.run(() => { this.sinInternet = true; this.volvio = false; });
  private readonly alVolver = () => this.zona.run(() => {
    if (!this.sinInternet) return;
    this.sinInternet = false;
    this.volvio = true;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => (this.volvio = false), 4000);
  });

  constructor(private zona: NgZone, private datos: DatosLocalesServicio) {}

  get textoHora(): string {
    if (!this.generado) return '';
    const hoy = new Date();
    const hora = this.generado.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    return this.generado.toDateString() === hoy.toDateString()
      ? `de hoy a las ${hora}`
      : `del ${this.generado.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} a las ${hora}`;
  }

  ngOnInit(): void {
    window.addEventListener('offline', this.alPerder);
    window.addEventListener('online', this.alVolver);
    this.subs.push(this.datos.estado$.subscribe((e) => (this.estado = e)));
    this.subs.push(this.datos.generado$.subscribe((g) => (this.generado = g)));
  }

  async desbloquear(): Promise<void> {
    this.abriendo = true;
    this.error = '';
    const ok = await this.datos.desbloquear(this.contrasena);
    this.zona.run(() => {
      this.abriendo = false;
      this.contrasena = '';
      if (!ok) this.error = 'Contraseña incorrecta';
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('offline', this.alPerder);
    window.removeEventListener('online', this.alVolver);
    this.subs.forEach((s) => s.unsubscribe());
    if (this.temporizador) clearTimeout(this.temporizador);
  }
}
