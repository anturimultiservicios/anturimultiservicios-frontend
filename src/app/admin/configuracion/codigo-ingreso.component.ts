import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';
import { entorno } from '../../../environments/entorno';

// 2026-10-09 (pedido de Cristopher): el Super Admin no depende de equipos
// autorizados, así que se protege con el código de Google Authenticator en
// cada ingreso. Para prenderlo (o apagarlo) hay que escribir un código
// correcto: así nunca se exige sin tenerlo a la mano.
@Component({
  selector: 'anturi-codigo-ingreso',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tarjeta ci" *ngIf="estado">
      <div class="ci__cab">
        <div>
          <h3 class="ci__titulo">🔐 Código de Google Authenticator al ingresar</h3>
          <p class="ci__texto">Además de su contraseña, la página le pedirá el código de 6 dígitos de <b>Anturi Multiservicios</b> cada vez que entre. Así, aunque alguien sepa su contraseña, no puede entrar sin su celular.</p>
        </div>
        <span class="ci__estado" [class.ci__estado--on]="estado.exigirEnIngreso">{{ estado.exigirEnIngreso ? 'Activo' : 'Apagado' }}</span>
      </div>
      <p *ngIf="!estado.totpActivo" class="ci__aviso">Esta cuenta todavía no tiene Google Authenticator configurado.</p>
      <form *ngIf="estado.totpActivo" class="ci__form" (ngSubmit)="cambiar()">
        <label class="campo-etiqueta" for="ciCodigo">{{ estado.exigirEnIngreso ? 'Para apagarlo, escriba el código actual' : 'Para activarlo, escriba el código que ve ahora en la app' }}</label>
        <div class="ci__fila">
          <input id="ciCodigo" name="ciCodigo" class="campo-input ci__codigo" inputmode="numeric" maxlength="8" autocomplete="one-time-code" placeholder="000000" [(ngModel)]="codigo">
          <button type="submit" class="boton" [class.boton-primario]="!estado.exigirEnIngreso" [class.boton-secundario]="estado.exigirEnIngreso" [disabled]="guardando || codigo.replace(' ', '').length < 6">
            {{ guardando ? 'Verificando...' : (estado.exigirEnIngreso ? 'Apagar' : 'Activar') }}
          </button>
        </div>
      </form>
      <!-- 2026-10-09: si la entrada de la app no coincide, vincular de nuevo con un QR -->
      <button *ngIf="estado.totpActivo && !revincular" type="button" class="ci__enlace" (click)="revincular = 'clave'; error = ''; mensaje = ''">¿El código no funciona? Vincular Google Authenticator de nuevo</button>
      <div *ngIf="revincular" class="ci__revincular">
        <ng-container *ngIf="revincular === 'clave'">
          <p class="ci__paso"><b>Paso 1.</b> Por seguridad, escriba su contraseña de la página.</p>
          <form class="ci__fila" (ngSubmit)="pedirQr()">
            <input type="password" name="ciClave" class="campo-input" autocomplete="current-password" placeholder="Contraseña" [(ngModel)]="contrasena">
            <button type="submit" class="boton boton-primario" [disabled]="guardando || !contrasena">{{ guardando ? '...' : 'Continuar' }}</button>
          </form>
        </ng-container>
        <ng-container *ngIf="revincular === 'qr' && qr">
          <p class="ci__paso"><b>Paso 2.</b> En Google Authenticator toque <b>+</b> → <b>Escanear un código QR</b> y escanee este código. Se crea la entrada <b>{{ cuenta }}</b>.</p>
          <div class="ci__qr">
            <img [src]="qr" alt="Código QR para Google Authenticator" width="200" height="200">
            <div class="ci__manual">¿No puede escanear? Elija <b>Ingresar clave de configuración</b> y escriba:<br><code>{{ secreto }}</code></div>
          </div>
          <p class="ci__paso"><b>Paso 3.</b> Escriba el código que aparece en esa <b>entrada nueva</b>:</p>
          <form class="ci__fila" (ngSubmit)="confirmarQr()">
            <input name="ciNuevo" class="campo-input ci__codigo" inputmode="numeric" maxlength="8" autocomplete="one-time-code" placeholder="000000" [(ngModel)]="codigoNuevo">
            <button type="submit" class="boton boton-primario" [disabled]="guardando || codigoNuevo.replace(' ', '').length < 6">{{ guardando ? 'Verificando...' : 'Confirmar y activar' }}</button>
          </form>
          <p class="ci__nota">Después puede borrar de la app la entrada vieja de "Anturi Multiservicios" que no funcionaba.</p>
        </ng-container>
        <button type="button" class="ci__enlace" (click)="cancelarRevincular()">Cancelar</button>
      </div>
      <div *ngIf="mensaje" class="ci__ok">{{ mensaje }}</div>
      <div *ngIf="error" class="ci__error">{{ error }}</div>
    </div>
  `,
  styles: [`
    .ci { padding: var(--espacio-5, 20px); display: flex; flex-direction: column; gap: 10px; }
    .ci__cab { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .ci__titulo { margin: 0 0 4px; font-size: 17px; color: var(--texto-principal); }
    .ci__texto { margin: 0; color: var(--texto-secundario); font-size: 14px; }
    .ci__estado { white-space: nowrap; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 700; background: #fdecea; color: #b42318; }
    .ci__estado--on { background: #e8f5e9; color: #1b5e20; }
    .ci__fila { display: flex; gap: 8px; }
    .ci__codigo { max-width: 180px; font-size: 22px; letter-spacing: 6px; text-align: center; }
    .ci__aviso { color: #7a4b00; background: #fff7e6; padding: 8px 12px; border-radius: 8px; margin: 0; }
    .ci__enlace { align-self: flex-start; background: none; border: none; padding: 0; color: var(--color-primario, #1b3270); text-decoration: underline; cursor: pointer; font-size: 14px; }
    .ci__revincular { border: 1px dashed var(--borde-color, #e3e7ef); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .ci__paso { margin: 0; font-size: 14px; color: var(--texto-principal); }
    .ci__qr { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
    .ci__qr img { background: #fff; padding: 6px; border-radius: 8px; border: 1px solid var(--borde-color, #e3e7ef); }
    .ci__manual { font-size: 13px; color: var(--texto-secundario); max-width: 320px; }
    .ci__manual code { display: inline-block; margin-top: 4px; font-size: 14px; letter-spacing: 1px; background: #f3f5f9; padding: 4px 8px; border-radius: 6px; word-break: break-all; color: #111a3d; }
    .ci__nota { margin: 0; font-size: 12px; color: var(--texto-terciario); }
    .ci__ok { color: #1b5e20; background: #e8f5e9; padding: 8px 12px; border-radius: 8px; }
    .ci__error { color: #b42318; background: #fdecea; padding: 8px 12px; border-radius: 8px; }
  `],
})
export class CodigoIngresoComponent implements OnInit {
  private readonly URL = `${entorno.urlApi}/recuperacion-super-admin/ingreso`;
  estado: { totpActivo: boolean; exigirEnIngreso: boolean } | null = null;
  codigo = '';
  guardando = false;
  mensaje = '';
  error = '';
  // volver a vincular
  revincular: '' | 'clave' | 'qr' = '';
  contrasena = '';
  qr = '';
  secreto = '';
  cuenta = '';
  codigoNuevo = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<{ totpActivo: boolean; exigirEnIngreso: boolean }>(this.URL).pipe(catchError(() => of(null))).subscribe((e) => (this.estado = e));
  }

  pedirQr(): void {
    this.guardando = true;
    this.error = '';
    this.http.post<{ qr: string; secreto: string; cuenta: string }>(`${entorno.urlApi}/recuperacion-super-admin/totp/revincular`, { contrasena: this.contrasena })
      .pipe(finalize(() => (this.guardando = false)))
      .subscribe({
        next: (r) => { this.qr = r.qr; this.secreto = r.secreto; this.cuenta = r.cuenta; this.contrasena = ''; this.revincular = 'qr'; },
        error: (e) => (this.error = e?.status === 401 ? 'Contraseña incorrecta.' : (e?.error?.message || 'No se pudo generar el código QR.')),
      });
  }

  confirmarQr(): void {
    this.guardando = true;
    this.error = '';
    this.http.post<{ exigirEnIngreso: boolean }>(`${entorno.urlApi}/recuperacion-super-admin/totp/revincular/confirmar`, { codigo: this.codigoNuevo.replace(/\s/g, '') })
      .pipe(finalize(() => (this.guardando = false)))
      .subscribe({
        next: () => {
          this.estado = { totpActivo: true, exigirEnIngreso: true };
          this.cancelarRevincular();
          this.mensaje = 'Listo: Google Authenticator quedó vinculado de nuevo y ACTIVO. Desde la próxima vez la página le pedirá el código al entrar. Le enviamos un aviso a sus correos.';
        },
        error: (e) => (this.error = e?.error?.message || 'No se pudo confirmar el código.'),
      });
  }

  cancelarRevincular(): void {
    this.revincular = '';
    this.contrasena = '';
    this.qr = '';
    this.secreto = '';
    this.codigoNuevo = '';
  }

  cambiar(): void {
    if (!this.estado) return;
    const activar = !this.estado.exigirEnIngreso;
    this.guardando = true;
    this.error = '';
    this.mensaje = '';
    this.http.post<{ exigirEnIngreso: boolean }>(this.URL, { codigo: this.codigo.replace(/\s/g, ''), activar }).pipe(finalize(() => (this.guardando = false))).subscribe({
      next: (r) => {
        this.estado = { ...this.estado!, exigirEnIngreso: r.exigirEnIngreso };
        this.codigo = '';
        this.mensaje = r.exigirEnIngreso
          ? 'Listo: desde ahora la página le pedirá el código de Google Authenticator cada vez que entre.'
          : 'Apagado: la página ya no le pedirá el código al entrar.';
      },
      error: (e) => (this.error = e?.error?.message ? [].concat(e.error.message).join('. ') : 'No se pudo verificar el código.'),
    });
  }
}
