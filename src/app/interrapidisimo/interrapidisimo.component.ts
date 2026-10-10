import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { entorno } from '../../environments/entorno';
import { AutenticacionServicio } from '../nucleo/servicios/autenticacion.servicio';

interface Movimiento {
  id: number; fecha: string; tipo: string; nombreTipo: string; guia: string | null; clienteNombre: string | null; clienteTelefono: string | null;
  destino: string | null; descripcion: string | null; valor: string | number; comision: string | number; medioPago: string; estado: string;
  anulado: boolean; motivoAnulacion: string | null; registradoPor: string | null;
}
interface Resumen { cantidad: number; ingresosEfectivo: number; egresosEfectivo: number; transferencias: number; tarjeta: number; gastos: number; comisiones: number; ingresos: number }
interface Cierre { id: number; dia: string; baseInicial: any; ingresosEfectivo: any; egresosEfectivo: any; esperadoEfectivo: any; contadoEfectivo: any; diferencia: any; consignado: any; quedaEnCaja: any; totalTransferencias: any; totalTarjeta: any; totalComisiones: any; cantidadMovimientos: number; observaciones: string | null; cerradoEn: string }
interface Dia { fecha: string; movimientos: Movimiento[]; resumen: Resumen; cierre: Cierre | null; baseSugerida: number; pendientes: Movimiento[] }

const TIPOS = [
  { clave: 'SOBRE', nombre: 'Sobre', icono: '✉️', guia: true },
  { clave: 'PAQUETE', nombre: 'Paquete', icono: '📦', guia: true },
  { clave: 'RECOLECCION', nombre: 'Recolección', icono: '🚚', guia: true },
  { clave: 'ENTREGA', nombre: 'Entrega', icono: '📬', guia: true },
  { clave: 'PAGO', nombre: 'Pago recibido', icono: '💵', guia: false },
  { clave: 'OTRO_INGRESO', nombre: 'Otro ingreso', icono: '➕', guia: false },
  { clave: 'GASTO', nombre: 'Gasto', icono: '➖', guia: false },
];
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const num = (v: unknown) => Number(v ?? 0) || 0;

