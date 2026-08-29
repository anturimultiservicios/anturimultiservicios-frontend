import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AfiliadosServicio, CrearAfiliadoDto, TipoAfiliacion, ClaseRiesgoArl } from '../../../nucleo/servicios/afiliados.servicio';
import { EmpresasServicio, Empresa } from '../../../nucleo/servicios/empresas.servicio';
import { SucursalesServicio, Sucursal } from '../../../nucleo/servicios/sucursales.servicio';
import { catchError, of } from 'rxjs';

interface ErroresCampo {
  nombres?: string;
  apellidos?: string;
  cedula?: string;
}

interface TipoAfiliacionInfo {
  valor: TipoAfiliacion;
  titulo: string;
  subtitulo: string;
  icono: string;
  descripcion: string;
  tags: string[];
}

// Porcentajes ARL por clase de riesgo (Colombia PILA 2025)
const ARL_POR_CLASE: Record<ClaseRiesgoArl, number> = {
  I:   0.522,
  II:  1.044,
  III: 2.436,
  IV:  4.350,
  V:   6.960,
};

// Porcentajes base por tipo de afiliación (Colombia PILA 2025)
interface Porcentajes {
  salud: number;
  pension: number;
  saludEmpleador: number;
  pensionEmpleador: number;
  caja: number;
  sena: number;
  icbf: number;
}

const PORCENTAJES_POR_TIPO: Record<TipoAfiliacion, Porcentajes> = {
  INDEPENDIENTE_VOLUNTARIO_ARL: {
    salud: 0, pension: 0,
    saludEmpleador: 0, pensionEmpleador: 0,
    caja: 0, sena: 0, icbf: 0,
  },
  INDEPENDIENTE_CONTRATISTA: {
    salud: 12.5, pension: 16,
    saludEmpleador: 0, pensionEmpleador: 0,
    caja: 0, sena: 0, icbf: 0,
  },
  EMPRESA_EXONERADA: {
    salud: 4, pension: 4,
    saludEmpleador: 0, pensionEmpleador: 12,
    caja: 4, sena: 0, icbf: 0,
  },
  EMPRESA_NO_EXONERADA: {
    salud: 4, pension: 4,
    saludEmpleador: 8.5, pensionEmpleador: 12,
    caja: 4, sena: 2, icbf: 3,
  },
};

const TIPOS: TipoAfiliacionInfo[] = [
  {
    valor: 'INDEPENDIENTE_VOLUNTARIO_ARL',
    titulo: 'Independiente Voluntario ARL',
    subtitulo: 'Solo riesgos profesionales',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    descripcion: 'Persona independiente que cotiza únicamente al sistema de riesgos laborales (ARL). No cotiza salud ni pensión por esta modalidad.',
    tags: ['ARL según clase de riesgo'],
  },
  {
    valor: 'INDEPENDIENTE_CONTRATISTA',
    titulo: 'Independiente Contratista',
    subtitulo: 'Contrato mayor a un mes',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,
    descripcion: 'Trabajador independiente con contrato de prestación de servicios mayor a un mes. Asume el 100% de salud y pensión.',
    tags: ['Salud 12.5%', 'Pensión 16%', 'ARL según riesgo'],
  },
  {
    valor: 'EMPRESA_EXONERADA',
    titulo: 'Empresa Exonerada',
    subtitulo: 'Empleados < 10 SMLMV',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
    descripcion: 'Empresa exonerada de aportes a salud, SENA e ICBF (Art. 114-1 ET). Aplica para empleados que devenguen menos de 10 SMLMV.',
    tags: ['Empleado: Salud 4% + Pensión 4%', 'Empleador: Pensión 12% + Caja 4%', 'Exonerada: Salud, SENA, ICBF'],
  },
  {
    valor: 'EMPRESA_NO_EXONERADA',
    titulo: 'Empresa No Exonerada',
    subtitulo: 'Aportes completos',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
    descripcion: 'Empresa que paga todos los aportes parafiscales. Incluye SENA, ICBF y salud empleador además de pensión y caja.',
    tags: ['Empleado: Salud 4% + Pensión 4%', 'Empleador: Salud 8.5% + Pensión 12% + Caja 4% + SENA 2% + ICBF 3%'],
  },
];

