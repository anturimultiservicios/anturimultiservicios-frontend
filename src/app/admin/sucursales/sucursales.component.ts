import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, catchError, of, finalize } from 'rxjs';
import { EmpresasServicio, Empresa } from '../../nucleo/servicios/empresas.servicio';
import { SucursalesServicio, Sucursal, CrearSucursalDto } from '../../nucleo/servicios/sucursales.servicio';

// HALLAZGO (29/08, ver INVESTIGACION-SUCURSAL-2026-08-29.md): no existía
// ninguna pantalla de Sucursal, ni siquiera de lectura. Se construye acá,
// como pantalla independiente (no anidada en detalle-empresa, que tiene
// cambios ajenos sin commitear) - se reutiliza el `sucursales` ya anidado
// que EmpresasServicio.listar() devuelve (con scope D01-C ya aplicado),
// sin necesitar una consulta aparte por empresa.
interface FormSucursal {
  nombre: string;
  direccion: string;
  telefono: string;
  ciudad: string;
  activa: boolean;
}

@Component({
  selector: 'anturi-sucursales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="pagina-lista">
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Sucursales</h2>
        <button class="boton boton-secundario" (click)="cargar()" [disabled]="cargando">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Actualizar
        </button>
      </div>

      <p class="pagina-nota">
        Las sucursales pertenecen a una empresa. Elegí una empresa para ver o agregar sus sucursales.
      </p>

      <div *ngIf="mensajeExito" class="alerta-exito">{{ mensajeExito }}</div>
      <div *ngIf="mensajeError" class="alerta-error">{{ mensajeError }}</div>

      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando empresas...</p>
      </div>

      <div *ngIf="errorCarga && !cargando" class="tarjeta estado-vacio">
        <p style="color: var(--color-error);">{{ errorCarga }}</p>
        <button class="boton boton-secundario" (click)="cargar()">Reintentar</button>
      </div>

      <div *ngIf="!cargando && !errorCarga && empresas.length === 0" class="tarjeta estado-vacio">
        <p style="color: var(--texto-terciario);">No hay empresas registradas todavía. Creá una empresa antes de poder agregarle sucursales.</p>
      </div>

      <div *ngIf="!cargando && !errorCarga && empresas.length > 0" class="empresas-lista">
        <div *ngFor="let emp of empresas" class="tarjeta empresa-item">
          <div class="empresa-header">
            <div class="empresa-info">
              <strong>{{ emp.razonSocial }}</strong>
              <span class="empresa-nit">NIT {{ emp.nit }}</span>
            </div>
            <button class="boton boton-sm boton-primario" (click)="abrirModalCrear(emp)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nueva sucursal
            </button>
          </div>

          <div *ngIf="!emp.sucursales || emp.sucursales.length === 0" class="sucursales-vacio">
            Esta empresa todavía no tiene sucursales registradas.
          </div>

          <table *ngIf="emp.sucursales && emp.sucursales.length > 0" class="tabla">
            <thead>
              <tr>
                <th>Nombre</th><th>Ciudad</th><th>Dirección</th><th>Teléfono</th><th>Afiliados</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let suc of emp.sucursales">
                <td>{{ suc.nombre }}</td>
                <td>{{ suc.ciudad || '—' }}</td>
                <td>{{ suc.direccion || '—' }}</td>
                <td>{{ suc.telefono || '—' }}</td>
                <td>
                  <a [routerLink]="[prefijo, 'afiliados']" [queryParams]="{ sucursalId: suc.id, sucursalNombre: suc.nombre }" class="enlace-afiliados">
                    {{ suc._count?.afiliados ?? 0 }} ver
                  </a>
                </td>
                <td><span class="badge-estado" [class.badge-activo]="suc.activa" [class.badge-inactivo]="!suc.activa">{{ suc.activa ? 'Activa' : 'Inactiva' }}</span></td>
                <td>
                  <button class="boton boton-icono" title="Editar" (click)="abrirModalEditar(emp, suc)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- MODAL: Crear/Editar sucursal -->
    <div *ngIf="modalAbierto" class="modal-overlay" (click)="cerrarModal()">
      <div class="modal-form" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-titulo">{{ modoEditar ? 'Editar sucursal' : 'Nueva sucursal' }} — {{ empresaActual?.razonSocial }}</h3>
          <button class="boton boton-icono" (click)="cerrarModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-cuerpo">
          <div *ngIf="errorModal" class="alerta-error" style="margin-bottom: var(--espacio-4);">{{ errorModal }}</div>
          <div class="campos-grid-modal">
            <div class="campo-grupo campo-grupo--ancho">
              <label class="campo-etiqueta">Nombre <span class="requerido">*</span></label>
              <input type="text" class="campo-input" [(ngModel)]="form.nombre" placeholder="Ej: Sucursal Norte">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Ciudad</label>
              <input type="text" class="campo-input" [(ngModel)]="form.ciudad">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Teléfono</label>
              <input type="tel" class="campo-input" [(ngModel)]="form.telefono">
            </div>
            <div class="campo-grupo campo-grupo--ancho">
              <label class="campo-etiqueta">Dirección</label>
              <input type="text" class="campo-input" [(ngModel)]="form.direccion">
            </div>
            <div class="campo-grupo" *ngIf="modoEditar">
              <label class="campo-etiqueta">Estado</label>
              <select class="campo-input" [(ngModel)]="form.activa">
                <option [ngValue]="true">Activa</option>
                <option [ngValue]="false">Inactiva</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-pie">
          <button class="boton boton-secundario" (click)="cerrarModal()" [disabled]="guardando">Cancelar</button>
          <button class="boton boton-primario" (click)="guardar()" [disabled]="guardando">
            <span *ngIf="guardando" class="spinner-inline"></span>
            {{ guardando ? 'Guardando...' : (modoEditar ? 'Guardar cambios' : 'Crear sucursal') }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-3); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .pagina-nota { font-size: var(--tamano-sm); color: var(--texto-terciario); margin: 0; }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-3); padding: var(--espacio-8); text-align: center; }
    .spinner { width: 36px; height: 36px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }

    .empresas-lista { display: flex; flex-direction: column; gap: var(--espacio-4); }
    .empresa-item { padding: var(--espacio-5); }
    .empresa-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-3); margin-bottom: var(--espacio-3); }
    .empresa-info { display: flex; flex-direction: column; gap: 2px; }
    .empresa-nit { font-size: var(--tamano-sm); color: var(--texto-terciario); }
    .sucursales-vacio { font-size: var(--tamano-sm); color: var(--texto-terciario); padding: var(--espacio-3) 0; }

    .tabla { width: 100%; border-collapse: collapse; }
    .tabla thead th { padding: var(--espacio-2) var(--espacio-3); text-align: left; font-size: 0.72rem; font-weight: 600; color: var(--texto-secundario); text-transform: uppercase; border-bottom: 1px solid var(--borde-color, #e5e7eb); }
    .tabla tbody td { padding: var(--espacio-2) var(--espacio-3); border-bottom: 1px solid var(--borde-color, #e5e7eb); font-size: var(--tamano-sm); }
    .enlace-afiliados { color: var(--color-primario); text-decoration: none; font-weight: 500; }
    .enlace-afiliados:hover { text-decoration: underline; }
    .tabla tbody tr:last-child td { border-bottom: none; }

    .badge-estado { display: inline-flex; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
    .badge-activo { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-inactivo { background: rgba(0,0,0,0.07); color: var(--texto-terciario); }

    .boton-sm { font-size: var(--tamano-sm); padding: var(--espacio-1) var(--espacio-3); display: inline-flex; align-items: center; gap: var(--espacio-1); }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: var(--espacio-4); }
    .modal-form { background: var(--fondo-tarjeta, #fff); border-radius: var(--radio-xl); width: 100%; max-width: 520px; display: flex; flex-direction: column; box-shadow: var(--sombra-md); max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--espacio-5); border-bottom: 1px solid var(--borde-color, #e5e7eb); }
    .modal-titulo { font-size: var(--tamano-lg); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .modal-cuerpo { padding: var(--espacio-5); }
    .modal-pie { display: flex; justify-content: flex-end; gap: var(--espacio-3); padding: var(--espacio-4) var(--espacio-5); border-top: 1px solid var(--borde-color, #e5e7eb); }
    .campos-grid-modal { display: grid; grid-template-columns: 1fr 1fr; gap: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .campo-grupo--ancho { grid-column: 1 / -1; }
    .requerido { color: var(--color-error); }

    .alerta-exito { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: var(--radio-md); color: #15803d; font-size: var(--tamano-sm); }
    .alerta-error { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radio-md); color: var(--color-error); font-size: var(--tamano-sm); }
    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }
  `]
})
export class SucursalesComponent implements OnInit, OnDestroy {
  empresas: Empresa[] = [];
  cargando = false;
  errorCarga = '';
  mensajeExito = '';
  mensajeError = '';

  modalAbierto = false;
  modoEditar = false;
  empresaActual: Empresa | null = null;
  sucursalActual: Sucursal | null = null;
  form: FormSucursal = this.formVacio();
  errorModal = '';
  guardando = false;

  private destruir$ = new Subject<void>();

  constructor(
    private empresasServicio: EmpresasServicio,
    private sucursalesServicio: SucursalesServicio,
    private router: Router,
  ) {}

  protected get prefijo(): string {
    return this.router.url.startsWith('/secretaria') ? '/secretaria' : '/admin';
  }

  ngOnInit(): void { this.cargar(); }
  ngOnDestroy(): void { this.destruir$.next(); this.destruir$.complete(); }

  cargar(): void {
    this.cargando = true;
    this.errorCarga = '';
    this.empresasServicio.listar(undefined, false).pipe(
      catchError(() => { this.errorCarga = 'No se pudieron cargar las empresas.'; return of([]); }),
      takeUntil(this.destruir$),
    ).subscribe((lista) => { this.empresas = lista; this.cargando = false; });
  }

  abrirModalCrear(emp: Empresa): void {
    this.empresaActual = emp;
    this.sucursalActual = null;
    this.modoEditar = false;
    this.form = this.formVacio();
    this.errorModal = '';
    this.modalAbierto = true;
  }

  abrirModalEditar(emp: Empresa, suc: Sucursal): void {
    this.empresaActual = emp;
    this.sucursalActual = suc;
    this.modoEditar = true;
    this.form = {
      nombre: suc.nombre,
      direccion: suc.direccion || '',
      telefono: suc.telefono || '',
      ciudad: suc.ciudad || '',
      activa: suc.activa,
    };
    this.errorModal = '';
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.errorModal = '';
  }

  guardar(): void {
    if (!this.form.nombre.trim()) {
      this.errorModal = 'El nombre es obligatorio.';
      return;
    }
    if (!this.empresaActual) return;
    this.guardando = true;
    this.errorModal = '';

    const operacion = this.modoEditar && this.sucursalActual
      ? this.sucursalesServicio.actualizar(this.sucursalActual.id, {
          nombre: this.form.nombre,
          direccion: this.form.direccion || undefined,
          telefono: this.form.telefono || undefined,
          ciudad: this.form.ciudad || undefined,
          activa: this.form.activa,
        })
      : this.sucursalesServicio.crear({
          nombre: this.form.nombre,
          direccion: this.form.direccion || undefined,
          telefono: this.form.telefono || undefined,
          ciudad: this.form.ciudad || undefined,
          empresaId: this.empresaActual.id,
        });

    operacion.pipe(
      catchError((err) => {
        this.errorModal = err?.error?.mensaje || 'No se pudo guardar la sucursal.';
        return of(null);
      }),
      finalize(() => { this.guardando = false; }),
    ).subscribe((res) => {
      if (res) {
        this.modalAbierto = false;
        this.mensajeExito = this.modoEditar ? 'Sucursal actualizada correctamente.' : 'Sucursal creada correctamente.';
        this.cargar();
        setTimeout(() => { this.mensajeExito = ''; }, 4000);
      }
    });
  }

  private formVacio(): FormSucursal {
    return { nombre: '', direccion: '', telefono: '', ciudad: '', activa: true };
  }
}
