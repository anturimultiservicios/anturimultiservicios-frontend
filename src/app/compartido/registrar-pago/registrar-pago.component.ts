import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, finalize, forkJoin, of, switchMap, takeUntil } from 'rxjs';
import { AfiliadosServicio, Afiliado } from '../../nucleo/servicios/afiliados.servicio';
import { EmpresasServicio, Empresa } from '../../nucleo/servicios/empresas.servicio';
import { PagosServicio, CanalPago, ResumenPagos, ResumenMensual, CobroEmpresa, CuentaCobro } from '../../nucleo/servicios/pagos.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';

// 2026-10-07 (decisión de Cristopher): "no tenemos esa parte" - marcar que
// una persona ya pagó, de una sola vez cubre todos sus seguros (EPS/
// pensión/ARL/caja), deja de sonar sola el recordatorio (correo/llamada,
// ambos leen Seguro.fechaVencimiento) y alimenta el resumen de ingresos de
// Anturi. Se busca por nombre/cédula (persona) o NIT/razón social
// (empresa, con varios empleados a cargo - cada uno con SU PROPIO monto,
// no uno a repartir).
@Component({
  selector: 'anturi-registrar-pago',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pagina-lista">
      <div class="pagina-encabezado">
        <h2 class="pagina-titulo">Registrar pago recibido</h2>
      </div>

      <div class="tarjeta">
        <div class="campo-grupo">
          <label class="campo-etiqueta">Buscar por nombre, cédula o NIT</label>
          <input
            type="text"
            class="campo-input"
            placeholder="Ej: Juan Pérez, 123456789, 900123456..."
            [(ngModel)]="terminoBusqueda"
            (ngModelChange)="buscar$.next($event)"
          >
        </div>

        <div *ngIf="buscando" class="estado-carga-inline">Buscando...</div>

        <div *ngIf="!buscando && terminoBusqueda && resultadosPersonas.length === 0 && resultadosEmpresas.length === 0" class="estado-vacio-inline">
          Sin resultados para "{{ terminoBusqueda }}".
        </div>

        <!-- Resultados: personas (independientes) -->
        <div *ngIf="resultadosPersonas.length > 0" class="resultados-grupo">
          <h4 class="resultados-titulo">Personas</h4>
          <div *ngFor="let a of resultadosPersonas" class="fila-persona">
            <label class="permiso-check">
              <input type="checkbox" [checked]="estaSeleccionado(a.id)" (change)="toggleSeleccion(a)" [disabled]="yaPagados.has(a.id)">
              <strong>{{ a.nombres }} {{ a.apellidos }}</strong>
              <span class="dato-secundario">CC {{ a.cedula }}</span>
              <span *ngIf="mesesAdeudados(a) > 1" class="badge-mora">Debe {{ mesesAdeudados(a) }} meses</span>
            </label>
            <span class="monto-persona">{{ montoAdeudado(a) | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
            <span *ngIf="yaPagados.has(a.id)" class="badge-pagado">Pagado ✓</span>
          </div>
        </div>

        <!-- Resultados: empresas (NIT) -->
        <div *ngIf="resultadosEmpresas.length > 0" class="resultados-grupo">
          <h4 class="resultados-titulo">Empresas</h4>
          <div *ngFor="let emp of resultadosEmpresas" class="empresa-bloque">
            <button class="empresa-encabezado" (click)="toggleEmpresa(emp)">
              <strong>{{ emp.razonSocial }}</strong>
              <span class="dato-secundario">NIT {{ emp.nit }}</span>
              <span class="empresa-flecha">{{ empresaExpandidaId === emp.id ? '▲' : '▼' }}</span>
            </button>
            <div *ngIf="empresaExpandidaId === emp.id" class="empresa-empleados">
              <div *ngIf="cargandoEmpleados" class="estado-carga-inline">Cargando...</div>
              <!-- 2026-10-09: la cuenta de la empresa misma (su valor del Excel), las
                   cuentas que se pagan junto con ella y su personal afiliado. -->
              <ng-container *ngIf="!cargandoEmpleados && cobro">
                <p *ngIf="cobro.pagaCon.length" class="nota-paga-con">
                  Se paga junto con la cuenta de <strong>{{ nombresPagaCon }}</strong>.
                </p>
                <ng-container *ngTemplateOutlet="filaCuenta; context: { $implicit: cobro.cuenta, etiqueta: 'Cuenta propia' }"></ng-container>
                <ng-container *ngFor="let o of cobro.otrasCuentas">
                  <ng-container *ngTemplateOutlet="filaCuenta; context: { $implicit: o, etiqueta: 'Otra cuenta de la misma cédula' }"></ng-container>
                </ng-container>
                <ng-container *ngFor="let p of personalActivo">
                  <ng-container *ngIf="p.cuenta">
                    <ng-container *ngTemplateOutlet="filaCuenta; context: { $implicit: p.cuenta, etiqueta: 'Cuenta de ' + p.nombre }"></ng-container>
                  </ng-container>
                </ng-container>
                <div *ngIf="personalSinValor.length" class="personal-sin-valor">
                  <span class="dato-secundario">Personal sin valor propio registrado:</span>
                  {{ nombresSinValor }}
                </div>
              </ng-container>
              <div *ngFor="let a of empleadosEmpresa" class="fila-persona">
                <label class="permiso-check">
                  <input type="checkbox" [checked]="estaSeleccionado(a.id)" (change)="toggleSeleccion(a)" [disabled]="yaPagados.has(a.id)">
                  <strong>{{ a.nombres }} {{ a.apellidos }}</strong>
                  <span class="dato-secundario">CC {{ a.cedula }}</span>
                  <span *ngIf="mesesAdeudados(a) > 1" class="badge-mora">Debe {{ mesesAdeudados(a) }} meses</span>
                </label>
                <span class="monto-persona">{{ montoAdeudado(a) | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
                <span *ngIf="yaPagados.has(a.id)" class="badge-pagado">Pagado ✓</span>
              </div>
            </div>
          </div>
        </div>

        <ng-template #filaCuenta let-c let-etiqueta="etiqueta">
          <div class="fila-persona fila-cuenta">
            <label class="permiso-check">
              <input type="checkbox" [checked]="seleccionCuentas.has(c.empresaId)" (change)="toggleCuenta(c)"
                [disabled]="c.pagadoEsteMes || yaPagadasCuentas.has(c.empresaId) || !c.cuota">
              <strong>{{ c.razonSocial }}</strong>
              <span class="dato-secundario">{{ etiqueta }}<ng-container *ngIf="c.descripcion"> · {{ c.descripcion }}</ng-container> · {{ c.usuarioPortal || ('NIT/CC ' + c.nit) }}</span>
              <span *ngIf="c.mesesAdeudados > 1" class="badge-mora">Debe {{ c.mesesAdeudados }} meses</span>
              <span *ngIf="!c.cuota" class="dato-secundario">(sin valor registrado)</span>
            </label>
            <span class="monto-persona">{{ c.montoAdeudado | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
            <span *ngIf="c.pagadoEsteMes || yaPagadasCuentas.has(c.empresaId)" class="badge-pagado">Pagado ✓</span>
          </div>
        </ng-template>

        <!-- Panel de confirmación -->
        <div *ngIf="totalItems > 0" class="panel-confirmar">
          <p class="panel-confirmar__resumen">
            <strong>{{ totalItems }}</strong> pago{{ totalItems !== 1 ? 's' : '' }} seleccionado{{ totalItems !== 1 ? 's' : '' }} -
            total <strong>{{ totalSeleccionado | currency:'COP':'symbol-narrow':'1.0-0' }}</strong>
          </p>
          <!-- 2026-10-09: el valor de cada pago se puede cambiar (cualquier rol);
               si no coincide con lo calculado, se pide el motivo y le llega
               nota a Anturi y a Cristopher para revisar dónde está el problema. -->
          <div class="items-pago">
            <div *ngFor="let it of itemsSeleccionados; trackBy: porClave" class="item-pago" [class.item-pago--ajustado]="montoDe(it.clave, it.esperado) !== it.esperado">
              <span class="item-pago__nombre">{{ it.nombre }}</span>
              <span *ngIf="montoDe(it.clave, it.esperado) !== it.esperado" class="item-pago__esperado">calculado {{ it.esperado | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
              <input type="number" class="campo-input item-pago__monto" min="0" step="100"
                [ngModel]="montoDe(it.clave, it.esperado)" (ngModelChange)="cambiarMonto(it.clave, $event)" [name]="'monto-' + it.clave">
            </div>
          </div>
          <div *ngIf="hayAjustes" class="campo-grupo">
            <label class="campo-etiqueta">¿Por qué cambia el valor? <span class="requerido">*</span></label>
            <input type="text" class="campo-input" [(ngModel)]="motivoAjuste" maxlength="300"
              placeholder="Ej: el valor del sistema está desactualizado, pagó menos días, abonó una parte...">
            <span class="campo-ayuda">Le llega una nota a Anturi para revisar.</span>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">¿Cómo se recibió el dinero? <span class="requerido">*</span></label>
            <select class="campo-input" [(ngModel)]="canalSeleccionado">
              <option [ngValue]="null">Seleccione...</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
          </div>
          <div *ngIf="errorRegistro" class="alerta-error">{{ errorRegistro }}</div>
          <div class="panel-confirmar__acciones">
            <button class="boton boton-secundario" (click)="limpiarSeleccion()" [disabled]="registrando">Cancelar</button>
            <button class="boton boton-primario" (click)="confirmarPagos()" [disabled]="registrando || !canalSeleccionado || (hayAjustes && !motivoAjuste.trim()) || hayMontoInvalido">
              <span *ngIf="registrando" class="spinner-inline"></span>
              {{ registrando ? 'Registrando...' : 'Marcar como pagado' }}
            </button>
          </div>
        </div>

        <div *ngIf="mensajeExito" class="alerta-exito" style="margin-top: var(--espacio-3);">{{ mensajeExito }}</div>
      </div>

      <!-- Resumen de ingresos (cuentas reales) - solo ADMIN/SUPER_ADMIN.
           Secretaria sí ve en el buscador quién pagó y quién falta, pero
           las cuentas como tal ("cuánto se recogió en total") son de Anturi,
           no de quien solo marca el pago - decisión explícita de Cristopher. -->
      <div class="tarjeta" *ngIf="esAdmin">
        <h3 class="seccion-titulo">Comparación mes a mes</h3>
        <p class="nota-resumen">Esta función se activó el 7 de octubre de 2026 - no hay historial de meses anteriores a esa fecha, es esperado.</p>

        <div *ngIf="cargandoMensual" class="estado-carga-inline">Cargando...</div>
        <div *ngIf="!cargandoMensual && resumenMensualDatos.length === 0" class="estado-vacio-inline">Todavía no hay ningún mes con pagos registrados.</div>
        <div *ngIf="!cargandoMensual && resumenMensualDatos.length > 0" class="tabla-scroll">
          <table class="tabla">
            <thead>
              <tr><th>Mes</th><th>Total</th><th>Efectivo</th><th>Transferencia</th><th>Pagos</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let m of resumenMensualDatos">
                <td>{{ nombreMes(m.mes) }} {{ m.anio }}</td>
                <td><strong>{{ m.total | currency:'COP':'symbol-narrow':'1.0-0' }}</strong></td>
                <td>{{ m.efectivo | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                <td>{{ m.transferencia | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                <td>{{ m.cantidad }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="tarjeta" *ngIf="esAdmin">
        <h3 class="seccion-titulo">Detalle por rango de fechas</h3>
        <div class="resumen-filtros">
          <div class="campo-grupo">
            <label class="campo-etiqueta">Desde</label>
            <input type="date" class="campo-input" [(ngModel)]="resumenDesde" (keyup.enter)="cargarResumen()">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Hasta</label>
            <input type="date" class="campo-input" [(ngModel)]="resumenHasta" (keyup.enter)="cargarResumen()">
          </div>
          <button class="boton boton-primario resumen-buscar" (click)="cargarResumen()" [disabled]="cargandoResumen || !resumenDesde || !resumenHasta">
            {{ cargandoResumen ? 'Buscando...' : 'Buscar' }}
          </button>
        </div>
        <p *ngIf="!cargandoResumen && resumen && resumen.pagos.length === 0" class="estado-carga-inline">No hay pagos registrados entre esas fechas.</p>
        <p *ngIf="!cargandoResumen && errorResumen" class="estado-carga-inline">{{ errorResumen }}</p>

        <div *ngIf="cargandoResumen" class="estado-carga-inline">Cargando resumen...</div>

        <div *ngIf="!cargandoResumen && resumen" class="resumen-totales">
          <div class="resumen-total-item">
            <span class="resumen-total-etiqueta">Total recibido</span>
            <span class="resumen-total-valor">{{ resumen.totalRecibido | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <div class="resumen-total-item">
            <span class="resumen-total-etiqueta">Efectivo</span>
            <span class="resumen-total-valor">{{ resumen.porCanal.EFECTIVO | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
          </div>
          <div class="resumen-total-item">
            <span class="resumen-total-etiqueta">Transferencia</span>
            <span class="resumen-total-valor">{{ resumen.porCanal.TRANSFERENCIA | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
          </div>
        </div>

        <div *ngIf="!cargandoResumen && resumen && resumen.pagos.length > 0" class="tabla-scroll">
          <table class="tabla">
            <thead>
              <tr><th>Persona</th><th>Monto</th><th>Canal</th><th>Registrado por</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of resumen.pagos">
                <td>{{ p.afiliado ? (p.afiliado.nombres + ' ' + p.afiliado.apellidos) : 'Sin identificar' }}</td>
                <td>{{ p.monto | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                <td>{{ p.canal === 'EFECTIVO' ? 'Efectivo' : p.canal === 'TRANSFERENCIA' ? 'Transferencia' : '-' }}</td>
                <td>{{ p.registradoPor ? (p.registradoPor.nombre + ' ' + p.registradoPor.apellido) : '-' }}</td>
                <td>{{ p.fechaPago | date:'dd/MM/yyyy HH:mm' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div *ngIf="!cargandoResumen && resumen && resumen.pagos.length === 0" class="estado-vacio-inline">No hay pagos registrados en este rango de fechas.</div>
      </div>
    </div>
  `,
  styles: [`
    .pagina-lista { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .pagina-encabezado { display: flex; justify-content: space-between; align-items: center; }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .tarjeta { background: var(--fondo-tarjeta); border: 1px solid var(--borde-color); border-radius: var(--radio-md); padding: var(--espacio-4); display: flex; flex-direction: column; gap: var(--espacio-3); }
    .seccion-titulo { font-size: var(--tamano-lg); font-weight: 600; color: var(--texto-principal); margin: 0; }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .requerido { color: var(--color-error); }
    .estado-carga-inline, .estado-vacio-inline { color: var(--texto-terciario); font-size: var(--tamano-sm); padding: var(--espacio-2) 0; }

    .resultados-grupo { display: flex; flex-direction: column; gap: var(--espacio-2); }
    .resultados-titulo { font-size: var(--tamano-sm); font-weight: 700; color: var(--texto-secundario); text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
    .fila-persona { display: flex; align-items: center; justify-content: space-between; gap: var(--espacio-3); padding: var(--espacio-2) var(--espacio-3); border: 1px solid var(--borde-color); border-radius: var(--radio-md); }
    .permiso-check { display: flex; align-items: center; gap: var(--espacio-2); cursor: pointer; flex: 1; min-width: 0; }
    .permiso-check input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-primario); flex-shrink: 0; }
    .dato-secundario { color: var(--texto-terciario); font-size: var(--tamano-sm); }
    .monto-persona { font-weight: 600; color: var(--texto-principal); white-space: nowrap; }
    .badge-pagado { color: #15803d; font-size: var(--tamano-sm); font-weight: 600; white-space: nowrap; }
    .badge-mora { color: #b45309; font-size: var(--tamano-sm); font-weight: 600; white-space: nowrap; }

    .empresa-bloque { border: 1px solid var(--borde-color); border-radius: var(--radio-md); overflow: hidden; }
    .empresa-encabezado { width: 100%; display: flex; align-items: center; gap: var(--espacio-3); padding: var(--espacio-3); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); border: none; cursor: pointer; text-align: left; font-size: var(--tamano-base); color: var(--texto-principal); }
    .empresa-flecha { margin-left: auto; color: var(--texto-terciario); }
    .empresa-empleados { display: flex; flex-direction: column; gap: var(--espacio-2); padding: var(--espacio-3); }

    .panel-confirmar { display: flex; flex-direction: column; gap: var(--espacio-3); padding: var(--espacio-4); background: rgba(27,50,112,0.05); border-radius: var(--radio-md); border: 1px solid rgba(27,50,112,0.15); }
    .panel-confirmar__resumen { margin: 0; }
    .panel-confirmar__acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); }

    .nota-resumen { color: var(--texto-terciario); font-size: var(--tamano-sm); margin: 0; }
    .items-pago { display: flex; flex-direction: column; gap: 6px; margin: var(--espacio-2) 0 var(--espacio-3); }
    .item-pago { display: flex; align-items: center; gap: var(--espacio-3); flex-wrap: wrap; padding: 6px 10px; border-radius: var(--radio-md); background: rgba(27,50,112,0.04); }
    .item-pago--ajustado { background: rgba(232,87,12,0.08); }
    .item-pago__nombre { flex: 1 1 200px; font-size: var(--tamano-sm); font-weight: 600; }
    .item-pago__esperado { font-size: var(--tamano-xs); color: var(--color-secundario); text-decoration: line-through; }
    .item-pago__monto { width: 150px; text-align: right; }
    .fila-cuenta { background: rgba(27,50,112,0.04); border-radius: var(--radio-md); }
    .nota-paga-con { margin: 0 0 var(--espacio-2); font-size: var(--tamano-sm); color: var(--color-primario); }
    .personal-sin-valor { margin-top: var(--espacio-2); font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .resumen-filtros { display: flex; gap: var(--espacio-4); flex-wrap: wrap; align-items: flex-end; }
    .resumen-buscar { height: 40px; }
    .resumen-totales { display: flex; gap: var(--espacio-4); flex-wrap: wrap; }
    .resumen-total-item { display: flex; flex-direction: column; gap: 2px; padding: var(--espacio-3); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); border-radius: var(--radio-md); min-width: 160px; }
    .resumen-total-etiqueta { font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .resumen-total-valor { font-size: var(--tamano-lg); font-weight: 700; color: var(--texto-principal); }

    .tabla-scroll { overflow-x: auto; }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla th, .tabla td { text-align: left; padding: var(--espacio-3); border-bottom: 1px solid var(--borde-color); font-size: var(--tamano-sm); }
    .tabla th { color: var(--texto-secundario); font-weight: 600; }

    .alerta-exito { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: var(--radio-md); padding: var(--espacio-3); }
    .alerta-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: var(--radio-md); padding: var(--espacio-3); font-size: var(--tamano-sm); }
    .spinner-inline { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: 6px; }
    @keyframes girar { to { transform: rotate(360deg); } }
  `],
})
export class RegistrarPagoComponent implements OnDestroy {
  terminoBusqueda = '';
  buscando = false;
  resultadosPersonas: Afiliado[] = [];
  resultadosEmpresas: Empresa[] = [];

  empresaExpandidaId: number | null = null;
  empleadosEmpresa: Afiliado[] = [];
  cargandoEmpleados = false;

  seleccionados = new Map<number, Afiliado>();
  // 2026-10-09: cuentas de empresa seleccionadas para pagar
  seleccionCuentas = new Map<number, CuentaCobro>();
  yaPagadasCuentas = new Set<number>();
  cobro: CobroEmpresa | null = null;
  yaPagados = new Set<number>();
  canalSeleccionado: CanalPago | null = null;
  registrando = false;
  errorRegistro = '';
  mensajeExito = '';

  resumenDesde: string;
  resumenHasta: string;
  resumen: ResumenPagos | null = null;
  cargandoResumen = false;

  resumenMensualDatos: ResumenMensual[] = [];
  cargandoMensual = false;

  esAdmin = false;

  private readonly nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  buscar$ = new Subject<string>();
  private destruir$ = new Subject<void>();

  constructor(
    private afiliadosServicio: AfiliadosServicio,
    private empresasServicio: EmpresasServicio,
    private pagosServicio: PagosServicio,
    private auth: AutenticacionServicio,
  ) {
    this.esAdmin = this.auth.tieneRol(['ADMIN', 'SUPER_ADMIN']);

    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    // fecha local (toISOString daba el día siguiente después de las 7 p. m.)
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.resumenDesde = iso(primerDiaMes);
    this.resumenHasta = iso(hoy);

    if (this.esAdmin) {
      this.cargarResumenMensual();
    }

    this.buscar$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((termino) => {
        if (!termino || termino.trim().length < 2) {
          this.resultadosPersonas = [];
          this.resultadosEmpresas = [];
          return of(null);
        }
        this.buscando = true;
        return forkJoin({
          personas: this.afiliadosServicio.listar(termino, 'ACTIVO', undefined, 1, 20).pipe(catchError(() => of({ datos: [] as Afiliado[] }))),
          empresas: this.empresasServicio.listar(termino, true).pipe(catchError(() => of([] as Empresa[]))),
        });
      }),
      takeUntil(this.destruir$),
    ).subscribe((res) => {
      this.buscando = false;
      if (res) {
        this.resultadosPersonas = res.personas.datos;
        this.resultadosEmpresas = res.empresas;
      }
    });

    if (this.esAdmin) {
      this.cargarResumen();
    }
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  toggleEmpresa(emp: Empresa): void {
    if (this.empresaExpandidaId === emp.id) {
      this.empresaExpandidaId = null;
      this.empleadosEmpresa = [];
      return;
    }
    this.empresaExpandidaId = emp.id;
    this.cargandoEmpleados = true;
    this.cobro = null;
    this.empleadosEmpresa = [];
    // Personal afiliado (vínculos de personal) + la cuenta propia y las del bloque.
    this.pagosServicio.cobroEmpresa(emp.id).pipe(
      catchError(() => of(null)),
      finalize(() => { this.cargandoEmpleados = false; }),
      takeUntil(this.destruir$),
    ).subscribe((c) => {
      this.cobro = c;
      this.empleadosEmpresa = (c?.personal ?? [])
        .filter((p) => p.estadoRelacion === 'ACTIVA' && p.afiliado && p.afiliado.estado === 'ACTIVO' && !p.cuenta)
        .map((p) => p.afiliado as Afiliado);
    });
  }

  estaSeleccionado(id: number): boolean {
    return this.seleccionados.has(id);
  }

  toggleSeleccion(a: Afiliado): void {
    if (this.seleccionados.has(a.id)) {
      this.seleccionados.delete(a.id);
    } else {
      this.seleccionados.set(a.id, a);
    }
  }

  get personalActivo() {
    return (this.cobro?.personal ?? []).filter((p) => p.estadoRelacion === 'ACTIVA');
  }

  get personalSinValor() {
    return this.personalActivo.filter((p) => !p.cuenta && !(p.afiliado && p.afiliado.estado === 'ACTIVO'));
  }

  get nombresSinValor(): string {
    return this.personalSinValor.map((p) => p.nombre).join(', ');
  }

  get nombresPagaCon(): string {
    return (this.cobro?.pagaCon ?? []).map((e) => e.razonSocial).join(', ');
  }

  toggleCuenta(c: CuentaCobro): void {
    if (this.seleccionCuentas.has(c.empresaId)) this.seleccionCuentas.delete(c.empresaId);
    else this.seleccionCuentas.set(c.empresaId, c);
  }

  // ── Valor editable por pago ──
  private montos = new Map<string, number>();
  motivoAjuste = '';

  get itemsSeleccionados(): { clave: string; nombre: string; esperado: number }[] {
    return [
      ...Array.from(this.seleccionados.values()).map((a) => ({ clave: 'a' + a.id, nombre: `${a.nombres} ${a.apellidos}`, esperado: this.montoAdeudado(a) })),
      ...Array.from(this.seleccionCuentas.values()).map((c) => ({ clave: 'e' + c.empresaId, nombre: c.razonSocial, esperado: c.montoAdeudado })),
    ];
  }

  porClave(_: number, it: { clave: string }): string {
    return it.clave;
  }

  montoDe(clave: string, esperado: number): number {
    return this.montos.has(clave) ? this.montos.get(clave)! : esperado;
  }

  cambiarMonto(clave: string, valor: number | string | null): void {
    const n = Number(valor);
    this.montos.set(clave, isFinite(n) ? n : 0);
  }

  get hayAjustes(): boolean {
    return this.itemsSeleccionados.some((it) => this.montoDe(it.clave, it.esperado) !== it.esperado);
  }

  get hayMontoInvalido(): boolean {
    return this.itemsSeleccionados.some((it) => !(this.montoDe(it.clave, it.esperado) > 0));
  }

  get totalItems(): number {
    return this.seleccionados.size + this.seleccionCuentas.size;
  }

  limpiarSeleccion(): void {
    this.montos.clear();
    this.motivoAjuste = '';
    this.seleccionCuentas.clear();
    this.seleccionados.clear();
    this.canalSeleccionado = null;
    this.errorRegistro = '';
  }

  // 2026-10-07 (corrección de Cristopher): si alguien no paga a tiempo y se
  // demora varios meses, al ponerse al día debe pagar TODOS los meses
  // atrasados, no solo 1 - de lo contrario seguiría apareciendo en mora
  // después de "marcar como pagado". Se calcula contra el seguro MÁS
  // atrasado del afiliado (el peor caso real), usando los datos que
  // AfiliadosServicio.listar() ya trae anidados (afiliado.seguros).
  mesesAdeudados(a: Afiliado): number {
    const seguros = (a as any).seguros as { fechaVencimiento?: string | null }[] | undefined;
    if (!seguros || seguros.length === 0) return 1;
    const hoy = new Date();
    let maxMeses = 1;
    for (const s of seguros) {
      if (!s.fechaVencimiento) continue;
      const venc = new Date(s.fechaVencimiento);
      if (venc > hoy) continue;
      let meses = (hoy.getFullYear() - venc.getFullYear()) * 12 + (hoy.getMonth() - venc.getMonth());
      if (hoy.getDate() >= venc.getDate()) meses += 1;
      meses = Math.max(1, meses);
      if (meses > maxMeses) maxMeses = meses;
    }
    return maxMeses;
  }

  montoAdeudado(a: Afiliado): number {
    return Number(a.totalPago || 0) * this.mesesAdeudados(a);
  }

  get totalSeleccionado(): number {
    let total = 0;
    for (const it of this.itemsSeleccionados) total += this.montoDe(it.clave, it.esperado);
    return total;
  }

  confirmarPagos(): void {
    if (!this.canalSeleccionado || this.totalItems === 0) return;
    this.registrando = true;
    this.errorRegistro = '';
    const personas = Array.from(this.seleccionados.values());
    const cuentas = Array.from(this.seleccionCuentas.values());

    forkJoin([
      ...personas.map((a) =>
        this.pagosServicio.registrarCompleto(a.id, this.montoDe('a' + a.id, this.montoAdeudado(a)), this.canalSeleccionado!, this.mesesAdeudados(a),
          undefined, this.montoAdeudado(a), this.motivoAjuste.trim() || undefined).pipe(
          catchError((err) => of({ error: true, afiliado: a, mensaje: err?.error?.message })),
        ),
      ),
      ...cuentas.map((c) =>
        this.pagosServicio.registrarEmpresa(c.empresaId, this.montoDe('e' + c.empresaId, c.montoAdeudado), this.canalSeleccionado!, Math.max(1, c.mesesAdeudados),
          c.montoAdeudado, this.motivoAjuste.trim() || undefined).pipe(
          catchError((err) => of({ error: true, cuenta: c, mensaje: err?.error?.message })),
        ),
      ),
    ]).pipe(
      finalize(() => { this.registrando = false; }),
    ).subscribe((resultados) => {
      const exitosos = resultados.filter((r: any) => !r?.error);
      const fallidos = resultados.filter((r: any) => r?.error);

      for (const a of personas) {
        if (!fallidos.some((f: any) => f.afiliado?.id === a.id)) {
          this.yaPagados.add(a.id);
        }
      }
      for (const c of cuentas) {
        if (!fallidos.some((f: any) => f.cuenta?.empresaId === c.empresaId)) this.yaPagadasCuentas.add(c.empresaId);
      }

      if (exitosos.length > 0) {
        this.mensajeExito = `${exitosos.length} pago(s) registrado(s) correctamente.`;
        setTimeout(() => { this.mensajeExito = ''; }, 5000);
        this.cargarResumen();
        this.cargarResumenMensual();
      }
      if (fallidos.length > 0) {
        const nombres = fallidos.map((f: any) => f.cuenta ? f.cuenta.razonSocial : `${f.afiliado.nombres} ${f.afiliado.apellidos}`).join(', ');
        this.errorRegistro = `No se pudo registrar el pago de: ${nombres}.`;
      } else {
        this.limpiarSeleccion();
      }
    });
  }

  errorResumen = '';

  cargarResumen(): void {
    if (this.resumenDesde > this.resumenHasta) {
      this.errorResumen = 'La fecha "desde" no puede ser posterior a "hasta".';
      this.resumen = null;
      return;
    }
    this.errorResumen = '';
    this.cargandoResumen = true;
    this.pagosServicio.resumen(this.resumenDesde, this.resumenHasta).pipe(
      catchError(() => { this.errorResumen = 'No se pudo cargar el resumen.'; return of(null); }),
      finalize(() => { this.cargandoResumen = false; }),
      takeUntil(this.destruir$),
    ).subscribe((res) => { this.resumen = res; });
  }

  cargarResumenMensual(): void {
    this.cargandoMensual = true;
    this.pagosServicio.resumenMensual().pipe(
      catchError(() => of([] as ResumenMensual[])),
      finalize(() => { this.cargandoMensual = false; }),
      takeUntil(this.destruir$),
    ).subscribe((res) => { this.resumenMensualDatos = res; });
  }

  nombreMes(mes: number): string {
    return this.nombresMeses[mes - 1] ?? String(mes);
  }
}
