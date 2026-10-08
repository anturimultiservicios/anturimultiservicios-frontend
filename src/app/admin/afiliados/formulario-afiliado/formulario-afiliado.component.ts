import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, Observable, debounceTime, forkJoin, takeUntil, catchError, of } from 'rxjs';
import { AfiliadosServicio, CrearAfiliadoDto, TipoAfiliacion, ClaseRiesgoArl, GeneroAfiliado } from '../../../nucleo/servicios/afiliados.servicio';
import { MotorLiquidacionServicio, PlantillaLiquidacion, ResultadoMotorLiquidacion } from '../../../nucleo/servicios/motor-liquidacion.servicio';
import { AutenticacionServicio } from '../../../nucleo/servicios/autenticacion.servicio';
import { TIPOS_DOCUMENTO } from '../../../nucleo/utilidades/tipos-documento';
import { CredencialesNuevasComponent, credencialesValidas } from '../../../compartido/credenciales-nuevas/credenciales-nuevas.component';
import { CredencialesServicio, NuevaCredencial } from '../../../nucleo/servicios/credenciales.servicio';

interface ErroresCampo {
  nombres?: string;
  apellidos?: string;
  cedula?: string;
  genero?: string;
  confirmarCorreo?: string;
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

// 2026-10-07 (hallazgo real, verificado contra plantillas_liquidacion reales
// vía SQL directo - tipos 5-19, "Ind. Voluntario ARL — Salud, Pensión y ARL"):
// INDEPENDIENTE_VOLUNTARIO_ARL SÍ cotiza salud+pensión igual que CONTRATISTA
// - "Voluntario" se refiere a que el ARL no es obligatorio para un
// independiente, no a que salud/pensión "no apliquen". El dato de acá
// decía salud:0/pension:0 - estaba mal, nunca se había verificado contra
// el motor real porque nunca se había llamado.
const PORCENTAJES_POR_TIPO: Record<TipoAfiliacion, Porcentajes> = {
  // 2026-10-08: plantillas 1-4 reales ("1. Independiente") - existían en la
  // base desde el Excel pero nunca tuvieron tarjeta. Pensión se apaga si
  // elige "Solo salud" (ver alCambiarCobertura()).
  INDEPENDIENTE: {
    salud: 12.5, pension: 16,
    saludEmpleador: 0, pensionEmpleador: 0,
    caja: 0, sena: 0, icbf: 0,
  },
  // Decreto 2616/2013: sin salud (régimen subsidiado o beneficiario), pensión
  // 16% sobre semanas cotizadas, ARL sobre 1 SMLMV, caja opcional.
  INDEPENDIENTE_PARCIAL: {
    salud: 0, pension: 16,
    saludEmpleador: 0, pensionEmpleador: 0,
    caja: 0, sena: 0, icbf: 0,
  },
  // Ley 100/1993 art. 15 + Decreto 682/2014: afiliado voluntario a pensión,
  // no cotiza salud ni ARL en Colombia (plantilla 35).
  INDEPENDIENTE_RESIDENTE_EXTERIOR: {
    salud: 0, pension: 16,
    saludEmpleador: 0, pensionEmpleador: 0,
    caja: 0, sena: 0, icbf: 0,
  },
  INDEPENDIENTE_VOLUNTARIO_ARL: {
    salud: 12.5, pension: 16,
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
    valor: 'INDEPENDIENTE',
    titulo: 'Independiente',
    subtitulo: 'Salud y pensión, o solo salud',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    descripcion: 'Independiente sin ARL. Cotiza salud (12.5%) y pensión (16%). "Solo salud" aplica únicamente si es pensionado, o si ya tiene la edad de pensión: mujeres desde 57 años y hombres desde 62. Caja de compensación opcional.',
    tags: ['Salud 12.5%', 'Pensión 16%', 'Solo salud: pensionado o edad'],
  },
  {
    valor: 'INDEPENDIENTE_PARCIAL',
    titulo: 'Independiente Parcial',
    subtitulo: 'Ingresos menores al mínimo',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    descripcion: 'Gana menos de un salario mínimo y cotiza por semanas según los días trabajados en el mes (Decreto 2616 de 2013): de 1 a 7 días es 1 semana, de 8 a 14 son 2, de 15 a 21 son 3 y más de 21 son 4. Pensión y ARL son obligatorias, y la ARL siempre se calcula sobre 1 SMMLV completo. La caja es opcional. No cotiza EPS: debe estar en el régimen subsidiado o como beneficiario.',
    tags: ['Pensión 16% por semanas', 'ARL sobre 1 SMMLV', 'Sin EPS · Caja opcional'],
  },
  {
    valor: 'INDEPENDIENTE_RESIDENTE_EXTERIOR',
    titulo: 'Independiente Residente Exterior',
    subtitulo: 'Colombiano que vive fuera del país',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    descripcion: 'Colombiano domiciliado en el exterior, afiliado voluntario solo a pensión (Ley 100 de 1993, art. 15, y Decreto 682 de 2014). No cotiza salud ni ARL en Colombia. El IBC va de 1 a 25 SMMLV.',
    tags: ['Solo pensión 16%', 'IBC mínimo 1 SMMLV'],
  },
  {
    valor: 'INDEPENDIENTE_VOLUNTARIO_ARL',
    titulo: 'Independiente Voluntario ARL',
    subtitulo: 'Salud, pensión y ARL voluntaria',
    icono: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    descripcion: 'Persona independiente que, además de salud y pensión, se afilia voluntariamente al sistema de riesgos laborales (ARL).',
    tags: ['Salud 12.5%', 'Pensión 16%', 'ARL según clase de riesgo'],
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
  imports: [CommonModule, FormsModule, RouterLink, CredencialesNuevasComponent],
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
          <ng-container *ngIf="tipoSeleccionado === 'INDEPENDIENTE'">
            <div class="pct-item">
              <span class="pct-label">Salud</span>
              <span class="pct-valor">12.5%</span>
            </div>
            <div class="pct-item" [class.pct-item--exonerado]="coberturaIndependiente === 'SOLO_SALUD'">
              <span class="pct-label">Pensión</span>
              <span class="pct-valor">{{ coberturaIndependiente === 'SOLO_SALUD' ? 'No cotiza' : '16%' }}</span>
            </div>
            <div class="pct-item">
              <span class="pct-label">Caja</span>
              <span class="pct-valor">{{ nivelCajaFraccion ? (nivelCajaFraccion * 100) + '%' : 'No cotiza' }}</span>
            </div>
          </ng-container>
          <ng-container *ngIf="tipoSeleccionado === 'INDEPENDIENTE_PARCIAL'">
            <div class="pct-item">
              <span class="pct-label">Pensión ({{ semanasParcial }} sem.)</span>
              <span class="pct-valor">16%</span>
            </div>
            <div class="pct-item pct-item--arl">
              <span class="pct-label">ARL (clase {{ form.claseRiesgoArl || '?' }}, sobre 1 SMMLV)</span>
              <span class="pct-valor">{{ form.porcentajeArl || '—' }}%</span>
            </div>
            <div class="pct-item">
              <span class="pct-label">Caja (opcional)</span>
              <span class="pct-valor">{{ nivelCajaFraccion ? (nivelCajaFraccion * 100) + '%' : 'No cotiza' }}</span>
            </div>
            <div class="pct-item pct-item--exonerado">
              <span class="pct-label">Salud (EPS)</span>
              <span class="pct-valor">No cotiza</span>
            </div>
          </ng-container>
          <ng-container *ngIf="tipoSeleccionado === 'INDEPENDIENTE_RESIDENTE_EXTERIOR'">
            <div class="pct-item">
              <span class="pct-label">Pensión</span>
              <span class="pct-valor">16%</span>
            </div>
            <div class="pct-item pct-item--exonerado">
              <span class="pct-label">Salud / ARL / Caja</span>
              <span class="pct-valor">No aplica</span>
            </div>
          </ng-container>
          <ng-container *ngIf="tipoSeleccionado === 'INDEPENDIENTE_VOLUNTARIO_ARL'">
            <div class="pct-item">
              <span class="pct-label">Salud</span>
              <span class="pct-valor">12.5%</span>
            </div>
            <div class="pct-item">
              <span class="pct-label">Pensión</span>
              <span class="pct-valor">16%</span>
            </div>
            <div class="pct-item pct-item--arl">
              <span class="pct-label">ARL (clase {{ form.claseRiesgoArl || '?' }})</span>
              <span class="pct-valor">{{ form.porcentajeArl || '—' }}%</span>
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

      <!-- Mensaje de error global - 2026-10-07 (bug real encontrado por
           Cristopher en vivo): el formulario tiene 5 secciones largas, y
           este mensaje solo aparecía acá arriba - al guardar desde la
           sección 4/5 el error quedaba fuera de la vista, parecía que
           "no pasó nada" hasta un segundo clic. Ahora hace scroll automático
           hacia sí mismo apenas aparece. -->
      <div *ngIf="errorGlobal" #errorGlobalRef class="alerta-error">
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
              <label class="campo-etiqueta">Tipo de documento <span class="requerido">*</span></label>
              <select class="campo-input" [(ngModel)]="form.tipoDocumento" name="tipoDocumento">
                <option *ngFor="let t of tiposDocumento" [value]="t.valor">{{ t.nombre }}</option>
              </select>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Número de documento <span class="requerido">*</span></label>
              <input type="text" class="campo-input" [class.campo-error]="errores.cedula"
                [(ngModel)]="form.cedula" name="cedula" placeholder="Número de documento"
                (blur)="validarCampo('cedula')">
              <span *ngIf="errores.cedula" class="mensaje-error">{{ errores.cedula }}</span>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Género <span class="requerido">*</span></label>
              <select class="campo-input" [class.campo-error]="errores.genero"
                [(ngModel)]="form.genero" name="genero" (blur)="validarCampo('genero')">
                <option value="">Seleccionar...</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="INDETERMINADO">Prefiere no decir / Indeterminado</option>
              </select>
              <span *ngIf="errores.genero" class="mensaje-error">{{ errores.genero }}</span>
              <span class="campo-ayuda">Para el saludo en correos (Sr./Sra.) - "Indeterminado" usa el nombre, sin título</span>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Correo electrónico</label>
              <input type="email" class="campo-input" [(ngModel)]="form.correo" name="correo"
                placeholder="correo@ejemplo.com" (blur)="validarCampo('confirmarCorreo')">
            </div>
            <div class="campo-grupo" *ngIf="form.correo">
              <label class="campo-etiqueta">Confirmar correo <span class="requerido">*</span></label>
              <input type="email" class="campo-input" [class.campo-error]="errores.confirmarCorreo"
                [(ngModel)]="form.confirmarCorreo" name="confirmarCorreo" placeholder="Repita el correo"
                (blur)="validarCampo('confirmarCorreo')">
              <span *ngIf="errores.confirmarCorreo" class="mensaje-error">{{ errores.confirmarCorreo }}</span>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Teléfono</label>
              <input type="tel" class="campo-input" [(ngModel)]="form.telefono" name="telefono" placeholder="Número de teléfono">
            </div>
            <div class="campo-grupo campo-grupo--ancho">
              <label class="campo-etiqueta">Fecha de nacimiento</label>
              <!-- 2026-10-07 (bug real reportado por Cristopher en vivo): el
                   calendario nativo (type="date") obliga a retroceder mes a
                   mes/año a año para llegar a una fecha de nacimiento real -
                   muy lento para gente adulta. 3 desplegables directos,
                   mismo patrón ya usado en otros formularios de este tipo. -->
              <div class="fecha-dmy">
                <select class="campo-input" [(ngModel)]="fechaNacDia" name="fechaNacDia" (ngModelChange)="actualizarFechaNacimiento()">
                  <option [ngValue]="null">Día</option>
                  <option *ngFor="let d of diasDelMes" [ngValue]="d">{{ d }}</option>
                </select>
                <select class="campo-input" [(ngModel)]="fechaNacMes" name="fechaNacMes" (ngModelChange)="actualizarFechaNacimiento()">
                  <option [ngValue]="null">Mes</option>
                  <option *ngFor="let m of meses" [ngValue]="m.valor">{{ m.nombre }}</option>
                </select>
                <select class="campo-input" [(ngModel)]="fechaNacAnio" name="fechaNacAnio" (ngModelChange)="actualizarFechaNacimiento()">
                  <option [ngValue]="null">Año</option>
                  <option *ngFor="let a of aniosNacimiento" [ngValue]="a">{{ a }}</option>
                </select>
              </div>
            </div>
          </div>

          <div class="campo-grupo campo-grupo--ancho" style="margin-top: var(--espacio-4);">
            <label class="campo-etiqueta">¿Cómo prefiere que le avisemos del vencimiento?</label>
            <div class="preferencias-notificacion">
              <label class="permiso-check">
                <input type="checkbox" [(ngModel)]="form.notificarCorreo" name="notificarCorreo"> Correo
              </label>
              <label class="permiso-check">
                <input type="checkbox" [(ngModel)]="form.notificarSms" name="notificarSms"> Mensaje de texto
              </label>
              <label class="permiso-check">
                <input type="checkbox" [(ngModel)]="form.notificarLlamada" name="notificarLlamada"> Llamada
              </label>
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
            <!-- 2026-10-08: Independiente (plantillas 1-4) - cobertura -->
            <ng-container *ngIf="tipoSeleccionado === 'INDEPENDIENTE'">
              <div class="campo-grupo">
                <label class="campo-etiqueta">Cobertura <span class="requerido">*</span></label>
                <select class="campo-input" [(ngModel)]="coberturaIndependiente" name="coberturaIndependiente" (change)="alCambiarCobertura()">
                  <option value="SALUD_PENSION">Salud y pensión</option>
                  <option value="SOLO_SALUD">Solo salud (pensionado o edad de pensión)</option>
                </select>
              </div>
              <div class="campo-grupo" *ngIf="coberturaIndependiente === 'SOLO_SALUD'">
                <label class="campo-etiqueta">Condición para solo salud</label>
                <label class="permiso-check">
                  <input type="checkbox" [(ngModel)]="esPensionado" name="esPensionado" (change)="resimular()"> Ya es pensionado
                </label>
                <span class="campo-ayuda" [class.mensaje-error]="!puedeSoloSalud">{{ mensajeSoloSalud }}</span>
              </div>
            </ng-container>

            <!-- 2026-10-08: Parcial - días trabajados en el mes → semanas (Decreto 2616/2013) -->
            <div class="campo-grupo" *ngIf="tipoSeleccionado === 'INDEPENDIENTE_PARCIAL'">
              <label class="campo-etiqueta">Días trabajados en el mes <span class="requerido">*</span></label>
              <input type="number" class="campo-input" [(ngModel)]="diasCotizadosParcial" name="diasCotizadosParcial"
                min="1" max="30" (ngModelChange)="resimular()">
              <span class="campo-ayuda">Cotiza {{ semanasParcial }} semana{{ semanasParcial > 1 ? 's' : '' }} (1-7 días = 1 · 8-14 = 2 · 15-21 = 3 · más de 21 = 4)</span>
            </div>

            <!-- Clase de riesgo ARL -->
            <div class="campo-grupo" *ngIf="usaArl">
              <label class="campo-etiqueta">Clase de riesgo ARL <span class="requerido">*</span></label>
              <select class="campo-input" [(ngModel)]="form.claseRiesgoArl" name="claseRiesgoArl" (change)="actualizarArl()">
                <option value="">Seleccionar clase...</option>
                <option value="I">Clase I, Mínimo (0.522%)</option>
                <option value="II">Clase II, Bajo (1.044%)</option>
                <option value="III">Clase III, Medio (2.436%)</option>
                <option value="IV">Clase IV, Alto (4.350%)</option>
                <option value="V">Clase V, Máximo (6.960%)</option>
              </select>
            </div>

            <div class="campo-grupo" *ngIf="usaArl">
              <label class="campo-etiqueta">ARL (%)</label>
              <input type="number" class="campo-input campo-input--readonly" [(ngModel)]="form.porcentajeArl"
                name="porcentajeArl" placeholder="—" min="0" max="100" step="0.001" readonly>
            </div>

            <!-- Nivel de Caja de Compensación - solo independientes (empresa ya trae su propio % fijo).
                 2026-10-07: antes no existía este selector - el nivel quedaba fijo en 0% sin que
                 nadie lo eligiera, pese a que las 3 variantes (0%/0.6%/2%) son reales en las
                 plantillas (verificado por SQL directo). -->
            <div class="campo-grupo" *ngIf="usaCajaIndependiente">
              <label class="campo-etiqueta">Caja de Compensación <span class="requerido">*</span></label>
              <select class="campo-input" [(ngModel)]="nivelCajaFraccion" name="nivelCajaFraccion" (change)="alCambiarCaja()">
                <option [ngValue]="0">No cotiza (0%)</option>
                <option [ngValue]="0.006">0.6%{{ esParcial ? ' (sin contrato)' : '' }}</option>
                <option [ngValue]="0.02">2%{{ esParcial ? ' (sin contrato)' : '' }}</option>
                <option *ngIf="esParcial" [ngValue]="0.04">4% (con contrato · Decreto 2616)</option>
              </select>
            </div>

            <ng-container>
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
              <label class="campo-etiqueta">Base de cotización - IBC</label>
              <input type="number" class="campo-input" [class.campo-input--readonly]="esParcial" [(ngModel)]="form.valor" name="valor"
                placeholder="0" min="0" [readonly]="esParcial" (ngModelChange)="alCambiarValorOComision()">
              <span class="campo-ayuda" *ngIf="!esParcial">Sobre este valor se calculan los aportes reales (salud/pensión/ARL/caja).</span>
              <span class="campo-ayuda" *ngIf="esParcial">Se calcula solo: semanas × (SMMLV / 4). La ARL va sobre 1 SMMLV completo.</span>
              <span class="campo-ayuda" *ngIf="tipoSeleccionado === 'INDEPENDIENTE_RESIDENTE_EXTERIOR'">Mínimo 1 SMMLV y máximo 25 SMMLV.</span>
            </div>
            <!-- 2026-10-08: mes comercial de 30 días; si entra a mitad de mes
                 solo cotiza los días que faltan (ej. el 28 → 3 días). -->
            <div class="campo-grupo" *ngIf="!esParcial">
              <label class="campo-etiqueta">Días a cotizar el primer mes</label>
              <input type="number" class="campo-input" [(ngModel)]="diasPrimerMes" name="diasPrimerMes"
                min="1" max="30" (ngModelChange)="alCambiarDiasManual()">
              <span class="campo-ayuda">Se calcula con la fecha de ingreso (mes de 30 días). Desde el mes siguiente paga los 30.</span>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Valor afiliación (cobro único)</label>
              <input type="number" class="campo-input" [(ngModel)]="valorAfiliacion" name="valorAfiliacion"
                placeholder="0" min="0" (ngModelChange)="resimular()">
              <span class="campo-ayuda">Aparte de la administración de Anturi. Se cobra solo en el primer pago.</span>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Comisión Anturi{{ resultadoSimulacion ? ' (calculada)' : '' }}</label>
              <input type="number" class="campo-input" [class.campo-input--readonly]="!!resultadoSimulacion"
                [(ngModel)]="form.comision" name="comision"
                placeholder="0" min="0" [readonly]="!!resultadoSimulacion" (ngModelChange)="calcularTotal()">
              <span class="campo-ayuda" *ngIf="resultadoSimulacion">Ya viene incluida en el total - la calcula el motor real, no se suma aparte.</span>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Primer pago</label>
              <input type="number" class="campo-input campo-input--readonly campo-input--destacado" [value]="totalPrimerPago" readonly>
              <span class="campo-ayuda" *ngIf="resultadoSimulacion">Días del primer mes + afiliación + administración, todo incluido.</span>
              <span class="campo-ayuda" *ngIf="!resultadoSimulacion && !simulando && puedeSimular">{{ ayudaSimulacion }}</span>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Total mensual (desde el mes siguiente)</label>
              <input type="number" class="campo-input campo-input--readonly" [value]="totalPago" readonly>
              <span class="campo-ayuda" *ngIf="resultadoSimulacion">Mes completo de 30 días, sin afiliación. Es el valor de los cobros de cada mes.</span>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">4 x Mil</label>
              <input type="number" class="campo-input" [class.campo-input--readonly]="!!resultadoMensual" [readonly]="!!resultadoMensual"
                [(ngModel)]="form.cuatroXMil" name="cuatroXMil" placeholder="0" min="0">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta">Cesantías</label>
              <input type="number" class="campo-input" [(ngModel)]="form.cesantias" name="cesantias" placeholder="0" min="0">
            </div>
          </div>

          <!-- Desglose real del motor K→Q - "¿por qué este valor dio así?" -->
          <div *ngIf="simulando" class="simulacion-cargando">
            <span class="spinner-inline"></span> Calculando con el motor real...
          </div>
          <div *ngIf="errorSimulacion" class="alerta-error" style="margin-top: var(--espacio-3);">{{ errorSimulacion }}</div>
          <div *ngIf="resultadoSimulacion && !simulando" class="desglose-simulacion">
            <h4 class="desglose-titulo">Desglose del primer pago{{ resultadoSimulacion.diasCotizados && resultadoSimulacion.diasCotizados < 30 ? ' (' + resultadoSimulacion.diasCotizados + ' días)' : '' }}</h4>
            <table class="tabla-desglose">
              <thead>
                <tr><th>Concepto</th><th>Base</th><th>Tarifa</th><th>Valor</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let linea of resultadoSimulacion.lineas">
                  <td>{{ linea.concepto }}</td>
                  <td>{{ linea.base | number }}</td>
                  <td>{{ linea.tarifa * 100 | number:'1.0-3' }}%</td>
                  <td>{{ linea.valor | number }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr><td colspan="3">Seguridad social + mora</td><td>{{ resultadoSimulacion.totalValorSeguridadSocial | number }}</td></tr>
                <tr><td colspan="3">4x1000</td><td>{{ resultadoSimulacion.valorCuatroXMil | number }}</td></tr>
                <tr><td colspan="3">Administración Anturi</td><td>{{ resultadoSimulacion.valorAdministracion | number }}</td></tr>
                <tr *ngIf="resultadoSimulacion.valorAfiliacion"><td colspan="3">Afiliación (cobro único)</td><td>{{ resultadoSimulacion.valorAfiliacion | number }}</td></tr>
                <tr class="fila-total"><td colspan="3">Primer pago (todo incluido)</td><td>{{ resultadoSimulacion.totalAPagar | number }}</td></tr>
                <tr *ngIf="resultadoMensual && resultadoMensual.totalAPagar !== resultadoSimulacion.totalAPagar"><td colspan="3">Total mensual desde el mes siguiente (30 días)</td><td>{{ resultadoMensual.totalAPagar | number }}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- 2026-10-08: usuarios y claves de portales (opcional) -->
        <div class="tarjeta seccion-form">
          <h3 class="seccion-titulo">Usuarios y claves de portales</h3>
          <anturi-credenciales-nuevas [(lista)]="credencialesNuevas"></anturi-credenciales-nuevas>
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
            <div class="campo-grupo campo-grupo--ancho">
              <label class="campo-etiqueta">Fecha de ingreso</label>
              <div class="fecha-dmy">
                <select class="campo-input" [(ngModel)]="fechaIngDia" name="fechaIngDia" (ngModelChange)="actualizarFechaIngreso()">
                  <option [ngValue]="null">Día</option>
                  <option *ngFor="let d of diasDelMes" [ngValue]="d">{{ d }}</option>
                </select>
                <select class="campo-input" [(ngModel)]="fechaIngMes" name="fechaIngMes" (ngModelChange)="actualizarFechaIngreso()">
                  <option [ngValue]="null">Mes</option>
                  <option *ngFor="let m of meses" [ngValue]="m.valor">{{ m.nombre }}</option>
                </select>
                <select class="campo-input" [(ngModel)]="fechaIngAnio" name="fechaIngAnio" (ngModelChange)="actualizarFechaIngreso()">
                  <option [ngValue]="null">Año</option>
                  <option *ngFor="let a of aniosIngreso" [ngValue]="a">{{ a }}</option>
                </select>
              </div>
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
    .fecha-dmy { display: grid; grid-template-columns: 1fr 1.6fr 1fr; gap: var(--espacio-2); max-width: 420px; }

    .campo-input--readonly { background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.04)); cursor: not-allowed; color: var(--texto-secundario); }

    .campo-error { border-color: var(--color-error) !important; }
    .mensaje-error { font-size: var(--tamano-sm); color: var(--color-error); }
    .requerido { color: var(--color-error); }
    .campo-ayuda { font-size: var(--tamano-sm); color: var(--texto-terciario); }
    .preferencias-notificacion { display: flex; gap: var(--espacio-5); flex-wrap: wrap; margin-top: var(--espacio-2); }
    .permiso-check { display: flex; align-items: center; gap: var(--espacio-2); font-size: var(--tamano-sm); color: var(--texto-principal); cursor: pointer; }

    .alerta-error { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radio-md); color: var(--color-error); font-size: var(--tamano-sm); }