@Component({
  selector: 'anturi-formulario-afiliado',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="pagina-formulario">
      <!-- Encabezado -->
      <div class="form-encabezado">
        <button class="boton boton-icono" (click)="volver()" title="Volver">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div>
          <h2 class="pagina-titulo">Nuevo afiliado</h2>
          <p class="pagina-subtitulo">
            {{ tipoSeleccionado ? 'Complete los datos · ' + etiquetaTipo(tipoSeleccionado) : 'Seleccione el tipo de afiliación para comenzar' }}
          </p>
        </div>
      </div>

      <!-- PASO 0: Selección de tipo -->
      <div class="tarjeta selector-tipo-contenedor">
        <div class="selector-tipo-encabezado">
          <span class="selector-tipo-icono-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </span>
          <h3 class="selector-tipo-titulo">Tipo de afiliación <span class="requerido">*</span></h3>
          <p class="selector-tipo-subtitulo">Seleccione el tipo para cargar automáticamente los porcentajes PILA correspondientes</p>
        </div>
        <div class="tipos-grid">
          <button
            *ngFor="let tipo of tipos"
            type="button"
            class="tipo-card"
            [class.tipo-card--activo]="tipoSeleccionado === tipo.valor"
            (click)="seleccionarTipo(tipo.valor)"
          >
            <div class="tipo-card__icono" [innerHTML]="tipo.icono"></div>
            <div class="tipo-card__cuerpo">
              <span class="tipo-card__titulo">{{ tipo.titulo }}</span>
              <span class="tipo-card__subtitulo">{{ tipo.subtitulo }}</span>
              <div class="tipo-card__tags">
                <span *ngFor="let tag of tipo.tags" class="tipo-tag">{{ tag }}</span>
              </div>
            </div>
            <div class="tipo-card__check" *ngIf="tipoSeleccionado === tipo.valor">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </button>
        </div>

        <!-- Descripción del tipo seleccionado -->
        <div *ngIf="tipoSeleccionado" class="tipo-descripcion">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{{ descripcionTipo(tipoSeleccionado) }}</span>
        </div>
      </div>

      <!-- Porcentajes cargados (resumen visual) -->
      <div *ngIf="tipoSeleccionado" class="tarjeta porcentajes-resumen">
        <h4 class="porcentajes-titulo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          Porcentajes PILA cargados automáticamente
        </h4>
        <div class="porcentajes-grid">
          <ng-container *ngIf="tipoSeleccionado === 'INDEPENDIENTE_VOLUNTARIO_ARL'">
            <div class="pct-item pct-item--arl">
              <span class="pct-label">ARL (clase {{ form.claseRiesgoArl || '?' }})</span>
              <span class="pct-valor">{{ form.porcentajeArl || '—' }}%</span>
            </div>
            <div class="pct-item pct-item--nota">
              <span class="pct-label">Salud / Pensión</span>
              <span class="pct-valor">No aplica</span>
            </div>
          </ng-container>
          <ng-container *ngIf="tipoSeleccionado === 'INDEPENDIENTE_CONTRATISTA'">
            <div class="pct-item">
              <span class="pct-label">Salud (contratista)</span>
              <span class="pct-valor">12.5%</span>
            </div>
            <div class="pct-item">
              <span class="pct-label">Pensión (contratista)</span>
              <span class="pct-valor">16%</span>
            </div>
            <div class="pct-item pct-item--arl">
              <span class="pct-label">ARL (clase {{ form.claseRiesgoArl || '?' }})</span>
              <span class="pct-valor">{{ form.porcentajeArl || '—' }}%</span>
            </div>
          </ng-container>
          <ng-container *ngIf="tipoSeleccionado === 'EMPRESA_EXONERADA'">
            <div class="pct-item pct-item--empleado">
              <span class="pct-label">Salud (empleado)</span>
              <span class="pct-valor">4%</span>
            </div>
            <div class="pct-item pct-item--empleado">
              <span class="pct-label">Pensión (empleado)</span>
              <span class="pct-valor">4%</span>
            </div>
            <div class="pct-item pct-item--empleador">
              <span class="pct-label">Pensión (empleador)</span>
              <span class="pct-valor">12%</span>
            </div>
            <div class="pct-item pct-item--empleador">
              <span class="pct-label">Caja (empleador)</span>
              <span class="pct-valor">4%</span>
            </div>
            <div class="pct-item pct-item--arl">
              <span class="pct-label">ARL (clase {{ form.claseRiesgoArl || '?' }})</span>
              <span class="pct-valor">{{ form.porcentajeArl || '—' }}%</span>
            </div>
            <div class="pct-item pct-item--exonerado">
              <span class="pct-label">Salud emp. / SENA / ICBF</span>
              <span class="pct-valor">Exonerado</span>
            </div>
          </ng-container>
          <ng-container *ngIf="tipoSeleccionado === 'EMPRESA_NO_EXONERADA'">
            <div class="pct-item pct-item--empleado">
              <span class="pct-label">Salud (empleado)</span>
              <span class="pct-valor">4%</span>
            </div>
            <div class="pct-item pct-item--empleado">
              <span class="pct-label">Pensión (empleado)</span>
              <span class="pct-valor">4%</span>
            </div>
            <div class="pct-item pct-item--empleador">
              <span class="pct-label">Salud (empleador)</span>
              <span class="pct-valor">8.5%</span>
            </div>
            <div class="pct-item pct-item--empleador">
              <span class="pct-label">Pensión (empleador)</span>
              <span class="pct-valor">12%</span>
            </div>
            <div class="pct-item pct-item--empleador">
              <span class="pct-label">Caja (empleador)</span>
              <span class="pct-valor">4%</span>
            </div>
            <div class="pct-item pct-item--empleador">
              <span class="pct-label">SENA</span>
              <span class="pct-valor">2%</span>
            </div>
            <div class="pct-item pct-item--empleador">
              <span class="pct-label">ICBF</span>
              <span class="pct-valor">3%</span>
            </div>
            <div class="pct-item pct-item--arl">
              <span class="pct-label">ARL (clase {{ form.claseRiesgoArl || '?' }})</span>
              <span class="pct-valor">{{ form.porcentajeArl || '—' }}%</span>
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Mensaje de error global -->
      <div *ngIf="errorGlobal" class="alerta-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        {{ errorGlobal }}
      </div>

      <!-- Formulario (visible solo cuando hay tipo seleccionado) -->
      <form *ngIf="tipoSeleccionado" (ngSubmit)="guardar()" #formAfiliado="ngForm">

        <!-- SECCIÓN 1: Datos personales -->
        <div class="tarjeta seccion-form">
          <h3 class="seccion-titulo">
            <span class="seccion-numero">1</span>
            Datos personales
          </h3>
          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Nombres <span class="requerido">*</span></label>
              <input type="text" class="campo-input" [class.campo-error]="errores.nombres"
                [(ngModel)]="form.nombres" name="nombres" placeholder="Ingrese nombres"
                (blur)="validarCampo('nombres')">
              <span *ngIf="errores.nombres" class="mensaje-error">{{ errores.nombres }}</span>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Apellidos <span class="requerido">*</span></label>
              <input type="text" class="campo-input" [class.campo-error]="errores.apellidos"
                [(ngModel)]="form.apellidos" name="apellidos" placeholder="Ingrese apellidos"
                (blur)="validarCampo('apellidos')">
              <span *ngIf="errores.apellidos" class="mensaje-error">{{ errores.apellidos }}</span>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Cédula <span class="requerido">*</span></label>
              <input type="text" class="campo-input" [class.campo-error]="errores.cedula"
                [(ngModel)]="form.cedula" name="cedula" placeholder="Número de cédula"
                (blur)="validarCampo('cedula')">
              <span *ngIf="errores.cedula" class="mensaje-error">{{ errores.cedula }}</span>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Correo electrónico</label>
              <input type="email" class="campo-input" [(ngModel)]="form.correo" name="correo" placeholder="correo@ejemplo.com">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Teléfono</label>
              <input type="tel" class="campo-input" [(ngModel)]="form.telefono" name="telefono" placeholder="Número de teléfono">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Fecha de nacimiento</label>
              <input type="date" class="campo-input" [(ngModel)]="form.fechaNacimiento" name="fechaNacimiento">
            </div>
          </div>
        </div>

        <!-- SECCIÓN 2: Datos laborales -->
        <div class="tarjeta seccion-form">
          <h3 class="seccion-titulo">
            <span class="seccion-numero">2</span>
            Datos laborales
          </h3>
          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Cargo</label>
              <input type="text" class="campo-input" [(ngModel)]="form.cargo" name="cargo" placeholder="Cargo o función">
            </div>
            <!-- HALLAZGO (29/08): selector Empresa/Sucursal, antes no existía
                 ningún camino para vincular un afiliado-empleado con su
                 empleador. Solo aplica a los tipos "Empresa" - un
                 independiente no tiene empleador. Sucursal queda opcional:
                 el backend ya trata sucursalId como nullable. -->
            <ng-container *ngIf="esEmpresa">
              <div class="campo-grupo">
                <label class="campo-etiqueta">Empresa</label>
                <select class="campo-input" [(ngModel)]="empresaSeleccionadaId" name="empresaSeleccionada" (change)="onEmpresaChange()" [disabled]="cargandoEmpresas">
                  <option [ngValue]="undefined">{{ cargandoEmpresas ? 'Cargando empresas...' : 'Seleccionar empresa...' }}</option>
                  <option *ngFor="let emp of empresas" [ngValue]="emp.id">{{ emp.razonSocial }}</option>
                </select>
                <span *ngIf="!cargandoEmpresas && empresas.length === 0" class="mensaje-error">
                  No hay empresas registradas todavía - creá una empresa antes de poder vincular este afiliado.
                </span>
              </div>
              <div class="campo-grupo">
                <label class="campo-etiqueta">Sucursal (opcional)</label>
                <select class="campo-input" [(ngModel)]="form.sucursalId" name="sucursalId" [disabled]="!empresaSeleccionadaId || cargandoSucursales">
                  <option [ngValue]="undefined">{{ cargandoSucursales ? 'Cargando sucursales...' : 'Sin sucursal específica' }}</option>
                  <option *ngFor="let suc of sucursales" [ngValue]="suc.id">{{ suc.nombre }}</option>
                </select>
              </div>
            </ng-container>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Clase aportante</label>
              <select class="campo-input" [(ngModel)]="form.claseAportante" name="claseAportante">
                <option value="">Seleccionar...</option>
                <option value="DOMESTICA">Doméstica</option>
                <option value="Independiente">Independiente</option>
                <option value="Cooperativa">Cooperativa</option>
                <option value="Empresa">Empresa</option>
                <option value="FINCA SAN FELIPE">Finca San Felipe</option>
              </select>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Asopagos</label>
              <input type="text" class="campo-input" [(ngModel)]="form.asopagos" name="asopagos" placeholder="Asopagos">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Días de pago</label>
              <input type="number" class="campo-input" [(ngModel)]="form.diasPago" name="diasPago" placeholder="0" min="0">
            </div>
            <div class="campo-grupo campo-grupo--ancho">
              <label class="campo-etiqueta">Actividad económica</label>
              <input type="text" class="campo-input" [(ngModel)]="form.actividadEconomica" name="actividadEconomica" placeholder="Descripción de la actividad económica">
            </div>
          </div>
        </div>

        <!-- SECCIÓN 3: Seguros y porcentajes -->
        <div class="tarjeta seccion-form">
          <h3 class="seccion-titulo">
            <span class="seccion-numero">3</span>
            Seguros y porcentajes PILA
          </h3>
          <div class="campos-grid">
            <!-- Clase de riesgo ARL -->
            <div class="campo-grupo">
              <label class="campo-etiqueta">Clase de riesgo ARL <span class="requerido">*</span></label>
              <select class="campo-input" [(ngModel)]="form.claseRiesgoArl" name="claseRiesgoArl" (change)="actualizarArl()">
                <option value="">Seleccionar clase...</option>
                <option value="I">Clase I — Mínimo (0.522%)</option>
                <option value="II">Clase II — Bajo (1.044%)</option>
                <option value="III">Clase III — Medio (2.436%)</option>
                <option value="IV">Clase IV — Alto (4.350%)</option>
                <option value="V">Clase V — Máximo (6.960%)</option>
              </select>
            </div>

            <div class="campo-grupo">
              <label class="campo-etiqueta">ARL (%)</label>
              <input type="number" class="campo-input campo-input--readonly" [(ngModel)]="form.porcentajeArl"
                name="porcentajeArl" placeholder="—" min="0" max="100" step="0.001" readonly>
            </div>

            <ng-container *ngIf="tipoSeleccionado !== 'INDEPENDIENTE_VOLUNTARIO_ARL'">
              <div class="campo-grupo">
                <label class="campo-etiqueta">Salud empleado (%)</label>
                <input type="number" class="campo-input campo-input--readonly" [(ngModel)]="form.porcentajeSalud"
                  name="porcentajeSalud" readonly>
              </div>
              <div class="campo-grupo">
                <label class="campo-etiqueta">Pensión empleado (%)</label>
                <input type="number" class="campo-input campo-input--readonly" [(ngModel)]="form.porcentajePension"
                  name="porcentajePension" readonly>
              </div>
            </ng-container>

            <ng-container *ngIf="tipoSeleccionado === 'EMPRESA_EXONERADA' || tipoSeleccionado === 'EMPRESA_NO_EXONERADA'">
              <div class="campo-grupo">
                <label class="campo-etiqueta">Salud empleador (%)</label>
                <input type="number" class="campo-input campo-input--readonly" [(ngModel)]="form.porcentajeSaludEmpleador"
                  name="porcentajeSaludEmpleador" readonly>
              </div>
              <div class="campo-grupo">
                <label class="campo-etiqueta">Pensión empleador (%)</label>
                <input type="number" class="campo-input campo-input--readonly" [(ngModel)]="form.porcentajePensionEmpleador"
                  name="porcentajePensionEmpleador" readonly>
              </div>
              <div class="campo-grupo">
                <label class="campo-etiqueta">Caja de compensación (%)</label>
                <input type="number" class="campo-input campo-input--readonly" [(ngModel)]="form.porcentajeCaja"
                  name="porcentajeCaja" readonly>
              </div>
              <ng-container *ngIf="tipoSeleccionado === 'EMPRESA_NO_EXONERADA'">
                <div class="campo-grupo">
                  <label class="campo-etiqueta">SENA (%)</label>
                  <input type="number" class="campo-input campo-input--readonly" [(ngModel)]="form.porcentajeSena"
                    name="porcentajeSena" readonly>
                </div>
                <div class="campo-grupo">
                  <label class="campo-etiqueta">ICBF (%)</label>
                  <input type="number" class="campo-input campo-input--readonly" [(ngModel)]="form.porcentajeIcbf"
                    name="porcentajeIcbf" readonly>
                </div>
              </ng-container>
            </ng-container>

            <div class="campo-grupo">
              <label class="campo-etiqueta">EPS</label>
              <input type="text" class="campo-input" [(ngModel)]="form.eps" name="eps" placeholder="Nombre de la EPS">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">AFP (Pensión)</label>
              <input type="text" class="campo-input" [(ngModel)]="form.afp" name="afp" placeholder="Nombre de la AFP">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Entidad ARL</label>
              <input type="text" class="campo-input" [(ngModel)]="form.arl" name="arl" placeholder="Nombre de la ARL">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Caja de compensación</label>
              <input type="text" class="campo-input" [(ngModel)]="form.caja" name="caja" placeholder="Nombre de la caja">
            </div>
          </div>
        </div>

        <!-- SECCIÓN 4: Valores económicos -->
        <div class="tarjeta seccion-form">
          <h3 class="seccion-titulo">
            <span class="seccion-numero">4</span>
            Valores económicos
          </h3>
          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Valor base</label>
              <input type="number" class="campo-input" [(ngModel)]="form.valor" name="valor"
                placeholder="0" min="0" (ngModelChange)="calcularTotal()">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Comisión</label>
              <input type="number" class="campo-input" [(ngModel)]="form.comision" name="comision"
                placeholder="0" min="0" (ngModelChange)="calcularTotal()">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Total pago (calculado)</label>
              <input type="number" class="campo-input campo-input--readonly" [value]="totalPago" readonly>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">4 x Mil</label>
              <input type="number" class="campo-input" [(ngModel)]="form.cuatroXMil" name="cuatroXMil" placeholder="0" min="0">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Cesantías</label>
              <input type="number" class="campo-input" [(ngModel)]="form.cesantias" name="cesantias" placeholder="0" min="0">
            </div>
          </div>
        </div>

        <!-- SECCIÓN 5: Estado y fechas -->
        <div class="tarjeta seccion-form">
          <h3 class="seccion-titulo">
            <span class="seccion-numero">5</span>
            Estado y fechas
          </h3>
          <div class="campos-grid">
            <div class="campo-grupo">
              <label class="campo-etiqueta">Estado inicial</label>
              <select class="campo-input" [(ngModel)]="form.estado" name="estado">
                <option value="ACTIVO">Activo</option>
                <option value="RETIRADO">Retirado</option>
                <option value="SUSPENDIDO">Suspendido</option>
              </select>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Fecha de ingreso</label>
              <input type="date" class="campo-input" [(ngModel)]="form.fechaIngreso" name="fechaIngreso">
            </div>
          </div>
        </div>

        <!-- Acciones -->
        <div class="form-acciones">
          <button type="button" class="boton boton-secundario" (click)="volver()" [disabled]="guardando">
            Cancelar
          </button>
          <button type="submit" class="boton boton-primario" [disabled]="guardando">
            <span *ngIf="guardando" class="spinner-inline"></span>
            {{ guardando ? 'Guardando...' : 'Guardar afiliado' }}
          </button>
        </div>
      </form>

      <!-- Placeholder cuando no hay tipo seleccionado -->
      <div *ngIf="!tipoSeleccionado" class="tarjeta placeholder-form">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <path d="M9 11l3 3L22 4"></path>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
        <p>Seleccione un tipo de afiliación arriba para continuar con el registro</p>
      </div>
    </div>
  `,
  styles: [`
    .pagina-formulario { display: flex; flex-direction: column; gap: var(--espacio-5); max-width: 900px; }
    .form-encabezado { display: flex; align-items: center; gap: var(--espacio-4); }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .pagina-subtitulo { font-size: var(--tamano-sm); color: var(--texto-terciario); margin: var(--espacio-1) 0 0; }

    /* Selector de tipo */
    .selector-tipo-contenedor { padding: var(--espacio-5); }
    .selector-tipo-encabezado { margin-bottom: var(--espacio-4); }
    .selector-tipo-icono-header { display: inline-flex; color: var(--color-primario); margin-right: var(--espacio-2); vertical-align: middle; }
    .selector-tipo-titulo { display: inline; font-size: var(--tamano-lg); font-weight: 600; color: var(--texto-principal); margin: 0; }
    .selector-tipo-subtitulo { font-size: var(--tamano-sm); color: var(--texto-terciario); margin: var(--espacio-1) 0 0; }

    .tipos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--espacio-3); }

    .tipo-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--espacio-2);
      padding: var(--espacio-4);
      background: var(--fondo-tarjeta);
      border: 2px solid var(--borde-color);
      border-radius: var(--radio-lg);
      cursor: pointer;
      text-align: left;
      transition: all var(--transicion-rapida);
    }
    .tipo-card:hover { border-color: var(--color-primario); background: var(--fondo-tarjeta-hover); }
    .tipo-card--activo { border-color: var(--color-primario); background: rgba(27,50,112,0.06); }

    .tipo-card__icono { color: var(--color-secundario); }
    .tipo-card--activo .tipo-card__icono { color: var(--color-primario); }

    .tipo-card__cuerpo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .tipo-card__titulo { font-size: var(--tamano-sm); font-weight: 700; color: var(--texto-principal); }
    .tipo-card__subtitulo { font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .tipo-card__tags { display: flex; flex-direction: column; gap: 3px; margin-top: var(--espacio-1); }
    .tipo-tag { font-size: 0.65rem; color: var(--color-primario); font-weight: 600; }

    .tipo-card__check {
      position: absolute;
      top: var(--espacio-3);
      right: var(--espacio-3);
      width: 20px; height: 20px;
      border-radius: 50%;
      background: var(--color-primario);
      color: white;
      display: flex; align-items: center; justify-content: center;
    }

    .tipo-descripcion { display: flex; align-items: flex-start; gap: var(--espacio-2); margin-top: var(--espacio-4); padding: var(--espacio-3) var(--espacio-4); background: rgba(27,50,112,0.05); border-radius: var(--radio-md); border-left: 3px solid var(--color-primario); font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .tipo-descripcion svg { flex-shrink: 0; color: var(--color-primario); margin-top: 1px; }

    /* Resumen porcentajes */
    .porcentajes-resumen { padding: var(--espacio-4) var(--espacio-5); }
    .porcentajes-titulo { display: flex; align-items: center; gap: var(--espacio-2); font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-principal); margin: 0 0 var(--espacio-3); }
    .porcentajes-grid { display: flex; flex-wrap: wrap; gap: var(--espacio-2); }
    .pct-item { display: flex; flex-direction: column; gap: 2px; padding: var(--espacio-2) var(--espacio-3); border-radius: var(--radio-md); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.04)); min-width: 120px; }
    .pct-item--empleado { background: rgba(34,197,94,0.08); }
    .pct-item--empleador { background: rgba(59,130,246,0.08); }
    .pct-item--arl { background: rgba(232,87,12,0.08); }
    .pct-item--exonerado { background: rgba(168,85,247,0.08); }
    .pct-item--nota { background: rgba(156,163,175,0.1); }
    .pct-label { font-size: 0.68rem; font-weight: 500; color: var(--texto-terciario); }
    .pct-valor { font-size: var(--tamano-sm); font-weight: 700; color: var(--texto-principal); }

    /* Formulario */
    .seccion-form { padding: var(--espacio-5); }
    .seccion-titulo { display: flex; align-items: center; gap: var(--espacio-3); font-size: var(--tamano-lg); font-weight: 600; color: var(--texto-principal); margin: 0 0 var(--espacio-5); }
    .seccion-numero { width: 28px; height: 28px; border-radius: 50%; background: var(--color-primario); color: white; display: flex; align-items: center; justify-content: center; font-size: var(--tamano-sm); font-weight: 700; flex-shrink: 0; }

    .campos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .campo-grupo--ancho { grid-column: 1 / -1; }

    .campo-input--readonly { background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.04)); cursor: not-allowed; color: var(--texto-secundario); }

    .campo-error { border-color: var(--color-error) !important; }
    .mensaje-error { font-size: var(--tamano-sm); color: var(--color-error); }
    .requerido { color: var(--color-error); }

    .alerta-error { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radio-md); color: var(--color-error); font-size: var(--tamano-sm); }

    .form-acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); padding: var(--espacio-2) 0; }

    .placeholder-form { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-3); padding: var(--espacio-10); color: var(--texto-terciario); text-align: center; }
    .placeholder-form svg { opacity: 0.35; }

    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }
    @keyframes girar { to { transform: rotate(360deg); } }
  `]
})
export class FormularioAfiliadoComponent implements OnInit {
  readonly tipos = TIPOS;

  tipoSeleccionado: TipoAfiliacion | null = null;

  form: CrearAfiliadoDto & { caja?: string; cesantias?: number; cuatroXMil?: number } = {
    nombres: '',
    apellidos: '',
    cedula: '',
    correo: '',
    telefono: '',
    fechaNacimiento: '',
    cargo: '',
    claseAportante: '',
    asopagos: '',
    diasPago: undefined,
    tipoAfiliacion: undefined,
    claseRiesgoArl: undefined,
    porcentajeArl: undefined,
    porcentajeSalud: undefined,
    porcentajePension: undefined,
    porcentajeSaludEmpleador: undefined,
    porcentajePensionEmpleador: undefined,
    porcentajeCaja: undefined,
    porcentajeSena: undefined,
    porcentajeIcbf: undefined,
    actividadEconomica: '',
    valor: undefined,
    comision: undefined,
    totalPago: undefined,
    eps: '',
    afp: '',
    arl: '',
    caja: '',
    cuatroXMil: undefined,
    cesantias: undefined,
    estado: 'ACTIVO',
    fechaIngreso: new Date().toISOString().substring(0, 10),
  };

  errores: ErroresCampo = {};
  errorGlobal = '';
  guardando = false;
  totalPago = 0;

  // HALLAZGO (29/08, ver DIAGNOSTICO-MAESTRO-USO-REAL-2026-08-29.md): este
  // formulario no tenía forma de vincular un afiliado-empleado con su
  // Empresa/Sucursal - solo se muestra para EMPRESA_EXONERADA/
  // EMPRESA_NO_EXONERADA (un independiente no tiene empleador). Sucursal
  // es opcional a propósito: el backend ya trata sucursalId como nullable,
  // no se inventa una obligatoriedad que no existe hoy.
  empresas: Empresa[] = [];
  sucursales: Sucursal[] = [];
  empresaSeleccionadaId?: number;
  cargandoEmpresas = false;
  cargandoSucursales = false;

  get esEmpresa(): boolean {
    return this.tipoSeleccionado === 'EMPRESA_EXONERADA' || this.tipoSeleccionado === 'EMPRESA_NO_EXONERADA';
  }

  constructor(
    private afiliadosServicio: AfiliadosServicio,
    private empresasServicio: EmpresasServicio,
    private sucursalesServicio: SucursalesServicio,
    private router: Router
  ) {}

  private get prefijo(): string {
    return this.router.url.startsWith('/secretaria') ? '/secretaria' : '/admin';
  }

  ngOnInit(): void {
    this.form.fechaIngreso = new Date().toISOString().substring(0, 10);
    this.cargandoEmpresas = true;
    this.empresasServicio.listar(undefined, false).pipe(
      catchError(() => { this.cargandoEmpresas = false; return of([]); }),
    ).subscribe((lista) => { this.empresas = lista; this.cargandoEmpresas = false; });
  }

  onEmpresaChange(): void {
    this.form.sucursalId = undefined;
    this.sucursales = [];
    if (!this.empresaSeleccionadaId) return;
    this.cargandoSucursales = true;
    this.sucursalesServicio.listarPorEmpresa(this.empresaSeleccionadaId).pipe(
      catchError(() => { this.cargandoSucursales = false; return of([]); }),
    ).subscribe((lista) => { this.sucursales = lista; this.cargandoSucursales = false; });
  }

  seleccionarTipo(tipo: TipoAfiliacion): void {
    this.tipoSeleccionado = tipo;
    this.form.tipoAfiliacion = tipo;
    const pct = PORCENTAJES_POR_TIPO[tipo];
    this.form.porcentajeSalud = pct.salud || undefined;
    this.form.porcentajePension = pct.pension || undefined;
    this.form.porcentajeSaludEmpleador = pct.saludEmpleador || undefined;
    this.form.porcentajePensionEmpleador = pct.pensionEmpleador || undefined;
    this.form.porcentajeCaja = pct.caja || undefined;
    this.form.porcentajeSena = pct.sena || undefined;
    this.form.porcentajeIcbf = pct.icbf || undefined;
    // Mantener ARL si ya se había seleccionado clase de riesgo
    if (this.form.claseRiesgoArl) this.actualizarArl();
  }

  actualizarArl(): void {
    if (this.form.claseRiesgoArl) {
      this.form.porcentajeArl = ARL_POR_CLASE[this.form.claseRiesgoArl];
    }
  }

  etiquetaTipo(tipo: TipoAfiliacion): string {
    return TIPOS.find(t => t.valor === tipo)?.titulo ?? tipo;
  }

  descripcionTipo(tipo: TipoAfiliacion): string {
    return TIPOS.find(t => t.valor === tipo)?.descripcion ?? '';
  }

  calcularTotal(): void {
    const valor = Number(this.form.valor) || 0;
    const comision = Number(this.form.comision) || 0;
    this.totalPago = valor + comision;
    this.form.totalPago = this.totalPago;
  }

  validarCampo(campo: keyof ErroresCampo): void {
    switch (campo) {
      case 'nombres':
        this.errores.nombres = this.form.nombres?.trim() ? '' : 'Los nombres son requeridos';
        break;
      case 'apellidos':
        this.errores.apellidos = this.form.apellidos?.trim() ? '' : 'Los apellidos son requeridos';
        break;
      case 'cedula':
        this.errores.cedula = this.form.cedula?.trim() ? '' : 'La cédula es requerida';
        break;
    }
  }

  validarTodo(): boolean {
    if (!this.tipoSeleccionado) {
      this.errorGlobal = 'Seleccione un tipo de afiliación para continuar.';
      return false;
    }
    this.validarCampo('nombres');
    this.validarCampo('apellidos');
    this.validarCampo('cedula');
    return !this.errores.nombres && !this.errores.apellidos && !this.errores.cedula;
  }

  guardar(): void {
    if (!this.validarTodo()) return;

    this.guardando = true;
    this.errorGlobal = '';

    const dto: CrearAfiliadoDto = {
      nombres: this.form.nombres.trim(),
      apellidos: this.form.apellidos.trim(),
      cedula: this.form.cedula.trim(),
      correo: this.form.correo || undefined,
      telefono: this.form.telefono || undefined,
      fechaNacimiento: this.form.fechaNacimiento || undefined,
      cargo: this.form.cargo || undefined,
      claseAportante: this.form.claseAportante || undefined,
      asopagos: this.form.asopagos || undefined,
      diasPago: this.form.diasPago || undefined,
      tipoAfiliacion: this.form.tipoAfiliacion,
      sucursalId: this.esEmpresa ? this.form.sucursalId : undefined,
      claseRiesgoArl: this.form.claseRiesgoArl || undefined,
      porcentajeArl: this.form.porcentajeArl || undefined,
      porcentajeSalud: this.form.porcentajeSalud || undefined,
      porcentajePension: this.form.porcentajePension || undefined,
      porcentajeSaludEmpleador: this.form.porcentajeSaludEmpleador || undefined,
      porcentajePensionEmpleador: this.form.porcentajePensionEmpleador || undefined,
      porcentajeCaja: this.form.porcentajeCaja || undefined,
      porcentajeSena: this.form.porcentajeSena || undefined,
      porcentajeIcbf: this.form.porcentajeIcbf || undefined,
      actividadEconomica: this.form.actividadEconomica || undefined,
      valor: this.form.valor || undefined,
      comision: this.form.comision || undefined,
      totalPago: this.totalPago || undefined,
      eps: this.form.eps || undefined,
      afp: this.form.afp || undefined,
      arl: this.form.arl || undefined,
      caja: this.form.caja || undefined,
      estado: this.form.estado || 'ACTIVO',
      fechaIngreso: this.form.fechaIngreso || undefined,
    };

    this.afiliadosServicio.crear(dto).subscribe({
      next: (afiliado) => {
        this.guardando = false;
        this.router.navigate([this.prefijo, 'afiliados', afiliado.id]);
      },
      error: (err) => {
        this.guardando = false;
        this.errorGlobal = err?.error?.mensaje || 'Error al crear el afiliado. Verifique los datos e intente nuevamente.';
      }
    });
  }

  volver(): void {
    this.router.navigate([this.prefijo, 'afiliados']);
  }
}
