import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { entorno } from '../../../environments/entorno';

// 2026-10-08 (pedido de Cristopher): el correo de ingreso
// (@anturimultiservicios.com) no es un buzón real, así que "Olvidé mi
// contraseña" no tenía a dónde mandar el enlace. Al entrar, si la persona no
// tiene un correo personal registrado, esta ventana se lo pide y no se puede
// cerrar hasta guardarlo. El Super Admin no la ve (su correo ya es real).
@Component({
  selector: 'anturi-correo-recuperacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="visible" class="cr-fondo">
      <div class="cr-ventana" role="dialog" aria-modal="true" aria-labelledby="cr-titulo">
        <div class="cr-icono">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="26" height="26">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
        </div>
        <h2 id="cr-titulo" class="cr-titulo">Registre su correo personal</h2>
        <p class="cr-texto">
          Si algún día olvida su contraseña, le enviaremos a este correo un enlace para crear una nueva.
          Use su correo de siempre (Gmail, Hotmail, Outlook…), no el de &#64;anturimultiservicios.com.
        </p>

        <label class="cr-etiqueta" for="cr-correo">Correo personal</label>
        <input id="cr-correo" type="email" class="cr-input" [(ngModel)]="correo" placeholder="ejemplo@gmail.com" autocomplete="email">

        <label class="cr-etiqueta" for="cr-confirmar">Escríbalo otra vez</label>
        <input id="cr-confirmar" type="email" class="cr-input" [(ngModel)]="confirmar" placeholder="ejemplo@gmail.com"
               autocomplete="off" (keyup.enter)="guardar()">

        <div *ngIf="error" class="cr-error">{{ error }}</div>

        <button class="boton boton-primario cr-boton" (click)="guardar()" [disabled]="guardando">
          {{ guardando ? 'Guardando...' : 'Guardar y continuar' }}
        </button>
      </div>
    </div>

    <div *ngIf="guardadoOk" class="cr-aviso" (click)="guardadoOk = false">
      Listo. Le enviamos un correo a {{ correoGuardado }} para que confirme que le llega.
    </div>
  `,
  styles: [`
    .cr-fondo { position: fixed; inset: 0; z-index: 3000; background: rgba(15, 23, 42, 0.55); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .cr-ventana { width: min(440px, 100%); background: var(--fondo-tarjeta, #fff); border-radius: var(--radio-xl, 16px); padding: 28px 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.25); display: flex; flex-direction: column; gap: 10px; }
    .cr-icono { width: 52px; height: 52px; border-radius: 50%; background: rgba(27, 50, 112, 0.1); color: var(--color-primario, #1B3270); display: flex; align-items: center; justify-content: center; align-self: center; }
    .cr-titulo { margin: 4px 0 0; text-align: center; font-size: var(--tamano-xl, 20px); color: var(--texto-principal, #111827); }
    .cr-texto { margin: 0 0 6px; text-align: center; font-size: var(--tamano-sm, 14px); color: var(--texto-secundario, #4b5563); line-height: 1.5; }
    .cr-etiqueta { font-size: var(--tamano-sm, 14px); font-weight: 600; color: var(--texto-principal, #111827); }
    .cr-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--borde-color, #d1d5db); border-radius: var(--radio-md, 8px); font-size: 16px; background: var(--fondo-input, #fff); color: var(--texto-principal, #111827); }
    .cr-error { padding: 8px 12px; border-radius: var(--radio-md, 8px); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); color: var(--color-error, #b91c1c); font-size: var(--tamano-sm, 14px); }
    .cr-boton { margin-top: 6px; width: 100%; justify-content: center; }
    .cr-aviso { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 3000; max-width: calc(100vw - 32px); padding: 12px 18px; border-radius: var(--radio-lg, 12px); background: #15803d; color: #fff; font-size: var(--tamano-sm, 14px); box-shadow: 0 10px 30px rgba(0,0,0,0.2); cursor: pointer; }
  `],
})
export class CorreoRecuperacionComponent implements OnInit {
  visible = false;
  correo = '';
  confirmar = '';
  error = '';
  guardando = false;
  guardadoOk = false;
  correoGuardado = '';
  private readonly URL = `${entorno.urlApi}/usuarios/me/correo-recuperacion`;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<{ correoRecuperacion: string | null; requerido: boolean }>(this.URL).subscribe({
      next: (r) => { this.visible = r.requerido && !r.correoRecuperacion; },
      error: () => { /* sin conexión: no bloquear el panel por esto */ },
    });
  }

  guardar(): void {
    const correo = this.correo.trim().toLowerCase();
    this.error = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      this.error = 'Escriba un correo electrónico válido.';
      return;
    }
    if (correo !== this.confirmar.trim().toLowerCase()) {
      this.error = 'Los dos correos no coinciden.';
      return;
    }
    if (correo.endsWith('@anturimultiservicios.com')) {
      this.error = 'Use su correo personal, no el de @anturimultiservicios.com.';
      return;
    }
    this.guardando = true;
    this.http.patch<{ correoRecuperacion: string }>(this.URL, { correo }).subscribe({
      next: (r) => {
        this.guardando = false;
        this.visible = false;
        this.correoGuardado = r.correoRecuperacion;
        this.guardadoOk = true;
        setTimeout(() => (this.guardadoOk = false), 7000);
      },
      error: (err) => {
        this.guardando = false;
        const m = err?.error?.message;
        this.error = (Array.isArray(m) ? m[0] : m) || 'No se pudo guardar. Intente de nuevo.';
      },
    });
  }
}