    .form-acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); padding: var(--espacio-2) 0; }

    .placeholder-form { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-3); padding: var(--espacio-10); color: var(--texto-terciario); text-align: center; }
    .placeholder-form svg { opacity: 0.35; }

    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }
    @keyframes girar { to { transform: rotate(360deg); } }

    .campo-input--destacado { font-weight: 700; color: var(--color-primario); }
    .simulacion-cargando { display: flex; align-items: center; gap: var(--espacio-2); margin-top: var(--espacio-4); color: var(--texto-terciario); font-size: var(--tamano-sm); }
    .simulacion-cargando .spinner-inline { border: 2px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); margin-right: 0; }

    .desglose-simulacion { margin-top: var(--espacio-5); padding-top: var(--espacio-4); border-top: 1px solid var(--borde-color); }
    .desglose-titulo { font-size: var(--tamano-sm); font-weight: 600; margin: 0 0 var(--espacio-3); color: var(--texto-secundario); }
    .tabla-desglose { width: 100%; border-collapse: collapse; font-size: var(--tamano-sm); }
    .tabla-desglose th { text-align: left; padding: var(--espacio-2) var(--espacio-3); font-weight: 600; color: var(--texto-terciario); border-bottom: 1px solid var(--borde-color); }
    .tabla-desglose td { padding: var(--espacio-2) var(--espacio-3); border-bottom: 1px solid rgba(0,0,0,0.04); }
    .tabla-desglose th:not(:first-child), .tabla-desglose td:not(:first-child) { text-align: right; }
    .tabla-desglose tfoot td { border-bottom: none; color: var(--texto-secundario); }
    .tabla-desglose .fila-total td { font-weight: 700; color: var(--texto-principal); font-size: var(--tamano-base); border-top: 1.5px solid var(--borde-color); padding-top: var(--espacio-3); }
  `]
})
export class FormularioAfiliadoComponent implements OnInit, OnDestroy {
  readonly tipos = TIPOS;
  readonly tiposDocumento = TIPOS_DOCUMENTO;

  tipoSeleccionado: TipoAfiliacion | null = null;

  // ── Motor de liquidación real (K→Q), conectado 2026-10-07 ──────────────
  // Antes "Total pago" era literalmente valor+comisión tecleados a mano -
  // ver AUDITORIA-CONECTIVIDAD-FRONTEND-BACKEND-2026-10-06.md. Ahora
  // "Valor base" se usa como IBC real para el motor, que calcula línea por
  // línea con las mismas reglas que el Excel - comisión de Anturi se suma
  // aparte, nunca se mezcla con los aportes de seguridad social.
  plantillas: PlantillaLiquidacion[] = [];
  nivelCajaFraccion = 0; // 0 | 0.006 | 0.02 - fracción real de plantillas_liquidacion, no %
  // 2026-10-08 - modalidades nuevas de independiente
  coberturaIndependiente: 'SALUD_PENSION' | 'SOLO_SALUD' = 'SALUD_PENSION';
  esPensionado = false;
  diasCotizadosParcial = 30;
  resultadoSimulacion: ResultadoMotorLiquidacion | null = null; // primer pago (días + afiliación)
  resultadoMensual: ResultadoMotorLiquidacion | null = null;    // mes completo, sin afiliación → totalPago
  // 2026-10-08 (Cristopher): mes de 30 días, días proporcionales al ingreso y
  // afiliación de cobro único, aparte de la administración de Anturi.
  diasPrimerMes = 30;
  private diasEditadosAMano = false;
  valorAfiliacion: number | null = null;
  totalPrimerPago = 0;
  credencialesNuevas: NuevaCredencial[] = [];
  simulando = false;
  errorSimulacion = '';
  private simular$ = new Subject<void>();
  private destruir$ = new Subject<void>();

  form: Omit<CrearAfiliadoDto, 'genero'> & { genero: GeneroAfiliado | ''; confirmarCorreo?: string; caja?: string; cesantias?: number; cuatroXMil?: number } = {
    nombres: '',
    apellidos: '',
    tipoDocumento: 'CC',
    cedula: '',
    genero: '',
    correo: '',
    confirmarCorreo: '',
    notificarCorreo: true,
    notificarSms: false,
    notificarLlamada: false,
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

  @ViewChild('errorGlobalRef') errorGlobalRef?: ElementRef<HTMLElement>;

  // Fecha de nacimiento por 3 desplegables (ver nota arriba en el template)
  fechaNacDia: number | null = null;
  fechaNacMes: number | null = null;
  fechaNacAnio: number | null = null;
  readonly diasDelMes = Array.from({ length: 31 }, (_, i) => i + 1);
  readonly meses = [
    { valor: 1, nombre: 'Enero' }, { valor: 2, nombre: 'Febrero' }, { valor: 3, nombre: 'Marzo' },
    { valor: 4, nombre: 'Abril' }, { valor: 5, nombre: 'Mayo' }, { valor: 6, nombre: 'Junio' },
    { valor: 7, nombre: 'Julio' }, { valor: 8, nombre: 'Agosto' }, { valor: 9, nombre: 'Septiembre' },
    { valor: 10, nombre: 'Octubre' }, { valor: 11, nombre: 'Noviembre' }, { valor: 12, nombre: 'Diciembre' },
  ];
  // Más reciente primero - quien se afilia casi siempre es adulto, no bebé.
  readonly aniosNacimiento = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 16 - i);

  // Fecha de ingreso, mismo patrón - puede ser de años atrás (afiliado
  // viejo que se está registrando ahora) o de hoy (lo normal).
  fechaIngDia: number | null = null;
  fechaIngMes: number | null = null;
  fechaIngAnio: number | null = null;
  readonly aniosIngreso = Array.from({ length: 40 }, (_, i) => new Date().getFullYear() - i);

  errores: ErroresCampo = {};
  errorGlobal = '';
  guardando = false;
  totalPago = 0;

  // 2026-10-07 (aclarado por Cristopher): calcular/registrar cuánto paga
  // una persona SÍ es trabajo de Secretaria - lo que sigue siendo exclusivo
  // de ADMIN/SUPER_ADMIN es cambiar las TASAS/PORCENTAJES legales en sí
  // (ParametrosLegales, módulo aparte). El control fino real (permiso
  // granular puedeCalcularLiquidacion, por cuenta) vive en el backend -
  // acá solo se filtra por rol para no mostrar la UI a quien ni siquiera
  // puede crear/editar afiliados; si una Secretaria puntual no tiene el
  // permiso, el backend responde 403 y se muestra un mensaje claro.
  puedeSimular = false;

  constructor(
    private afiliadosServicio: AfiliadosServicio,
    private motorServicio: MotorLiquidacionServicio,
    private credencialesServicio: CredencialesServicio,
    private auth: AutenticacionServicio,
    private router: Router
  ) {
    this.puedeSimular = this.auth.tieneRol(['SECRETARIA', 'ADMIN', 'SUPER_ADMIN']);
  }

  private get prefijo(): string {
    return this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
  }

  ngOnInit(): void {
    const hoy = new Date();
    this.fechaIngDia = hoy.getDate();
    this.fechaIngMes = hoy.getMonth() + 1;
    this.fechaIngAnio = hoy.getFullYear();
    this.actualizarFechaIngreso();

    if (this.puedeSimular) {
      this.motorServicio.listarPlantillas().subscribe({
        next: (lista) => { this.plantillas = lista; },
        error: () => { /* el formulario sigue siendo usable sin simulación en vivo */ },
      });

      this.simular$.pipe(
        debounceTime(500),
        takeUntil(this.destruir$),
      ).subscribe(() => this.ejecutarSimulacion());
    }
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  resimular(): void {
    this.simular$.next();
  }

  get esParcial(): boolean {
    return this.tipoSeleccionado === 'INDEPENDIENTE_PARCIAL';
  }

  // Independiente (plantillas 1-4) y Residente exterior no cotizan ARL.
  get usaArl(): boolean {
    return this.tipoSeleccionado !== 'INDEPENDIENTE' && this.tipoSeleccionado !== 'INDEPENDIENTE_RESIDENTE_EXTERIOR';
  }

  // "Solo salud" no tiene variante con caja en las plantillas (tipo 1).
  get usaCajaIndependiente(): boolean {
    if (this.tipoSeleccionado === 'INDEPENDIENTE') return this.coberturaIndependiente === 'SALUD_PENSION';
    return this.tipoSeleccionado === 'INDEPENDIENTE_VOLUNTARIO_ARL'
      || this.tipoSeleccionado === 'INDEPENDIENTE_CONTRATISTA'
      || this.tipoSeleccionado === 'INDEPENDIENTE_PARCIAL';
  }

  // Decreto 2616/2013 art. 5.
  get semanasParcial(): number {
    const dias = Number(this.diasCotizadosParcial) || 0;
    if (dias <= 7) return 1;
    if (dias <= 14) return 2;
    if (dias <= 21) return 3;
    return 4;
  }

  get edadAfiliado(): number | null {
    if (!this.form.fechaNacimiento) return null;
    const nac = new Date(this.form.fechaNacimiento + 'T00:00:00');
    const hoy = new Date();
    let edad = hoy.getFullYear() - nac.getFullYear();
    if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
    return edad;
  }

  // Solo salud: pensionado, o mujer desde 57 / hombre desde 62 años.
  get puedeSoloSalud(): boolean {
    if (this.esPensionado) return true;
    const edad = this.edadAfiliado;
    if (edad === null) return false;
    return (this.form.genero === 'F' && edad >= 57) || (this.form.genero === 'M' && edad >= 62);
  }

  get mensajeSoloSalud(): string {
    if (this.esPensionado) return 'Pensionado: puede cotizar solo salud.';
    const edad = this.edadAfiliado;
    if (edad === null || (this.form.genero !== 'F' && this.form.genero !== 'M')) {
      return 'Si no es pensionado, ingrese fecha de nacimiento y género (mujer 57+ / hombre 62+).';
    }
    return this.puedeSoloSalud
      ? `Tiene ${edad} años: cumple la edad para cotizar solo salud.`
      : `Tiene ${edad} años: no cumple la edad (mujer 57+ / hombre 62+). Debe cotizar salud y pensión.`;
  }

  get ayudaSimulacion(): string {
    switch (this.tipoSeleccionado) {
      case 'INDEPENDIENTE': return 'Complete la cobertura, la caja y la base de cotización para ver el cálculo real.';
      case 'INDEPENDIENTE_RESIDENTE_EXTERIOR': return 'Complete la base de cotización para ver el cálculo real.';
      case 'INDEPENDIENTE_PARCIAL': return 'Complete los días trabajados, la clase de riesgo y la caja para ver el cálculo real.';
      case 'INDEPENDIENTE_VOLUNTARIO_ARL':
      case 'INDEPENDIENTE_CONTRATISTA': return 'Complete la clase de riesgo, la caja y la base de cotización para ver el cálculo real.';
      default: return 'Complete la clase de riesgo y la base de cotización para ver el cálculo real.';
    }
  }

  alCambiarCobertura(): void {
    if (this.coberturaIndependiente === 'SOLO_SALUD') {
      this.form.porcentajePension = undefined;
      this.nivelCajaFraccion = 0;
      this.form.porcentajeCaja = undefined;
    } else {
      this.form.porcentajePension = 16;
    }
    this.simular$.next();
  }

  alCambiarCaja(): void {
    // form.porcentajeCaja se guarda en el Afiliado en escala de porcentaje
    // (0.6 = "0.6%"), igual que el resto del formulario - nivelCajaFraccion
    // es la fracción real de plantillas_liquidacion (0.006) que se usa para
    // buscar la plantilla correcta.
    this.form.porcentajeCaja = this.nivelCajaFraccion * 100 || undefined;
    this.simular$.next();
  }

  // Busca la fila real de plantillas_liquidacion que corresponde a este tipo
  // + clase de riesgo ARL + nivel de caja elegidos - nunca se adivina un id,
  // se busca contra el catálogo real (mismo que ya usa el motor viejo).
  private buscarTipoPlantilla(): number | null {
    if (this.tipoSeleccionado === 'INDEPENDIENTE') {
      const soloSalud = this.coberturaIndependiente === 'SOLO_SALUD';
      const fila = this.plantillas.find((p) =>
        p.activa &&
        p.libro.startsWith('1.') &&
        p.claseRiesgo === 0 &&
        (soloSalud ? p.porcentajePension === 0 : p.porcentajePension > 0) &&
        Math.abs(p.porcentajeCaja - (soloSalud ? 0 : this.nivelCajaFraccion)) < 0.0001,
      );
      return fila ? fila.tipo : null;
    }
    if (this.tipoSeleccionado === 'INDEPENDIENTE_RESIDENTE_EXTERIOR') {
      const fila = this.plantillas.find((p) => p.activa && p.libro.includes('Exterior'));
      return fila ? fila.tipo : null;
    }
    if (!this.tipoSeleccionado || !this.form.claseRiesgoArl) return null;
    const claseNum = { I: 1, II: 2, III: 3, IV: 4, V: 5 }[this.form.claseRiesgoArl];
    const textoLibro = this.tipoSeleccionado === 'INDEPENDIENTE_VOLUNTARIO_ARL' ? 'Voluntario' : 'Contrato';
    const fila = this.plantillas.find((p) =>
      p.activa &&
      p.libro.includes(textoLibro) &&
      p.claseRiesgo === claseNum &&
      Math.abs(p.porcentajeCaja - this.nivelCajaFraccion) < 0.0001,
    );
    return fila ? fila.tipo : null;
  }

  // Dispara una simulación real contra el motor K→Q - no reemplaza "Guardar
  // afiliado" (eso sigue creando el Afiliado tal cual), solo muestra en vivo
  // cuánto daría de pagar con los datos actuales, igual que pedía Cristopher.
  private ejecutarSimulacion(): void {
    this.errorSimulacion = '';
    const afiliacion = Math.max(0, Number(this.valorAfiliacion) || 0);
    let llamar: ((primerPago: boolean) => Observable<ResultadoMotorLiquidacion>) | null = null;

    // Parcial: la base no se teclea, sale de los días → semanas (el motor
    // la devuelve en `ibc` y se copia a "Base de cotización").
    if (this.esParcial) {
      const dias = Number(this.diasCotizadosParcial);
      if (this.form.claseRiesgoArl && Number.isInteger(dias) && dias >= 1 && dias <= 30) {
        const codigoCaja = this.nivelCajaFraccion === 0.006 ? 'CAJA_06'
          : this.nivelCajaFraccion === 0.02 ? 'CAJA_2'
          : this.nivelCajaFraccion === 0.04 ? 'CAJA_EMPRESA'
          : undefined;
        const clase = this.form.claseRiesgoArl;
        llamar = (primerPago) => this.motorServicio.simularParcial({
          diasCotizados: dias, claseRiesgoArl: clase, codigoCaja,
          ...(primerPago && afiliacion > 0 ? { valorAfiliacion: afiliacion } : {}),
        });
      }
    } else {
      const ibc = Number(this.form.valor) || 0;
      const dias = Number(this.diasPrimerMes);
      const diasValidos = Number.isInteger(dias) && dias >= 1 && dias <= 30;
      const opciones = (primerPago: boolean) => primerPago
        ? { ...(diasValidos && dias < 30 ? { diasCotizados: dias } : {}), ...(afiliacion > 0 ? { valorAfiliacion: afiliacion } : {}) }
        : {};

      if (this.tipoSeleccionado && ibc > 0 && diasValidos) {
        if (this.tipoSeleccionado === 'EMPRESA_EXONERADA' || this.tipoSeleccionado === 'EMPRESA_NO_EXONERADA') {
          if (this.form.claseRiesgoArl) {
            const modalidad = this.tipoSeleccionado;
            const clase = this.form.claseRiesgoArl;
            llamar = (primerPago) => this.motorServicio.simularEmpleador({ modalidad, ibc, claseRiesgoArl: clase, ...opciones(primerPago) });
          }
        } else {
          // Independiente (plantillas 1-4 / Residente exterior / Voluntario ARL / Contratista)
          const tipoPlantilla = this.buscarTipoPlantilla();
          if (tipoPlantilla) {
            llamar = (primerPago) => this.motorServicio.simularIndependiente({ tipoPlantilla, ibc, ...opciones(primerPago) });
          }
        }
      }
    }

    if (!llamar) {
      this.resultadoSimulacion = null;
      this.resultadoMensual = null;
      this.calcularTotal();
      return;
    }

    this.simulando = true;
    forkJoin({ primer: llamar(true), mensual: llamar(false) }).subscribe({
      next: ({ primer, mensual }) => {
        this.resultadoSimulacion = primer;
        this.resultadoMensual = mensual;
        if (this.esParcial) this.form.valor = mensual.ibc;
        this.simulando = false;
        this.calcularTotal();
      },
      error: (err) => {
        this.simulando = false;
        this.resultadoSimulacion = null;
        this.resultadoMensual = null;
        this.errorSimulacion = this.mensajeErrorSimulacion(err);
        this.calcularTotal();
      },
    });
  }

  // Días del primer mes a partir de la fecha de ingreso, en mes comercial de
  // 30 días: si entra este mes (o uno futuro) el día D, cotiza 31 - D (el 28
  // → 3 días; el 31 cuenta como 30 → 1 día). Si ya venía de meses
  // anteriores, mes completo.
  private calcularDiasPrimerMes(): number {
    if (!this.form.fechaIngreso) return 30;
    const f = new Date(this.form.fechaIngreso + 'T00:00:00');
    if (isNaN(f.getTime())) return 30;
    const hoy = new Date();
    const mesIngreso = f.getFullYear() * 12 + f.getMonth();
    const mesActual = hoy.getFullYear() * 12 + hoy.getMonth();
    if (mesIngreso < mesActual) return 30;
    return 31 - Math.min(f.getDate(), 30);
  }

  alCambiarDiasManual(): void {
    this.diasEditadosAMano = true;
    this.simular$.next();
  }

  // Distingue "no tenés el permiso" (403 real del backend, cuenta puntual
  // sin puedeCalcularLiquidacion) de cualquier otro error - mensaje
  // orientado a qué hacer, no un error técnico crudo.
  private mensajeErrorSimulacion(err: any): string {
    if (err?.status === 403) {
      return 'Tu cuenta no tiene el permiso para calcular liquidaciones - pedile a un Admin/Super Admin que lo active desde "Gestionar permisos".';
    }
    return err?.error?.message || 'No se pudo simular el cálculo real.';
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
    this.coberturaIndependiente = 'SALUD_PENSION';
    this.esPensionado = false;
    // 4% (con contrato) solo existe en Parcial - en las plantillas no hay esa variante.
    if (!this.usaCajaIndependiente || (!this.esParcial && this.nivelCajaFraccion === 0.04)) this.nivelCajaFraccion = 0;
    if (this.usaCajaIndependiente) this.form.porcentajeCaja = this.nivelCajaFraccion * 100 || undefined;
    if (!this.usaArl) {
      this.form.claseRiesgoArl = undefined;
      this.form.porcentajeArl = undefined;
    }
    // Mantener ARL si ya se había seleccionado clase de riesgo
    if (this.form.claseRiesgoArl) this.actualizarArl();
    this.resultadoSimulacion = null;
    this.simular$.next();
  }

  actualizarArl(): void {
    if (this.form.claseRiesgoArl) {
      this.form.porcentajeArl = ARL_POR_CLASE[this.form.claseRiesgoArl];
    }
    this.simular$.next();
  }

  etiquetaTipo(tipo: TipoAfiliacion): string {
    return TIPOS.find(t => t.valor === tipo)?.titulo ?? tipo;
  }

  descripcionTipo(tipo: TipoAfiliacion): string {
    return TIPOS.find(t => t.valor === tipo)?.descripcion ?? '';
  }

  // 2026-10-07 - BUG REAL encontrado por Cristopher en vivo y corregido:
  // `resultadoSimulacion.totalAPagar` YA INCLUYE la "Administración Anturi"
  // (parámetro COMISION_INDEPENDIENTE/COMISION_EMPRESA, $32.000 fijo hoy -
  // confirmado por SQL directo) - el motor la suma él mismo dentro de Q.
  // La primera versión de este código SUMABA el campo "Comisión" (manual)
  // OTRA VEZ encima de totalAPagar → doble conteo real de la comisión, y
  // la tabla de desglose decía (mal) "sin comisión Anturi" cuando sí la
  // traía. Ahora: si hay simulación real, el campo "Comisión" se autollena
  // desde el propio motor (valorAdministracion) en vez de sumarse aparte -
  // sigue siendo editable por si algún día hay que ajustarlo a mano, pero
  // ya no se duplica.
  calcularTotal(): void {
    if (this.resultadoSimulacion && this.resultadoMensual) {
      this.form.comision = this.resultadoMensual.valorAdministracion;
      // Lo que se guarda en el afiliado (y usan los cobros de cada mes) es el
      // mes completo SIN afiliación - el primer pago se muestra aparte.
      this.totalPago = this.resultadoMensual.totalAPagar;
      this.totalPrimerPago = this.resultadoSimulacion.totalAPagar;
      this.form.cuatroXMil = this.resultadoMensual.valorCuatroXMil;
    } else {
      const valor = Number(this.form.valor) || 0;
      const comision = Number(this.form.comision) || 0;
      this.totalPago = valor + comision;
      this.totalPrimerPago = this.totalPago + Math.max(0, Number(this.valorAfiliacion) || 0);
    }
    this.form.totalPago = this.totalPago;
  }

  alCambiarValorOComision(): void {
    this.simular$.next();
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
        this.errores.cedula = this.form.cedula?.trim() ? '' : 'El número de documento es requerido';
        break;
      case 'genero':
        this.errores.genero = this.form.genero ? '' : 'El género es requerido';
        break;
      case 'confirmarCorreo':
        // Sin correo cargado, no hay nada que confirmar.
        if (!this.form.correo) { this.errores.confirmarCorreo = ''; break; }
        this.errores.confirmarCorreo = this.form.correo === this.form.confirmarCorreo
          ? '' : 'Los correos no coinciden';
        break;
    }
  }

  validarTodo(): boolean {
    this.errorGlobal = '';
    if (!this.tipoSeleccionado) {
      this.errorGlobal = 'Seleccione un tipo de afiliación para continuar.';
      return false;
    }
    this.validarCampo('nombres');
    this.validarCampo('apellidos');
    this.validarCampo('cedula');
    this.validarCampo('genero');
    this.validarCampo('confirmarCorreo');
    if (this.tipoSeleccionado === 'INDEPENDIENTE' && this.coberturaIndependiente === 'SOLO_SALUD' && !this.puedeSoloSalud) {
      this.errorGlobal = 'Solo salud aplica únicamente a pensionados, o a mujeres desde 57 años y hombres desde 62 (sección 3).';
      return false;
    }
    if (this.esParcial) {
      const dias = Number(this.diasCotizadosParcial);
      if (!Number.isInteger(dias) || dias < 1 || dias > 30 || !this.form.claseRiesgoArl) {
        this.errorGlobal = 'Independiente parcial: indique los días trabajados (de 1 a 30) y la clase de riesgo ARL, que es obligatoria (sección 3).';
        return false;
      }
    }
    return !this.errores.nombres && !this.errores.apellidos && !this.errores.cedula
      && !this.errores.genero && !this.errores.confirmarCorreo;
  }

  // 2026-10-07 - bug real encontrado por Cristopher en vivo: si faltaba un
  // campo obligatorio (ej. género) en la sección 1, al hacer clic en
  // "Guardar" desde más abajo (sección 4/5) no pasaba NADA visible en su
  // pantalla - los errores de campo son inline, arriba, fuera de la vista.
  // Parecía que el botón no hacía nada hasta un segundo clic.
  guardar(): void {
    if (!this.validarTodo()) {
      this.mostrarErrorGlobal(this.errorGlobal || 'Revise los campos obligatorios marcados en rojo (sección 1).');
      return;
    }

    this.guardando = true;
    this.errorGlobal = '';

    const dto: CrearAfiliadoDto = {
      nombres: this.form.nombres.trim(),
      apellidos: this.form.apellidos.trim(),
      tipoDocumento: this.form.tipoDocumento || 'CC',
      cedula: this.form.cedula.trim(),
      genero: this.form.genero as GeneroAfiliado, // ya validado en validarTodo()
      correo: this.form.correo || undefined,
      notificarCorreo: this.form.notificarCorreo,
      notificarSms: this.form.notificarSms,
      notificarLlamada: this.form.notificarLlamada,
      telefono: this.form.telefono || undefined,
      fechaNacimiento: this.form.fechaNacimiento || undefined,
      cargo: this.form.cargo || undefined,
      claseAportante: this.form.claseAportante || undefined,
      asopagos: this.form.asopagos || undefined,
      diasPago: this.esParcial ? (Number(this.diasCotizadosParcial) || undefined) : (Number(this.diasPrimerMes) || undefined),
      valorAfiliacion: Number(this.valorAfiliacion) > 0 ? Number(this.valorAfiliacion) : undefined,
      tipoAfiliacion: this.form.tipoAfiliacion,
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
      // 2026-10-08: el campo "Base de cotización" es el IBC; `valor` guarda
      // el valor mensual de la seguridad social (mismo sentido que en el
      // Excel: ej. 499.100 = salud + pensión sobre el mínimo).
      ibc: this.esParcial ? undefined : (Number(this.form.valor) || undefined),
      valor: this.resultadoMensual ? this.resultadoMensual.valorSeguridadSocial : undefined,
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
        const ir = () => { this.guardando = false; this.router.navigate([this.prefijo, 'afiliados', afiliado.id]); };
        const validas = credencialesValidas(this.credencialesNuevas);
        if (validas.length === 0) { ir(); return; }
        // El afiliado ya quedó creado: si alguna clave falla, se agrega después en su ficha.
        forkJoin(validas.map((c) => this.credencialesServicio.crear('AFILIADO', afiliado.id, c).pipe(catchError(() => of(null))))).subscribe(ir);
      },
      error: (err) => {
        this.guardando = false;
        this.mostrarErrorGlobal(err?.error?.message || 'Error al crear el afiliado. Verifique los datos e intente nuevamente.');
      }
    });
  }

  volver(): void {
    this.router.navigate([this.prefijo, 'afiliados']);
  }

  actualizarFechaNacimiento(): void {
    if (this.fechaNacDia && this.fechaNacMes && this.fechaNacAnio) {
      const dd = String(this.fechaNacDia).padStart(2, '0');
      const mm = String(this.fechaNacMes).padStart(2, '0');
      this.form.fechaNacimiento = `${this.fechaNacAnio}-${mm}-${dd}`;
    } else {
      this.form.fechaNacimiento = '';
    }
  }

  actualizarFechaIngreso(): void {
    if (this.fechaIngDia && this.fechaIngMes && this.fechaIngAnio) {
      const dd = String(this.fechaIngDia).padStart(2, '0');
      const mm = String(this.fechaIngMes).padStart(2, '0');
      this.form.fechaIngreso = `${this.fechaIngAnio}-${mm}-${dd}`;
    } else {
      this.form.fechaIngreso = '';
    }
    if (!this.diasEditadosAMano) {
      this.diasPrimerMes = this.calcularDiasPrimerMes();
      this.simular$.next();
    }
  }

  private mostrarErrorGlobal(mensaje: string): void {
    this.errorGlobal = mensaje;
    setTimeout(() => {
      this.errorGlobalRef?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}
