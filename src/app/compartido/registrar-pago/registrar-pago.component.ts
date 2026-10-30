import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, finalize, forkJoin, of, switchMap, takeUntil } from 'rxjs';
import { AfiliadosServicio, Afiliado } from '../../nucleo/servicios/afiliados.servicio';
import { EmpresasServicio, Empresa } from '../../nucleo/servicios/empresas.servicio';
import { PagosServicio, EstadoPagoAfiliado, CanalPago, ResumenPagos, ResumenMensual, CobroEmpresa, CuentaCobro } from '../../nucleo/servicios/pagos.servicio';
import { AutenticacionServicio } from '../../nucleo/servicios/autenticacion.servicio';
import { GrupoClienteComponent } from '../grupo-cliente/grupo-cliente.component';
import { CuentaGrupo, NodoGrupo } from '../../nucleo/servicios/clientes.servicio';

// 2026-10-07 (decisión de Cristopher): "no tenemos esa parte" - marcar que
// una persona ya pagó, de una sola vez cubre todos sus seguros (EPS/
// pensión/ARL/caja), deja de sonar sola el recordatorio (correo/llamada,
// ambos leen Seguro.fechaVencimiento) y alimenta el resumen de ingresos de
// Anturi. Se busca por nombre/cédula (persona) o NIT/razón social
// (empresa, con varios empleados a cargo - cada uno con SU PROPIO monto,
// no uno a repartir).
import { desglosar, Desglose, mesesCercanos, nombreMes } from '../../nucleo/utilidades/desglose-pago';
interface LineaTramite { fecha: string; descripcion: string; valorTramite: number | null; seguridadSocial: number | null; comision: number | null }