// 2026-10-09 (visión de Cristopher): espacio INTERRAPIDÍSIMO - el punto que
// administra Anturi. Registro rápido del día y cierre de caja que se calcula
// solo. Mientras esté "en desarrollo", solo lo ve y lo usa el Super Admin
// (el servidor lo controla); después, la encargada y el administrador.
@Component({
  selector: 'anturi-interrapidisimo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="inter">
      <header class="inter__cab">
        <div class="inter__marca">
          <img src="/assets/imagenes/logo-2026.png" alt="Anturi" class="inter__logo">
          <div>
            <div class="inter__titulo">Interrapidísimo</div>
            <div class="inter__sub">Punto administrado por Anturi Multiservicios</div>
          </div>
        </div>
        <div class="inter__cab-acciones">
          <a *ngIf="esSuperAdmin" routerLink="/admin/resumen" class="boton boton-secundario boton-sm">← Seguridad social</a>
          <button type="button" class="salir" (click)="salir()">Cerrar sesión</button>
        </div>
      </header>

      <div *ngIf="esSuperAdmin" class="inter__desarrollo">🔒 <b>En desarrollo:</b> este espacio solo lo ve usted (Super Admin). Nadie más lo ve ni puede entrar hasta que se active.</div>

      <nav class="inter__pestanas">
        <button type="button" [class.activa]="vista === 'dia'" (click)="vista = 'dia'">Día</button>
        <button type="button" [class.activa]="vista === 'cierres'" (click)="vista = 'cierres'; cargarCierres()">Cierres de caja</button>
      </nav>

      <div *ngIf="error" class="alerta-error">{{ error }}</div>
      <div *ngIf="mensaje" class="alerta-exito">{{ mensaje }}</div>

      <!-- ═════ DÍA ═════ -->
      <ng-container *ngIf="vista === 'dia'">
        <div class="fila-fecha">
          <label for="interFecha">Día</label>
          <input id="interFecha" type="date" class="campo-input" [(ngModel)]="fecha" (ngModelChange)="cargar()" [max]="hoy">
          <span *ngIf="dia?.cierre" class="etiqueta-cerrado">Caja cerrada</span>
        </div>

        <div class="tarjetas" *ngIf="dia">
          <div class="dato dato--principal"><span>Efectivo que entró</span><b>{{ dia.resumen.ingresosEfectivo | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
          <div class="dato"><span>Transferencias</span><b>{{ dia.resumen.transferencias | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
          <div class="dato"><span>Tarjeta</span><b>{{ dia.resumen.tarjeta | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
          <div class="dato"><span>Gastos</span><b>{{ dia.resumen.gastos | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
          <div class="dato dato--ganancia"><span>Ganancia Anturi</span><b>{{ dia.resumen.comisiones | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
          <div class="dato"><span>Movimientos</span><b>{{ dia.resumen.cantidad }}</b></div>
        </div>

        <!-- registro rápido -->
        <section class="tarjeta bloque" *ngIf="dia && !dia.cierre && fecha === hoy">
          <h3>Registrar</h3>
          <div class="tipos">
            <button *ngFor="let t of tipos" type="button" class="tipo" [class.tipo--activo]="form.tipo === t.clave" [class.tipo--gasto]="t.clave === 'GASTO'" (click)="elegirTipo(t.clave)">
              <span class="tipo__icono">{{ t.icono }}</span>{{ t.nombre }}
            </button>
          </div>
          <form *ngIf="form.tipo" class="registro" (ngSubmit)="registrar()">
            <div class="rejilla">
              <div class="campo-grupo">
                <label class="campo-etiqueta" for="iValor">{{ form.tipo === 'GASTO' ? 'Valor del gasto' : 'Valor cobrado' }}</label>
                <input id="iValor" name="valor" type="number" min="0" class="campo-input grande" [(ngModel)]="form.valor" required>
              </div>
              <div class="campo-grupo">
                <span class="campo-etiqueta">Medio de pago</span>
                <div class="medios">
                  <button *ngFor="let m of medios" type="button" class="medio" [class.medio--activo]="form.medioPago === m.clave" (click)="form.medioPago = m.clave">{{ m.nombre }}</button>
                </div>
              </div>
              <div class="campo-grupo" *ngIf="tipoActual?.guia">
                <label class="campo-etiqueta" for="iGuia">N.º de guía</label>
                <input id="iGuia" name="guia" class="campo-input" [(ngModel)]="form.guia">
              </div>
              <div class="campo-grupo" *ngIf="form.tipo !== 'GASTO'">
                <label class="campo-etiqueta" for="iCliente">Cliente</label>
                <input id="iCliente" name="cliente" class="campo-input" [(ngModel)]="form.clienteNombre" placeholder="Nombre">
              </div>
              <div class="campo-grupo" *ngIf="form.tipo !== 'GASTO'">
                <label class="campo-etiqueta" for="iTel">Teléfono</label>
                <input id="iTel" name="tel" class="campo-input" [(ngModel)]="form.clienteTelefono">
              </div>
              <div class="campo-grupo" *ngIf="tipoActual?.guia">
                <label class="campo-etiqueta" for="iDestino">{{ form.tipo === 'RECOLECCION' ? 'Dirección de recolección' : form.tipo === 'ENTREGA' ? 'Dirección de entrega' : 'Destino' }}</label>
                <input id="iDestino" name="destino" class="campo-input" [(ngModel)]="form.destino">
              </div>
              <div class="campo-grupo" *ngIf="form.tipo !== 'GASTO'">
                <label class="campo-etiqueta" for="iComision">Ganancia para Anturi</label>
                <input id="iComision" name="comision" type="number" min="0" class="campo-input" [(ngModel)]="form.comision" placeholder="0">
              </div>
              <div class="campo-grupo ancho">
                <label class="campo-etiqueta" for="iDesc">{{ form.tipo === 'GASTO' ? '¿En qué se gastó?' : 'Nota (opcional)' }}</label>
                <input id="iDesc" name="desc" class="campo-input" [(ngModel)]="form.descripcion">
              </div>
            </div>
            <div class="registro__pie">
              <button type="button" class="boton boton-secundario" (click)="form.tipo = ''">Cancelar</button>
              <button type="submit" class="boton boton-primario" [disabled]="guardando || !formValido">{{ guardando ? 'Guardando...' : 'Registrar ' + (tipoActual?.nombre ?? '').toLowerCase() }}</button>
            </div>
          </form>
        </section>

        <!-- pendientes -->
        <section class="tarjeta bloque" *ngIf="dia?.pendientes?.length">
          <h3>Recolecciones y entregas pendientes ({{ dia!.pendientes.length }})</h3>
          <div class="pendiente" *ngFor="let p of dia!.pendientes">
            <span><b>{{ p.nombreTipo }}</b> {{ p.guia ? '· Guía ' + p.guia : '' }} · {{ p.clienteNombre || 'Sin nombre' }} {{ p.destino ? '· ' + p.destino : '' }} <small>({{ p.fecha | date:'dd/MM h:mm a' }})</small></span>
            <button type="button" class="boton boton-primario boton-sm" (click)="completar(p)">Marcar hecha</button>
          </div>
        </section>

        <!-- movimientos -->
        <section class="tarjeta bloque" *ngIf="dia">
          <h3>Movimientos del día</h3>
          <div *ngIf="!dia.movimientos.length" class="estado">Todavía no hay movimientos este día.</div>
          <div class="tabla-scroll" *ngIf="dia.movimientos.length">
            <table class="tabla">
              <thead><tr><th>Hora</th><th>Tipo</th><th>Guía</th><th>Cliente / detalle</th><th>Medio</th><th class="num">Valor</th><th class="num">Ganancia</th><th></th></tr></thead>
              <tbody>
                <tr *ngFor="let m of dia.movimientos" [class.anulado]="m.anulado">
                  <td>{{ m.fecha | date:'h:mm a' }}</td>
                  <td>{{ m.nombreTipo }}<div class="sub" *ngIf="m.estado === 'PENDIENTE'">Pendiente</div></td>
                  <td>{{ m.guia || '' }}</td>
                  <td>{{ m.clienteNombre || m.descripcion || '' }}<div class="sub" *ngIf="m.anulado">Anulado: {{ m.motivoAnulacion }}</div></td>
                  <td>{{ nombreMedio(m.medioPago) }}</td>
                  <td class="num" [class.egreso]="m.tipo === 'GASTO'">{{ m.tipo === 'GASTO' ? '−' : '' }}{{ +m.valor | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  <td class="num">{{ +m.comision ? (+m.comision | currency:'COP':'symbol-narrow':'1.0-0') : '' }}</td>
                  <td><button *ngIf="!m.anulado && !dia.cierre" type="button" class="boton boton-texto boton-sm peligro" (click)="anular(m)">Anular</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- cierre de caja -->
        <section class="tarjeta bloque cierre" *ngIf="dia">
          <h3>Cierre de caja del {{ fecha | date:'d MMM y' }}</h3>
          <ng-container *ngIf="!dia.cierre; else yaCerrado">
            <div class="rejilla">
              <div class="campo-grupo">
                <label class="campo-etiqueta" for="cBase">Base con la que abrió</label>
                <input id="cBase" type="number" min="0" class="campo-input" [(ngModel)]="cierre.baseInicial">
              </div>
              <div class="campo-grupo">
                <label class="campo-etiqueta" for="cContado">Efectivo contado en caja</label>
                <input id="cContado" type="number" min="0" class="campo-input grande" [(ngModel)]="cierre.contadoEfectivo">
              </div>
              <div class="campo-grupo">
                <label class="campo-etiqueta" for="cConsignado">Se consigna o retira</label>
                <input id="cConsignado" type="number" min="0" class="campo-input" [(ngModel)]="cierre.consignado">
              </div>
            </div>
            <div class="cuentas">
              <div><span>Base</span><b>{{ num(cierre.baseInicial) | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
              <div><span>+ Efectivo que entró</span><b>{{ dia.resumen.ingresosEfectivo | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
              <div><span>− Gastos en efectivo</span><b>{{ dia.resumen.egresosEfectivo | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
              <div class="total"><span>= Debería haber</span><b>{{ esperado | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
              <div *ngIf="cierre.contadoEfectivo !== null" [class.bien]="diferencia === 0" [class.mal]="diferencia !== 0">
                <span>{{ diferencia === 0 ? 'Cuadra exacto' : diferencia > 0 ? 'Sobran' : 'Faltan' }}</span><b>{{ abs(diferencia) | currency:'COP':'symbol-narrow':'1.0-0' }}</b>
              </div>
              <div *ngIf="cierre.contadoEfectivo !== null"><span>Queda en caja (base de mañana)</span><b>{{ num(cierre.contadoEfectivo) - num(cierre.consignado) | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="cObs">Observaciones</label>
              <input id="cObs" class="campo-input" [(ngModel)]="cierre.observaciones" placeholder="Ej. faltante por cambio mal dado">
            </div>
            <div class="registro__pie">
              <button type="button" class="boton boton-primario" [disabled]="guardando || cierre.contadoEfectivo === null" (click)="cerrarCaja()">Cerrar caja del día</button>
            </div>
          </ng-container>
          <ng-template #yaCerrado>
            <div class="cuentas">
              <div><span>Base</span><b>{{ num(dia.cierre!.baseInicial) | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
              <div><span>Debería haber</span><b>{{ num(dia.cierre!.esperadoEfectivo) | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
              <div><span>Contado</span><b>{{ num(dia.cierre!.contadoEfectivo) | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
              <div [class.bien]="num(dia.cierre!.diferencia) === 0" [class.mal]="num(dia.cierre!.diferencia) !== 0"><span>Diferencia</span><b>{{ num(dia.cierre!.diferencia) | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
              <div><span>Consignado / retirado</span><b>{{ num(dia.cierre!.consignado) | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
              <div><span>Quedó en caja</span><b>{{ num(dia.cierre!.quedaEnCaja) | currency:'COP':'symbol-narrow':'1.0-0' }}</b></div>
            </div>
            <p class="sub">Cerrada el {{ dia.cierre!.cerradoEn | date:'d MMM y, h:mm a' }}{{ dia.cierre!.observaciones ? ' · ' + dia.cierre!.observaciones : '' }}</p>
            <button type="button" class="boton boton-texto boton-sm" (click)="reabrir()">Reabrir caja (administrador)</button>
          </ng-template>
        </section>
      </ng-container>

      <!-- ═════ CIERRES ═════ -->
      <section *ngIf="vista === 'cierres'" class="tarjeta bloque">
        <div class="fila-fecha">
          <select class="campo-input" [(ngModel)]="mesCierres" (ngModelChange)="cargarCierres()" aria-label="Mes">
            <option *ngFor="let m of meses; let i = index" [ngValue]="i + 1">{{ m }}</option>
          </select>
          <select class="campo-input" [(ngModel)]="anioCierres" (ngModelChange)="cargarCierres()" aria-label="Año">
            <option *ngFor="let a of anios" [ngValue]="a">{{ a }}</option>
          </select>
        </div>
        <div *ngIf="!cierres.length" class="estado">No hay cierres en este mes.</div>
        <div class="tabla-scroll" *ngIf="cierres.length">
          <table class="tabla">
            <thead><tr><th>Día</th><th class="num">Mov.</th><th class="num">Debería</th><th class="num">Contado</th><th class="num">Diferencia</th><th class="num">Consignado</th><th class="num">Transf.</th><th class="num">Tarjeta</th><th class="num">Ganancia</th></tr></thead>
            <tbody>
              <tr *ngFor="let c of cierres">
                <td>{{ c.dia | date:'EEE d MMM':'UTC' }}</td>
                <td class="num">{{ c.cantidadMovimientos }}</td>
                <td class="num">{{ num(c.esperadoEfectivo) | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                <td class="num">{{ num(c.contadoEfectivo) | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                <td class="num" [class.mal]="num(c.diferencia) !== 0">{{ num(c.diferencia) | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                <td class="num">{{ num(c.consignado) | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                <td class="num">{{ num(c.totalTransferencias) | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                <td class="num">{{ num(c.totalTarjeta) | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                <td class="num">{{ num(c.totalComisiones) | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p *ngIf="cierres.length" class="sub">Ganancia del mes: <b>{{ totalesCierres.comisiones | currency:'COP':'symbol-narrow':'1.0-0' }}</b> · Diferencias acumuladas: <b>{{ totalesCierres.diferencias | currency:'COP':'symbol-narrow':'1.0-0' }}</b></p>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--fondo-pagina, #f4f6fa); }
    .inter { max-width: 1180px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    .inter__cab { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; background: #111a3d; color: #fff; padding: 12px 16px; border-radius: 14px; }
    .inter__marca { display: flex; align-items: center; gap: 12px; }
    .inter__logo { width: 46px; height: 46px; border-radius: 10px; object-fit: cover; background: #fff; padding: 2px; }
    .inter__titulo { font-size: 20px; font-weight: 800; letter-spacing: .3px; }
    .inter__sub { font-size: 12px; color: #c9d1e6; }
    .inter__cab-acciones { display: flex; gap: 8px; align-items: center; }
    .salir { background: transparent; border: 1px solid rgba(255,255,255,.45); color: #fff; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-weight: 600; }
    .salir:hover { background: rgba(255,255,255,.12); }
    .alerta-exito { background: #e8f5e9; color: #1b5e20; border: 1px solid #b7dfbb; padding: 8px 12px; border-radius: 10px; }
    .alerta-error { background: #fdecea; color: #b42318; border: 1px solid #f5c2bd; padding: 8px 12px; border-radius: 10px; }
    .inter__desarrollo { background: #fff7e6; border: 1px solid #f5c26b; color: #7a4b00; padding: 8px 12px; border-radius: 10px; font-size: 14px; }
    .inter__pestanas { display: flex; gap: 6px; }
    .inter__pestanas button { border: 1px solid var(--borde-color, #e3e7ef); background: var(--fondo-tarjeta, #fff); padding: 8px 16px; border-radius: 999px; cursor: pointer; font-weight: 600; color: var(--texto-secundario); }
    .inter__pestanas button.activa { background: #111a3d; color: #fff; border-color: #111a3d; }
    .fila-fecha { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .fila-fecha .campo-input { width: auto; }
    .etiqueta-cerrado { background: #e8f5e9; color: #1b5e20; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 700; }
    .tarjetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
    .dato { background: var(--fondo-tarjeta, #fff); border: 1px solid var(--borde-color, #e3e7ef); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
    .dato span { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: var(--texto-terciario); font-weight: 700; }
    .dato b { font-size: 20px; color: var(--texto-principal); }
    .dato--principal { border-left: 4px solid #111a3d; }
    .dato--ganancia { border-left: 4px solid #e8590c; }
    .bloque { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .bloque h3 { margin: 0; font-size: 17px; color: var(--texto-principal); }
    .tipos { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
    .tipo { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; border-radius: 12px; border: 2px solid var(--borde-color, #e3e7ef); background: var(--fondo-tarjeta, #fff); cursor: pointer; font-weight: 700; color: var(--texto-principal); }
    .tipo__icono { font-size: 24px; }
    .tipo--activo { border-color: #111a3d; background: rgba(17,26,61,.06); }
    .tipo--gasto.tipo--activo { border-color: #dc2626; background: rgba(220,38,38,.06); }
    .rejilla { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .rejilla .ancho { grid-column: 1 / -1; }
    .grande { font-size: 20px; font-weight: 700; }
    .medios { display: flex; gap: 6px; flex-wrap: wrap; }
    .medio { border: 1px solid var(--borde-color, #e3e7ef); background: var(--fondo-tarjeta, #fff); padding: 8px 12px; border-radius: 999px; cursor: pointer; font-weight: 600; color: var(--texto-secundario); }
    .medio--activo { background: #111a3d; color: #fff; border-color: #111a3d; }
    .registro { display: flex; flex-direction: column; gap: 10px; }
    .registro__pie { display: flex; justify-content: flex-end; gap: 8px; }
    .pendiente { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 10px; background: #fff7e6; border-radius: 10px; flex-wrap: wrap; }
    .tabla-scroll { overflow-x: auto; }
    .num { text-align: right; white-space: nowrap; }
    .egreso { color: #dc2626; }
    tr.anulado td { text-decoration: line-through; color: var(--texto-terciario); }
    tr.anulado td .sub { text-decoration: none; }
    .sub { font-size: 12px; color: var(--texto-terciario); }
    .peligro { color: #dc2626; }
    .estado { color: var(--texto-terciario); padding: 8px 0; }
    .cuentas { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; }
    .cuentas div { background: #f3f5f9; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
    .cuentas span { font-size: 12px; color: var(--texto-terciario); font-weight: 700; }
    .cuentas b { font-size: 18px; color: var(--texto-principal); }
    .cuentas .total { background: #111a3d; } .cuentas .total span { color: #c9d1e6; } .cuentas .total b { color: #fff; }
    .cuentas .bien { background: #e8f5e9; } .cuentas .bien b { color: #1b5e20; }
    .cuentas .mal { background: #fdecea; } .cuentas .mal b, td.mal { color: #b42318; }
    @media (max-width: 760px) { .rejilla { grid-template-columns: 1fr; } }
  `],
})
export class InterrapidisimoComponent implements OnInit {
  private readonly URL = `${entorno.urlApi}/interrapidisimo`;
  readonly hoy = hoy();
  readonly tipos = TIPOS;
  readonly medios = [{ clave: 'EFECTIVO', nombre: 'Efectivo' }, { clave: 'TRANSFERENCIA', nombre: 'Transferencia' }, { clave: 'TARJETA', nombre: 'Tarjeta' }];
  readonly meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  num = num;
  abs = Math.abs;
  vista: 'dia' | 'cierres' = 'dia';
  fecha = hoy();
  dia: Dia | null = null;
  error = '';
  mensaje = '';
  guardando = false;
  form = this.formVacio();
  cierre = { baseInicial: 0, contadoEfectivo: null as number | null, consignado: 0, observaciones: '' };
  cierres: Cierre[] = [];
  totalesCierres = { comisiones: 0, diferencias: 0, consignado: 0 };
  mesCierres = new Date().getMonth() + 1;
  anioCierres = new Date().getFullYear();
  anios = [new Date().getFullYear(), new Date().getFullYear() - 1];
  esSuperAdmin = false;

  constructor(private http: HttpClient, private auth: AutenticacionServicio, private router: Router) {}

  ngOnInit(): void {
    this.esSuperAdmin = this.auth.usuarioActual?.rol === 'SUPER_ADMIN';
    this.cargar();
  }

  private formVacio() {
    return { tipo: '', valor: null as number | null, medioPago: 'EFECTIVO', guia: '', clienteNombre: '', clienteTelefono: '', destino: '', descripcion: '', comision: null as number | null };
  }

  private fallo(e: any, porDefecto: string): void {
    const m = e?.error?.message;
    this.error = m ? [].concat(m).join('. ') : porDefecto;
  }

  private avisar(m: string): void {
    this.mensaje = m;
    this.error = '';
    setTimeout(() => (this.mensaje = ''), 3500);
  }

  get tipoActual() {
    return TIPOS.find((t) => t.clave === this.form.tipo);
  }

  get formValido(): boolean {
    return this.form.valor !== null && num(this.form.valor) > 0 && (this.form.tipo !== 'GASTO' || this.form.descripcion.trim().length >= 3);
  }

  nombreMedio(m: string): string {
    return this.medios.find((x) => x.clave === m)?.nombre ?? m;
  }

  get esperado(): number {
    if (!this.dia) return 0;
    return num(this.cierre.baseInicial) + this.dia.resumen.ingresosEfectivo - this.dia.resumen.egresosEfectivo;
  }

  get diferencia(): number {
    return Math.round((num(this.cierre.contadoEfectivo) - this.esperado) * 100) / 100;
  }

  cargar(): void {
    this.error = '';
    this.http.get<Dia>(`${this.URL}/dia`, { params: { fecha: this.fecha } }).pipe(
      catchError((e) => { this.fallo(e, 'No se pudo cargar el día.'); return of(null); }),
    ).subscribe((d) => {
      this.dia = d;
      if (d && !d.cierre) this.cierre = { baseInicial: d.baseSugerida, contadoEfectivo: null, consignado: 0, observaciones: '' };
    });
  }

  elegirTipo(t: string): void {
    const medio = this.form.medioPago;
    this.form = { ...this.formVacio(), tipo: t, medioPago: medio };
    setTimeout(() => document.getElementById('iValor')?.focus(), 50);
  }

  registrar(): void {
    if (!this.formValido) return;
    this.guardando = true;
    const f = this.form;
    this.http.post(`${this.URL}/movimientos`, {
      tipo: f.tipo, valor: num(f.valor), comision: num(f.comision), medioPago: f.medioPago,
      guia: f.guia || undefined, clienteNombre: f.clienteNombre || undefined, clienteTelefono: f.clienteTelefono || undefined,
      destino: f.destino || undefined, descripcion: f.descripcion || undefined,
    }).pipe(finalize(() => (this.guardando = false))).subscribe({
      next: () => { this.avisar(`${this.tipoActual?.nombre} registrado.`); this.form = { ...this.formVacio(), medioPago: f.medioPago }; this.cargar(); },
      error: (e) => this.fallo(e, 'No se pudo registrar.'),
    });
  }

  completar(m: Movimiento): void {
    this.http.patch(`${this.URL}/movimientos/${m.id}/estado`, { estado: 'COMPLETADO' }).subscribe({
      next: () => { this.avisar(`${m.nombreTipo} marcada como hecha.`); this.cargar(); },
      error: (e) => this.fallo(e, 'No se pudo actualizar.'),
    });
  }

  anular(m: Movimiento): void {
    const motivo = prompt(`¿Por qué se anula este ${m.nombreTipo.toLowerCase()}?`);
    if (!motivo || motivo.trim().length < 3) return;
    this.http.patch(`${this.URL}/movimientos/${m.id}/anular`, { motivo: motivo.trim() }).subscribe({
      next: () => { this.avisar('Movimiento anulado.'); this.cargar(); },
      error: (e) => this.fallo(e, 'No se pudo anular.'),
    });
  }

  cerrarCaja(): void {
    if (!this.dia || this.cierre.contadoEfectivo === null) return;
    const d = this.diferencia;
    if (d !== 0 && !confirm(`${d > 0 ? 'Sobran' : 'Faltan'} $${Math.abs(d).toLocaleString('es-CO')}. ¿Cerrar la caja así?`)) return;
    this.guardando = true;
    this.http.post(`${this.URL}/cierres`, {
      fecha: this.fecha, baseInicial: num(this.cierre.baseInicial), contadoEfectivo: num(this.cierre.contadoEfectivo),
      consignado: num(this.cierre.consignado), observaciones: this.cierre.observaciones || undefined,
    }).pipe(finalize(() => (this.guardando = false))).subscribe({
      next: () => { this.avisar('Caja cerrada.'); this.cargar(); },
      error: (e) => this.fallo(e, 'No se pudo cerrar la caja.'),
    });
  }

  reabrir(): void {
    if (!this.dia?.cierre) return;
    const motivo = prompt('¿Por qué se reabre la caja de este día?');
    if (!motivo || motivo.trim().length < 3) return;
    this.http.patch(`${this.URL}/cierres/${this.dia.cierre.id}/reabrir`, { motivo: motivo.trim() }).subscribe({
      next: () => { this.avisar('Caja reabierta.'); this.cargar(); },
      error: (e) => this.fallo(e, 'No se pudo reabrir.'),
    });
  }

  cargarCierres(): void {
    this.http.get<{ cierres: Cierre[]; totales: { comisiones: number; diferencias: number; consignado: number } }>(`${this.URL}/cierres`, { params: { anio: String(this.anioCierres), mes: String(this.mesCierres) } })
      .pipe(catchError((e) => { this.fallo(e, 'No se pudieron cargar los cierres.'); return of(null); }))
      .subscribe((r) => { this.cierres = r?.cierres ?? []; this.totalesCierres = r?.totales ?? { comisiones: 0, diferencias: 0, consignado: 0 }; });
  }

  salir(): void {
    this.auth.cerrarSesion();
    this.router.navigate(['/ingresar']);
  }
}
