import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DatosLocalesServicio } from '../../nucleo/servicios/datos-locales.servicio';
import { ColaCambiosServicio, EstadoCola } from '../../nucleo/servicios/cola-cambios.servicio';
import { modoRespaldo$ } from '../../nucleo/servicios/modo-respaldo';

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
          <b>Sin internet.</b> Puede seguir trabajando con los datos guardados {{ textoHora }}
          <ng-container *ngIf="cola.pendientes > 0"> · <b>{{ cola.pendientes }} cambio{{ cola.pendientes !== 1 ? 's' : '' }}</b> guardado{{ cola.pendientes !== 1 ? 's' : '' }} en este equipo: se suben solos cuando vuelva el internet.</ng-container>
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
    <!-- 2026-10-09: el servidor de Anturi está caído y atiende el respaldo (Dell) -->
    <div *ngIf="!sinInternet && respaldo" class="conexion conexion--sin" role="status">
      <span class="conexion__punto"></span>
      <span><b>Modo respaldo.</b> El servidor principal de Anturi no responde: puede buscar y consultar normal. Lo que registre se guarda en este equipo y se sube solo cuando vuelva<ng-container *ngIf="cola.pendientes > 0"> ({{ cola.pendientes }} cambio{{ cola.pendientes !== 1 ? 's' : '' }} esperando)</ng-container>.</span>
    </div>
    <div *ngIf="!sinInternet && cola.subiendo" class="conexion conexion--volvio" role="status">
      <span class="conexion__punto"></span>
      <span><b>Volvió el internet.</b> Subiendo los cambios hechos sin internet...</span>
    </div>
    <div *ngIf="!sinInternet && !cola.subiendo && (volvio || mostrarSubidos)" class="conexion conexion--volvio" role="status">
      <span class="conexion__punto"></span>
      <span>
        <b>{{ mostrarSubidos ? 'Listo.' : 'Volvió el internet.' }}</b>
        <ng-container *ngIf="mostrarSubidos"> {{ subidos === 1 ? 'Se subió 1 cambio hecho' : 'Se subieron ' + subidos + ' cambios hechos' }} sin internet.</ng-container>
        <ng-container *ngIf="!mostrarSubidos"> Ya puede guardar normalmente.</ng-container>
      </span>
    </div>
    <!-- cambios que el servidor no aceptó: quedan para revisar -->
    <div *ngIf="!sinInternet && cola.conProblema.length" class="problemas" role="alert">
      <button type="button" class="problemas__titulo" (click)="verProblemas = !verProblemas">
        ⚠ {{ cola.conProblema.length }} cambio{{ cola.conProblema.length !== 1 ? 's' : '' }} hecho{{ cola.conProblema.length !== 1 ? 's' : '' }} sin internet no se pudo subir - {{ verProblemas ? 'ocultar' : 'ver' }}
      </button>
      <div *ngIf="verProblemas" class="problemas__lista">
        <div *ngFor="let c of cola.conProblema" class="problemas__item">
          <b>{{ c.descripcion }}</b> <small>({{ c.creadoEn | date:'dd/MM HH:mm' }})</small>
          <div class="problemas__error">{{ c.error }}</div>
          <div class="problemas__acciones">
            <button type="button" (click)="colaServicio.reintentar(c.id)">Subir de todos modos</button>
            <button type="button" (click)="descartar(c.id)">Descartar</button>
          </div>
        </div>
      </div>
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
    .problemas { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 10001; max-width: min(560px, calc(100vw - 24px)); background: #fff7ed; color: #9a3412; border: 2px solid #f97316; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.18); font-size: 13.5px; }
    .problemas__titulo { width: 100%; padding: 10px 16px; border: none; background: none; color: inherit; font-weight: 700; cursor: pointer; text-align: left; }
    .problemas__lista { max-height: 50vh; overflow-y: auto; padding: 0 16px 12px; display: flex; flex-direction: column; gap: 10px; }
    .problemas__item { background: #fff; border-radius: 10px; padding: 8px 10px; color: #1f2937; }
    .problemas__error { color: #b91c1c; margin: 4px 0 6px; }
    .problemas__acciones { display: flex; gap: 8px; flex-wrap: wrap; }
    .problemas__acciones button { padding: 4px 10px; border-radius: 999px; border: 1px solid #ea580c; background: #fff; color: #9a3412; font-weight: 600; cursor: pointer; }
    @keyframes entrar { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }
    @keyframes latir { 0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.5); } 60% { box-shadow: 0 0 0 6px rgba(249,115,22,0); } }
    @media (max-width: 480px) { .conexion { border-radius: 14px; font-size: 12.5px; } }
  `],
})
export class AvisoConexionComponent implements OnInit, OnDestroy {
  sinInternet = !navigator.onLine;
  respaldo = false;
  private subRespaldo?: Subscription;
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

  cola: EstadoCola = { pendientes: 0, subiendo: false, conProblema: [], recienSubidos: 0 };
  verProblemas = false;
  mostrarSubidos = false;
  subidos = 0;
  private temporizadorSubidos: ReturnType<typeof setTimeout> | null = null;

  constructor(private zona: NgZone, private datos: DatosLocalesServicio, public colaServicio: ColaCambiosServicio) {}

  descartar(id: string): void {
    if (confirm('¿Descartar este cambio? No se subirá al sistema.')) this.colaServicio.descartar(id);
  }

  get textoHora(): string {
    if (!this.generado) return '';
    const hoy = new Date();
    const hora = this.generado.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    return this.generado.toDateString() === hoy.toDateString()
      ? `de hoy a las ${hora}`
      : `del ${this.generado.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} a las ${hora}`;
  }

  ngOnInit(): void {
    this.subRespaldo = modoRespaldo$.subscribe((r) => this.zona.run(() => (this.respaldo = r)));
    window.addEventListener('offline', this.alPerder);
    window.addEventListener('online', this.alVolver);
    this.subs.push(this.datos.estado$.subscribe((e) => (this.estado = e)));
    this.subs.push(this.datos.generado$.subscribe((g) => (this.generado = g)));
    this.subs.push(this.colaServicio.estado$.subscribe((e) => {
      this.cola = e;
      if (e.recienSubidos > 0 && !e.subiendo) {
        this.subidos = e.recienSubidos;
        this.mostrarSubidos = true;
        if (this.temporizadorSubidos) clearTimeout(this.temporizadorSubidos);
        this.temporizadorSubidos = setTimeout(() => (this.mostrarSubidos = false), 6000);
      }
    }));
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
    this.subRespaldo?.unsubscribe();
    window.removeEventListener('offline', this.alPerder);
    window.removeEventListener('online', this.alVolver);
    this.subs.forEach((s) => s.unsubscribe());
    if (this.temporizador) clearTimeout(this.temporizador);
  }
}