@Component({
  selector: 'anturi-registrar-pago',
  standalone: true,
  imports: [CommonModule, FormsModule, GrupoClienteComponent],
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
          <button *ngIf="pareceDocumento" type="button" class="boton-no-aporta" (click)="abrirNoAportaLibre()">
            Registrar trámites para el documento {{ terminoBusqueda.trim() }}
          </button>
        </div>

        <!-- Resultados: personas (independientes) -->
        <div *ngIf="resultadosPersonas.length > 0" class="resultados-grupo">
          <h4 class="resultados-titulo">Personas</h4>
          <div *ngFor="let a of resultadosPersonas" class="fila-persona" [class.fila-persona--inactiva]="a.estado !== 'ACTIVO'">
            <label class="permiso-check">
              <input type="checkbox" [checked]="estaSeleccionado(a.id)" (change)="toggleSeleccion(a)" [disabled]="yaPagados.has(a.id) || a.estado !== 'ACTIVO'">
              <strong>{{ a.nombres }} {{ a.apellidos }}</strong>
              <span class="dato-secundario">CC {{ a.cedula }}</span>
              <span *ngIf="a.estado !== 'ACTIVO'" class="badge-estado-pago">{{ a.estado === 'RETIRADO' ? 'Retirado' : 'Inactivo' }}</span>
              <span *ngIf="a.estado === 'ACTIVO' && mesesAdeudados(a) > 1" class="badge-mora">Debe {{ mesesAdeudados(a) }} meses</span>
              <!-- 2026-10-22 (Anyi): hasta qué mes está pagado (antes no se veía y se podía registrar doble) -->
              <span *ngIf="estados.get(a.id)?.pagadoEsteMes" class="badge-pagado" [title]="'El próximo pago quedaría para ' + mesTexto(estados.get(a.id)?.periodoSiguiente)">Pagado ✓ hasta {{ mesTexto(estados.get(a.id)?.cubiertoHasta) }}</span>
              <span *ngIf="estados.get(a.id) && !estados.get(a.id)?.pagadoEsteMes && estados.get(a.id)?.cubiertoHasta" class="dato-secundario">pagado hasta {{ mesTexto(estados.get(a.id)?.cubiertoHasta) }}</span>
            </label>
            <span *ngIf="a.estado === 'ACTIVO'" class="monto-persona">{{ montoAdeudado(a) | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
            <span *ngIf="yaPagados.has(a.id)" class="badge-pagado">Pagado ✓</span>
            <button type="button" class="boton-no-aporta" (click)="abrirNoAporta({ afiliadoId: a.id, nombre: a.nombres + ' ' + a.apellidos, documento: a.cedula })" title="Trámites o diligencias (o solo el trámite, si no aporta)">Trámites / No aporta</button>
            <button type="button" class="boton-grupo" (click)="alternarGrupo('a:' + a.id)" [attr.aria-expanded]="grupoAbierto === 'a:' + a.id" title="Quién le paga y a quiénes les paga">Grupo</button>
            <div *ngIf="grupoAbierto === 'a:' + a.id" class="grupo-en-pago">
              <anturi-grupo-cliente tipo="AFILIADO" [id]="a.id" [siempre]="true" [modoElegir]="true" (elegir)="cobrarDelGrupo($event)"></anturi-grupo-cliente>
            </div>
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
            <!-- 2026-10-30: el grupo completo (quién paga arriba y los demás debajo) -->
            <button type="button" class="boton-grupo" (click)="alternarGrupo('e:' + emp.id)" [attr.aria-expanded]="grupoAbierto === 'e:' + emp.id">Ver grupo</button>
            <div *ngIf="grupoAbierto === 'e:' + emp.id" class="grupo-en-pago">
              <anturi-grupo-cliente tipo="EMPRESA" [id]="emp.id" [siempre]="true" [modoElegir]="true" (elegir)="cobrarDelGrupo($event)"></anturi-grupo-cliente>
            </div>
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
                [disabled]="c.pagadoEsteMes || yaPagadasCuentas.has(c.empresaId)">
              <strong>{{ c.razonSocial }}</strong>
              <span class="dato-secundario">{{ etiqueta }}<ng-container *ngIf="c.descripcion"> · {{ c.descripcion }}</ng-container> · {{ c.usuarioPortal || ('NIT/CC ' + c.nit) }}</span>
              <span *ngIf="c.mesesAdeudados > 1" class="badge-mora">Debe {{ c.mesesAdeudados }} meses</span>
              <!-- 2026-10-29 (Grethel Niño): antes la casilla quedaba bloqueada y no se podía registrar -->
              <span *ngIf="!c.cuota" class="dato-secundario">(sin valor registrado: márquela y escriba el valor que pagó)</span>
            </label>
            <span class="monto-persona">{{ c.montoAdeudado | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
            <span *ngIf="c.pagadoEsteMes || yaPagadasCuentas.has(c.empresaId)" class="badge-pagado">Pagado ✓</span>
            <button type="button" class="boton-no-aporta" (click)="abrirNoAporta({ empresaId: c.empresaId, nombre: c.razonSocial, documento: c.nit })" title="Trámites o diligencias (o solo el trámite, si no aporta)">Trámites / No aporta</button>
          </div>
        </ng-template>

        <!-- 2026-10-09: "No aporta" - solo el trámite, sin seguridad social.
             2026-10-30 (Anturi): ahora son TRÁMITES - se van agregando las
             diligencias (cada una con su fecha, valor del trámite, seguridad
             social, 4x1000 de esa seguridad social y comisión opcional) y al
             final el total. No cuenta como mes al día; entra al Recaudo. -->
        <div *ngIf="noAporta" id="panel-tramites" class="panel-confirmar panel-no-aporta">
          <p class="panel-confirmar__resumen">
            <strong>Trámites</strong> - {{ noAporta.libre ? 'persona o empresa no registrada' : noAporta.nombre }}
            <span class="dato-secundario" *ngIf="!noAporta.libre"> · {{ noAporta.documento }}</span>
          </p>
          <p class="nota-no-aporta">Agregue una fila por cada diligencia. El 4x1000 sale solo y es únicamente sobre la seguridad social. Si no aporta (solo el trámite), deje la seguridad social en blanco.</p>
          <div class="campos-no-aporta" *ngIf="noAporta.libre">
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="tramDoc">Documento <span class="requerido">*</span></label>
              <input id="tramDoc" type="text" class="campo-input" [(ngModel)]="noAporta.documento" maxlength="30">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="tramNombre">Nombre completo <span class="requerido">*</span></label>
              <input id="tramNombre" type="text" class="campo-input" [(ngModel)]="noAporta.nombre" maxlength="150">
            </div>
          </div>
          <div class="tramites">
            <div *ngFor="let l of noAporta.lineas; let i = index" class="tramite">
              <div class="tramite__cab">
                <strong>Diligencia {{ i + 1 }}</strong>
                <button *ngIf="noAporta.lineas.length > 1" type="button" class="boton boton-texto boton-sm" (click)="quitarLinea(i)" [attr.aria-label]="'Quitar diligencia ' + (i + 1)">Quitar</button>
              </div>
              <div class="tramite__campos">
                <div class="campo-grupo">
                  <label class="campo-etiqueta" [for]="'tramFecha' + i">Fecha</label>
                  <input [id]="'tramFecha' + i" type="date" class="campo-input" [(ngModel)]="l.fecha" [max]="hoyIso" [min]="minFechaPago">
                </div>
                <div class="campo-grupo tramite__ancho">
                  <label class="campo-etiqueta" [for]="'tramDesc' + i">Qué se hizo</label>
                  <input [id]="'tramDesc' + i" type="text" class="campo-input" [(ngModel)]="l.descripcion" maxlength="150" placeholder="Ej. planilla de octubre, certificado...">
                </div>
                <div class="campo-grupo">
                  <label class="campo-etiqueta" [for]="'tramValor' + i">Valor del trámite</label>
                  <input [id]="'tramValor' + i" type="number" class="campo-input" min="0" step="1000" [(ngModel)]="l.valorTramite">
                </div>
                <div class="campo-grupo">
                  <label class="campo-etiqueta" [for]="'tramSS' + i">Pago seguridad social</label>
                  <input [id]="'tramSS' + i" type="number" class="campo-input" min="0" step="100" [(ngModel)]="l.seguridadSocial">
                </div>
                <div class="campo-grupo">
                  <span class="campo-etiqueta">4x1000 (sale solo)</span>
                  <span class="tramite__auto">{{ cuatroXMil(l) | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
                </div>
                <div class="campo-grupo">
                  <label class="campo-etiqueta" [for]="'tramCom' + i">Comisión (opcional)</label>
                  <input [id]="'tramCom' + i" type="number" class="campo-input" min="0" step="1000" [(ngModel)]="l.comision">
                </div>
                <div class="campo-grupo">
                  <span class="campo-etiqueta">Subtotal</span>
                  <span class="tramite__auto tramite__subtotal">{{ subtotalLinea(l) | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
                </div>
              </div>
            </div>
            <button type="button" class="boton boton-secundario boton-sm" (click)="agregarLinea()">+ Agregar otra diligencia</button>
          </div>
          <div class="campos-no-aporta">
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="tramCanal">¿Cómo se recibió? <span class="requerido">*</span></label>
              <select id="tramCanal" class="campo-input" [(ngModel)]="noAporta.canal">
                <option [ngValue]="null">Seleccione...</option>
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>
            <div class="campo-grupo tramite__total">
              <span class="campo-etiqueta">Total</span>
              <strong>{{ totalTramites | currency:'COP':'symbol-narrow':'1.0-0' }}</strong>
            </div>
          </div>
          <div *ngIf="errorNoAporta" class="alerta-error">{{ errorNoAporta }}</div>
          <div class="panel-confirmar__acciones">
            <button class="boton boton-secundario" (click)="noAporta = null" [disabled]="registrandoNoAporta">Cancelar</button>
            <button class="boton boton-primario" (click)="confirmarNoAporta()" [disabled]="registrandoNoAporta || !noAportaValido">
              {{ registrandoNoAporta ? 'Registrando...' : 'Registrar ' + (noAporta.lineas.length === 1 ? 'trámite' : noAporta.lineas.length + ' trámites') }}
            </button>
          </div>
        </div>

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
            <div *ngFor="let it of itemsSeleccionados; trackBy: porClave" class="item-pago" [class.item-pago--ajustado]="it.esperado > 0 && montoDe(it.clave, it.esperado) !== it.esperado">
              <span class="item-pago__nombre">{{ it.nombre }}</span>
              <span *ngIf="it.esperado > 0 && montoDe(it.clave, it.esperado) !== it.esperado" class="item-pago__esperado">calculado {{ it.esperado | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
              <input type="number" class="campo-input item-pago__monto" min="0" step="100"
                [ngModel]="montoDe(it.clave, it.esperado)" (ngModelChange)="cambiarMonto(it.clave, $event)" [name]="'monto-' + it.clave">
              <!-- 2026-10-22 (Anyi): qué mes paga y de qué se compone -->
              <label *ngIf="it.clave.startsWith('a')" class="item-pago__mes">Mes que paga
                <select class="campo-input campo-input--sm" [ngModel]="periodoDe(it.clave)" (ngModelChange)="periodos.set(it.clave, $event)" [name]="'periodo-' + it.clave">
                  <option *ngFor="let m of mesesPara(it.clave)" [value]="m.valor">{{ m.nombre }}</option>
                </select>
              </label>
              <span *ngIf="avisoAdelantado(it.clave) as aviso" class="item-pago__aviso">{{ aviso }}</span>
              <div *ngIf="desgloseDe(it.clave, montoDe(it.clave, it.esperado)) as d" class="item-pago__desglose">
                <span>Trámite <b>{{ d.comision | currency:'COP':'symbol-narrow':'1.0-0' }}</b></span>
                <span>Seguridad social <b>{{ d.seguridadSocial | currency:'COP':'symbol-narrow':'1.0-0' }}</b></span>
                <span>4x1000 <b>{{ d.cuatroXMil | currency:'COP':'symbol-narrow':'1.0-0' }}</b></span>
                <span *ngIf="d.afiliacion">Afiliación <b>{{ d.afiliacion | currency:'COP':'symbol-narrow':'1.0-0' }}</b></span>
                <span class="item-pago__total">Total <b>{{ d.total | currency:'COP':'symbol-narrow':'1.0-0' }}</b></span>
              </div>
            </div>
          </div>
          <div *ngIf="totalesDesglose as t" class="desglose-total">
            <span>Trámite <b>{{ t.comision | currency:'COP':'symbol-narrow':'1.0-0' }}</b></span>
            <span>Seguridad social <b>{{ t.seguridadSocial | currency:'COP':'symbol-narrow':'1.0-0' }}</b></span>
            <span>4x1000 <b>{{ t.cuatroXMil | currency:'COP':'symbol-narrow':'1.0-0' }}</b></span>
            <span *ngIf="t.afiliacion">Afiliación <b>{{ t.afiliacion | currency:'COP':'symbol-narrow':'1.0-0' }}</b></span>
            <span class="item-pago__total">Total a pagar <b>{{ t.total | currency:'COP':'symbol-narrow':'1.0-0' }}</b></span>
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
          <!-- 2026-10-16 (Anyi): consignan después de las 4:30 p. m. y se registra al otro día -->
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="fechaPagoReal">Fecha en que pagó o consignó</label>
            <input id="fechaPagoReal" type="date" class="campo-input" [(ngModel)]="fechaPago" [max]="hoyIso" [min]="minFechaPago">
            <span class="campo-ayuda" *ngIf="fechaPago && fechaPago !== hoyIso">El pago queda con fecha del {{ fechaPago | date:'dd/MM/yyyy':'UTC' }}.</span>
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
    .item-pago { flex-wrap: wrap; }
    .item-pago__mes { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--texto-secundario); }
    .item-pago__aviso { flex-basis: 100%; font-size: 12px; color: #b45309; font-weight: 600; }
    .item-pago__desglose, .desglose-total { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: var(--texto-secundario); }
    .item-pago__desglose b, .desglose-total b { color: var(--texto-principal); }
    .item-pago__total b { color: var(--color-secundario, #E8570C); }
    .desglose-total { padding: 10px 12px; border-radius: 10px; background: rgba(27, 50, 112, 0.05); margin-top: 6px; font-size: 13.5px; }
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
    .boton-no-aporta { margin-left: auto; border: 1px dashed var(--color-secundario); background: none; color: var(--color-secundario); border-radius: 999px; padding: 2px 10px; font-size: var(--tamano-xs); font-weight: 700; cursor: pointer; white-space: nowrap; }
    .boton-no-aporta:hover { background: rgba(232,87,12,0.08); }
    .estado-vacio-inline .boton-no-aporta { display: block; margin: var(--espacio-2) 0 0; }
    .fila-persona--inactiva { opacity: 0.85; }
    .badge-estado-pago { font-size: var(--tamano-xs); font-weight: 700; padding: 1px 8px; border-radius: 999px; background: rgba(100,116,139,0.15); color: var(--texto-secundario); }
    .boton-grupo { border: 1px solid var(--color-primario, #1B3270); color: var(--color-primario, #1B3270); background: transparent; border-radius: 999px; padding: 2px 10px; font-size: var(--tamano-xs); cursor: pointer; margin-left: 6px; }
    .grupo-en-pago { flex-basis: 100%; margin: 6px 0 4px; padding: 8px; border-radius: 10px; background: var(--fondo-secundario, #f8fafc); }
    .panel-no-aporta { border-color: var(--color-secundario); }
    .nota-no-aporta { margin: 0 0 var(--espacio-3); font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .tramites { display: flex; flex-direction: column; gap: var(--espacio-3); margin-bottom: var(--espacio-3); }
    .tramite { border: 1px solid var(--borde-color, #e5e7eb); border-radius: 10px; padding: 10px; }
    .tramite__cab { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .tramite__campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--espacio-2) var(--espacio-3); }
    .tramite__ancho { grid-column: span 2; }
    .tramite__auto { padding: 8px 0; color: var(--texto-secundario); }
    .tramite__subtotal { font-weight: 700; color: var(--texto-principal); }
    .tramite__total strong { font-size: var(--tamano-lg); color: var(--color-secundario, #E8570C); padding-top: 6px; }
    @media (max-width: 520px) { .tramite__ancho { grid-column: auto; } }
    .campos-no-aporta { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--espacio-3); margin-bottom: var(--espacio-3); }
    .campo-grupo--ancho { grid-column: 1 / -1; }
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
  // 2026-10-16: fecha real del pago (por defecto hoy; hasta 60 días atrás)
  readonly hoyIso = this.isoLocal(new Date());
  readonly minFechaPago = this.isoLocal(new Date(Date.now() - 60 * 86_400_000));
  fechaPago = this.hoyIso;

  private isoLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private get fechaPagoEnviar(): string | undefined {
    return this.fechaPago && this.fechaPago !== this.hoyIso ? this.fechaPago : undefined;
  }
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
          // 2026-10-09: todos los estados - quien hace "No aporta" suele estar inactivo o retirado
          personas: this.afiliadosServicio.listar(termino, undefined, undefined, 1, 20).pipe(catchError(() => of({ datos: [] as Afiliado[] }))),
          empresas: this.empresasServicio.listar(termino, true).pipe(catchError(() => of([] as Empresa[]))),
        });
      }),
      takeUntil(this.destruir$),
    ).subscribe((res) => {
      this.buscando = false;
      if (res) {
        this.resultadosPersonas = res.personas.datos;
        this.resultadosEmpresas = res.empresas;
        // 2026-10-30: viene de "Cobrar esta cuenta" en el grupo
        const abrir = this.resultadosEmpresas.find((e) => e.id === this.abrirCuentaAlLlegar);
        this.abrirCuentaAlLlegar = null;
        if (abrir && this.empresaExpandidaId !== abrir.id) this.toggleEmpresa(abrir);
        this.cargarEstados(this.resultadosPersonas.map((a) => a.id));
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

  // ── "No aporta" (solo el trámite) → 2026-10-30: Trámites con varias diligencias ──
  noAporta: { afiliadoId?: number; empresaId?: number; nombre: string; documento: string; libre: boolean; canal: CanalPago | null; lineas: LineaTramite[] } | null = null;
  registrandoNoAporta = false;
  errorNoAporta = '';
  readonly VALOR_NO_APORTA = 10000;

  get pareceDocumento(): boolean {
    return /^[A-Za-z]{0,3}\s?\d{5,}$/.test(this.terminoBusqueda.trim());
  }

  private lineaNueva(): LineaTramite {
    return { fecha: this.hoyIso, descripcion: '', valorTramite: this.VALOR_NO_APORTA, seguridadSocial: null, comision: null };
  }

  abrirNoAporta(quien: { afiliadoId?: number; empresaId?: number; nombre: string; documento: string }): void {
    this.errorNoAporta = '';
    this.noAporta = { ...quien, libre: false, canal: null, lineas: [this.lineaNueva()] };
    this.mostrarPanelTramites();
  }

  abrirNoAportaLibre(): void {
    this.errorNoAporta = '';
    this.noAporta = { nombre: '', documento: this.terminoBusqueda.trim(), libre: true, canal: null, lineas: [this.lineaNueva()] };
    this.mostrarPanelTramites();
  }

  // 2026-10-30 (Anturi: "no aporta no funciona o no marca nada"): el panel se
  // abría al final de la página, fuera de la vista. Ahora se lleva hasta él.
  private mostrarPanelTramites(): void {
    setTimeout(() => document.getElementById('panel-tramites')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  agregarLinea(): void {
    this.noAporta?.lineas.push(this.lineaNueva());
  }

  quitarLinea(i: number): void {
    this.noAporta?.lineas.splice(i, 1);
  }

  private valor(v: unknown): number {
    const n = Number(v ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }

  cuatroXMil(l: LineaTramite): number {
    return Math.round(this.valor(l.seguridadSocial) * 0.004);
  }

  subtotalLinea(l: LineaTramite): number {
    return this.valor(l.valorTramite) + this.valor(l.seguridadSocial) + this.cuatroXMil(l) + this.valor(l.comision);
  }

  get totalTramites(): number {
    return (this.noAporta?.lineas ?? []).reduce((t, l) => t + this.subtotalLinea(l), 0);
  }

  get noAportaValido(): boolean {
    const n = this.noAporta;
    return !!n && !!n.canal && n.lineas.length > 0 && n.lineas.every((l) => this.subtotalLinea(l) > 0 && !!l.fecha)
      && (!n.libre || (!!n.documento.trim() && !!n.nombre.trim()));
  }

  confirmarNoAporta(): void {
    const n = this.noAporta;
    if (!n || !this.noAportaValido) return;
    this.registrandoNoAporta = true;
    this.errorNoAporta = '';
    const total = this.totalTramites;
    this.pagosServicio.registrarTramites({
      afiliadoId: n.afiliadoId,
      empresaId: n.empresaId,
      documento: n.libre ? n.documento.trim() : undefined,
      nombre: n.libre ? n.nombre.trim() : undefined,
      canal: n.canal!,
      lineas: n.lineas.map((l) => ({
        fecha: l.fecha !== this.hoyIso ? l.fecha : undefined,
        descripcion: l.descripcion.trim() || undefined,
        valorTramite: this.valor(l.valorTramite),
        seguridadSocial: this.valor(l.seguridadSocial),
        comision: this.valor(l.comision),
      })),
    }).pipe(
      finalize(() => { this.registrandoNoAporta = false; }),
      takeUntil(this.destruir$),
    ).subscribe({
      next: () => {
        this.mensajeExito = `Trámites de ${n.nombre || n.documento} registrados: total $${total.toLocaleString('es-CO')}.`;
        setTimeout(() => { this.mensajeExito = ''; }, 6000);
        this.noAporta = null;
        if (this.esAdmin) { this.cargarResumen(); this.cargarResumenMensual(); }
      },
      error: (err) => {
        const m = err?.error?.message;
        this.errorNoAporta = (Array.isArray(m) ? m[0] : m) || 'No se pudo registrar.';
      },
    });
  }

  // ── 2026-10-30: grupo de quien paga por varios ──
  grupoAbierto: string | null = null;

  alternarGrupo(clave: string): void {
    this.grupoAbierto = this.grupoAbierto === clave ? null : clave;
  }

  // "Cobrar esta cuenta" desde el grupo: se busca por su documento y se abre
  cobrarDelGrupo(e: { cuenta?: CuentaGrupo; nodo: NodoGrupo }): void {
    this.grupoAbierto = null;
    this.terminoBusqueda = e.nodo.documento;
    this.buscar$.next(e.nodo.documento);
    if (e.cuenta) this.abrirCuentaAlLlegar = e.cuenta.id;
  }
  abrirCuentaAlLlegar: number | null = null;

  // ── Valor editable por pago ──
  private montos = new Map<string, number>();

  // ── 2026-10-22 (Anyi): estado de pago, mes que paga y desglose ──
  readonly mesTexto = nombreMes;
  estados = new Map<number, EstadoPagoAfiliado>();
  periodos = new Map<string, string>();

  private cargarEstados(ids: number[]): void {
    const faltan = ids.filter((id) => !this.estados.has(id));
    if (!faltan.length) return;
    this.pagosServicio.estadoAfiliados(faltan).pipe(catchError(() => of([] as EstadoPagoAfiliado[]))).subscribe((lista) => {
      for (const e of lista) this.estados.set(e.afiliadoId, e);
    });
  }

  periodoDe(clave: string): string {
    const guardado = this.periodos.get(clave);
    if (guardado) return guardado;
    const e = this.estados.get(Number(clave.slice(1)));
    return e?.periodoSiguiente ?? this.fechaPago.slice(0, 7);
  }

  mesesPara(clave: string): { valor: string; nombre: string }[] {
    return mesesCercanos(this.periodoDe(clave), 3, 3);
  }

  avisoAdelantado(clave: string): string {
    const e = this.estados.get(Number(clave.slice(1)));
    if (!e?.cubiertoHasta) return '';
    const elegido = this.periodoDe(clave);
    if (elegido <= e.cubiertoHasta) return `Ojo: ${nombreMes(elegido)} ya está pagado (pagado hasta ${nombreMes(e.cubiertoHasta)}).`;
    if (e.pagadoEsteMes) return `Ya pagó este mes: este pago queda adelantado para ${nombreMes(elegido)}.`;
    return '';
  }

  desgloseDe(clave: string, monto: number): Desglose | null {
    if (clave.startsWith('a')) {
      const id = Number(clave.slice(1));
      const e = this.estados.get(id);
      const a = this.seleccionados.get(id);
      if (!e || !a) return null;
      return desglosar(Number(monto) || 0, this.mesesAdeudados(a), e.partes, e.esPrimerPago);
    }
    const c = this.seleccionCuentas.get(Number(clave.slice(1)));
    if (!c?.partes) return null;
    return desglosar(Number(monto) || 0, Math.max(1, c.mesesAdeudados), c.partes);
  }

  get totalesDesglose(): Desglose | null {
    const items = this.itemsSeleccionados;
    if (items.length < 2) return null;
    const t: Desglose = { seguridadSocial: 0, cuatroXMil: 0, comision: 0, afiliacion: 0, total: 0 };
    for (const it of items) {
      const d = this.desgloseDe(it.clave, this.montoDe(it.clave, it.esperado));
      if (!d) return null;
      t.seguridadSocial += d.seguridadSocial; t.cuatroXMil += d.cuatroXMil; t.comision += d.comision; t.afiliacion += d.afiliacion; t.total += d.total;
    }
    return t;
  }
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

  // Una cuenta sin valor registrado (esperado 0) no es un "ajuste": no hay
  // nada calculado con qué comparar, solo se escribe lo que pagó.
  get hayAjustes(): boolean {
    return this.itemsSeleccionados.some((it) => it.esperado > 0 && this.montoDe(it.clave, it.esperado) !== it.esperado);
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
    this.fechaPago = this.hoyIso;
    this.errorRegistro = '';
  }

  // 2026-10-07 (corrección de Cristopher): si alguien no paga a tiempo y se
  // demora varios meses, al ponerse al día debe pagar TODOS los meses
  // atrasados, no solo 1 - de lo contrario seguiría apareciendo en mora
  // después de "marcar como pagado". Se calcula contra el seguro MÁS
  // atrasado del afiliado (el peor caso real), usando los datos que
  // AfiliadosServicio.listar() ya trae anidados (afiliado.seguros).
  mesesAdeudados(a: Afiliado): number {
    const e = this.estados.get(a.id);
    if (e) return Math.max(1, e.pagadoEsteMes ? 1 : e.mesesAdeudados);
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
          undefined, this.montoAdeudado(a), this.motivoAjuste.trim() || undefined, this.fechaPagoEnviar, this.periodoDe('a' + a.id)).pipe(
          catchError((err) => of({ error: true, afiliado: a, mensaje: err?.error?.message })),
        ),
      ),
      ...cuentas.map((c) =>
        this.pagosServicio.registrarEmpresa(c.empresaId, this.montoDe('e' + c.empresaId, c.montoAdeudado), this.canalSeleccionado!, Math.max(1, c.mesesAdeudados),
          c.montoAdeudado || undefined, this.motivoAjuste.trim() || undefined, this.fechaPagoEnviar).pipe(
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
        // el resumen de dinero es solo de Admin (a la Asistente le daba 403)
        if (this.esAdmin) { this.cargarResumen(); this.cargarResumenMensual(); }
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
