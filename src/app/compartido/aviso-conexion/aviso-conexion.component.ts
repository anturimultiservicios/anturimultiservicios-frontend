import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

// 2026-10-09 (plan "sin internet", paso 1): avisito arriba en la mitad
// cuando se va el internet, y otro verde cuando vuelve. La página sigue
// abierta y funcionando; mientras no haya conexión, los cambios no se pueden
// guardar todavía (eso llega en el paso 3: guardar y subir solo después).
@Component({
  selector: 'anturi-aviso-conexion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="sinInternet" class="conexion conexion--sin" role="status">
      <span class="conexion__punto"></span>
      <span><b>Sin internet.</b> La página sigue abierta; para guardar cambios espere a que vuelva la conexión.</span>
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
    @keyframes entrar { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }
    @keyframes latir { 0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.5); } 60% { box-shadow: 0 0 0 6px rgba(249,115,22,0); } }
    @media (max-width: 480px) { .conexion { border-radius: 14px; font-size: 12.5px; } }
  `],
})
export class AvisoConexionComponent implements OnInit, OnDestroy {
  sinInternet = !navigator.onLine;
  volvio = false;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private readonly alPerder = () => this.zona.run(() => { this.sinInternet = true; this.volvio = false; });
  private readonly alVolver = () => this.zona.run(() => {
    if (!this.sinInternet) return;
    this.sinInternet = false;
    this.volvio = true;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => (this.volvio = false), 4000);
  });

  constructor(private zona: NgZone) {}

  ngOnInit(): void {
    window.addEventListener('offline', this.alPerder);
    window.addEventListener('online', this.alVolver);
  }

  ngOnDestroy(): void {
    window.removeEventListener('offline', this.alPerder);
    window.removeEventListener('online', this.alVolver);
    if (this.temporizador) clearTimeout(this.temporizador);
  }
}
