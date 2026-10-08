import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

// 2026-10-08: destino del enlace del correo de recuperación
// (/restablecer-contrasena?token=...). Antes el correo apuntaba aquí pero
// esta página no existía.
@Component({
  selector: 'anturi-restablecer-contrasena',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="rc-pagina">
      <div class="rc-tarjeta">
        <img src="/assets/imagenes/logo-2026.png" alt="Anturi" class="rc-logo">

        <ng-container *ngIf="!listo">
          <h1 class="rc-titulo">Crear nueva contraseña</h1>
          <p *ngIf="!token" class="rc-error">El enlace no es válido. Pida uno nuevo desde "¿Olvidó su contraseña?".</p>

          <ng-container *ngIf="token">
            <label class="rc-etiqueta" for="rc-nueva">Nueva contraseña</label>
            <input id="rc-nueva" type="password" class="rc-input" [(ngModel)]="nueva" autocomplete="new-password" placeholder="Mínimo 8 caracteres">

            <label class="rc-etiqueta" for="rc-confirmar">Repita la contraseña</label>
            <input id="rc-confirmar" type="password" class="rc-input" [(ngModel)]="confirmar" autocomplete="new-password" (keyup.enter)="guardar()">

            <div *ngIf="error" class="rc-error">{{ error }}</div>

            <button class="boton boton-primario rc-boton" (click)="guardar()" [disabled]="guardando">
              {{ guardando ? 'Guardando...' : 'Guardar contraseña' }}
            </button>
          </ng-container>
        </ng-container>

        <ng-container *ngIf="listo">
          <h1 class="rc-titulo">¡Listo!</h1>
          <p class="rc-texto">Su contraseña quedó cambiada. Ya puede ingresar con ella.</p>
          <a routerLink="/ingresar" class="boton boton-primario rc-boton">Ir a ingresar</a>
        </ng-container>

        <a *ngIf="!listo" routerLink="/ingresar" class="rc-volver">Volver a ingresar</a>
      </div>
    </div>
  `,
  styles: [`
    .rc-pagina { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--fondo-pagina, #f3f4f6); }
    .rc-tarjeta { width: min(420px, 100%); background: var(--fondo-tarjeta, #fff); border-radius: var(--radio-xl, 16px); padding: 32px 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); display: flex; flex-direction: column; gap: 10px; }
    .rc-logo { height: 56px; align-self: center; margin-bottom: 8px; }
    .rc-titulo { margin: 0 0 6px; text-align: center; font-size: var(--tamano-xl, 20px); color: var(--texto-principal, #111827); }
    .rc-texto { margin: 0; text-align: center; color: var(--texto-secundario, #4b5563); font-size: var(--tamano-sm, 14px); }
    .rc-etiqueta { font-size: var(--tamano-sm, 14px); font-weight: 600; color: var(--texto-principal, #111827); }
    .rc-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--borde-color, #d1d5db); border-radius: var(--radio-md, 8px); font-size: 16px; background: var(--fondo-input, #fff); color: var(--texto-principal, #111827); }
    .rc-error { padding: 8px 12px; border-radius: var(--radio-md, 8px); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); color: var(--color-error, #b91c1c); font-size: var(--tamano-sm, 14px); }
    .rc-boton { margin-top: 6px; width: 100%; justify-content: center; text-align: center; text-decoration: none; box-sizing: border-box; }
    .rc-volver { align-self: center; margin-top: 6px; font-size: var(--tamano-sm, 14px); color: var(--color-primario, #1B3270); text-decoration: none; }
  `],
})
export class RestablecerContrasenaComponent implements OnInit {
  token = '';
  nueva = '';
  confirmar = '';
  error = '';
  guardando = false;
  listo = false;

  constructor(private route: ActivatedRoute, private auth: AutenticacionServicio) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  guardar(): void {
    this.error = '';
    if (this.nueva.length < 8) { this.error = 'La contraseña debe tener al menos 8 caracteres.'; return; }
    if (this.nueva !== this.confirmar) { this.error = 'Las dos contraseñas no coinciden.'; return; }
    this.guardando = true;
    this.auth.restablecerContrasena(this.token, this.nueva).subscribe({
      next: () => { this.guardando = false; this.listo = true; },
      error: (err) => {
        this.guardando = false;
        const m = err?.error?.message;
        const texto = Array.isArray(m) ? m[0] : m;
        this.error = texto === 'Token inválido o expirado'
          ? 'El enlace ya venció o ya se usó. Pida uno nuevo desde "¿Olvidó su contraseña?".'
          : (texto || 'No se pudo guardar. Intente de nuevo.');
      },
    });
  }
}
