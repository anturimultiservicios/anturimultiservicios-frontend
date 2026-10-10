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

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<{ totpActivo: boolean; exigirEnIngreso: boolean }>(this.URL).pipe(catchError(() => of(null))).subscribe((e) => (this.estado = e));
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
