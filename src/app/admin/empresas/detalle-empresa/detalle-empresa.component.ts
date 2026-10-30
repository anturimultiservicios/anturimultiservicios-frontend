import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, finalize } from 'rxjs';
import { EmpresasServicio, Empresa, PersonalEmpresa } from '../../../nucleo/servicios/empresas.servicio';
import { AfiliadosServicio, Afiliado } from '../../../nucleo/servicios/afiliados.servicio';
import { siglaDocumento, TIPOS_DOCUMENTO } from '../../../nucleo/utilidades/tipos-documento';
import { CredencialesTitularComponent } from '../../../compartido/credenciales-titular/credenciales-titular.component';
import { SucursalesServicio, Sucursal } from '../../../nucleo/servicios/sucursales.servicio';
import { SolicitudesServicio, SolicitudCambio, mensajeSolicitud } from '../../../nucleo/servicios/solicitudes.servicio';
import { EntidadesServicio } from '../../../nucleo/servicios/entidades.servicio';
import { AutenticacionServicio } from '../../../nucleo/servicios/autenticacion.servicio';

// 2026-10-07: dejó de ser de solo lectura - editar/activar/desactivar
// (ADMIN/SUPER_ADMIN directo, Secretaria vía SolicitudCambio, mismo
// patrón ya usado en detalle-afiliado.component.ts) + gestión real de
// sucursales (crear/editar, directo para ambos roles con permiso
// granular - sucursales no pasa por SolicitudCambio, a diferencia de
// Empresa, ver empresas.controlador.ts/sucursales.controlador.ts reales).
import { TrabajadoresServicio, PersonaEncontrada } from '../../../nucleo/servicios/trabajadores.servicio';
import { ConfirmarEliminarComponent } from '../../../compartido/confirmar-eliminar/confirmar-eliminar.component';
import { GrupoClienteComponent } from '../../../compartido/grupo-cliente/grupo-cliente.component';
import { VinculosClienteComponent } from '../../../compartido/vinculos-cliente/vinculos-cliente.component';
import { DocumentosTitularComponent } from '../../../compartido/documentos-titular/documentos-titular.component';
import { ContactosAdicionalesComponent, limpiarContactos } from '../../../compartido/contactos-adicionales/contactos-adicionales.component';

@Component({
  selector: 'anturi-detalle-empresa',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CredencialesTitularComponent, DocumentosTitularComponent, ContactosAdicionalesComponent, VinculosClienteComponent, GrupoClienteComponent, ConfirmarEliminarComponent],
  template: `
    <div class="detalle-contenedor">
      <div class="detalle-encabezado">
        <a routerLink="/admin/empresas" class="boton boton-icono" title="Volver a empresas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </a>
        <div class="detalle-encabezado__info">
          <h2 class="pagina-titulo" *ngIf="empresa">{{ empresa.razonSocial }}</h2>
          <h2 class="pagina-titulo" *ngIf="!empresa && !cargando">Detalle de empresa</h2>
          <!-- 2026-10-22: la misma persona también paga como independiente -->
          <a *ngIf="fichaIndependiente" [routerLink]="[prefijo, 'afiliados', fichaIndependiente.id]" class="enlace-cruzado">También paga como independiente → ver su ficha</a>
          <span *ngIf="empresa" class="badge-estado" [ngClass]="empresa.activa ? 'badge-activo' : 'badge-inactivo'">
            {{ empresa.activa ? 'ACTIVA' : 'INACTIVA' }}
          </span>
        </div>
        <div class="detalle-acciones" *ngIf="empresa && !modoEdicion">
          <button class="boton boton-secundario" (click)="activarEdicion()">{{ esSecretaria ? 'Pedir edición' : 'Editar' }}</button>
          <button class="boton" [class.boton-peligro-suave]="empresa.activa" [class.boton-exito-suave]="!empresa.activa" (click)="abrirCambiarEstado()">
            {{ empresa.activa ? (esSecretaria ? 'Pedir desactivar' : 'Desactivar') : (esSecretaria ? 'Pedir activar' : 'Activar') }}
          </button>
          <!-- 2026-10-30: eliminar de verdad (duplicadas) - solo Anturi y el Super Admin -->
          <button *ngIf="!esSecretaria" class="boton boton-peligro" (click)="errorEliminar = ''; confirmandoEliminar = true">Eliminar</button>
        </div>
      </div>

      <div *ngIf="mensajeExito" class="alerta-exito">{{ mensajeExito }}</div>

      <!-- 2026-10-08: lo que pidió la Secretaria queda visible como pendiente
           hasta que Anturi lo confirme en Solicitudes. -->
      <div *ngFor="let s of pendientes" class="aviso-pendiente" [class.aviso-pendiente--eliminar]="s.tipo === 'ELIMINACION'">
        <strong>{{ textoPendiente(s) }} · pendiente de confirmación de Anturi</strong>
        <span>{{ s.creadoPor.nombre }} {{ s.creadoPor.apellido }}, {{ s.creadoEn | date:'d MMM y, h:mm a' }}. Motivo: {{ s.motivo }}</span>
        <a *ngIf="!esSecretaria" [routerLink]="['/admin', 'solicitudes']" class="aviso-pendiente__enlace">Revisar en Solicitudes →</a>
      </div>
      <div *ngIf="mensajeError" class="alerta-error">{{ mensajeError }}</div>

      <div *ngIf="cargando" class="estado-carga">
        <div class="spinner"></div>
        <p>Cargando datos de la empresa...</p>
      </div>

      <div *ngIf="error && !cargando" class="tarjeta estado-vacio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40" style="color: var(--color-error);">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>{{ error }}</p>
        <button class="boton boton-secundario" (click)="cargar()">Reintentar</button>
      </div>

      <!-- 2026-10-15: el personal, las sucursales y los documentos se ven también mientras se edita -->
      <ng-container *ngIf="empresa && !cargando">
        <!-- MODO EDICIÓN DE LA EMPRESA -->
        <div class="tarjeta seccion-datos" *ngIf="modoEdicion">
        <h3 class="seccion-titulo">Editar {{ empresa.razonSocial }}</h3>
        <div *ngIf="esSecretaria" class="aviso-secretaria">Este cambio queda pendiente de aprobación de un Admin/Super Admin.</div>
        <div class="campos-grid-modal">
          <div class="campo-grupo">
            <label class="campo-etiqueta">Razón social</label>
            <input type="text" class="campo-input" [(ngModel)]="edicionForm.razonSocial" name="edit-razonSocial">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">NIT</label>
            <input type="text" class="campo-input" [(ngModel)]="edicionForm.nit" name="edit-nit">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Correo</label>
            <input type="email" class="campo-input" [(ngModel)]="edicionForm.correo" name="edit-correo">
            <anturi-contactos-adicionales tipo="email" etiqueta="Correo" nombre="edit-correos" [(valores)]="correosAdicionales"></anturi-contactos-adicionales>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Celular / teléfono</label>
            <input type="tel" class="campo-input" [(ngModel)]="edicionForm.telefono" name="edit-telefono">
            <anturi-contactos-adicionales tipo="tel" etiqueta="Celular" nombre="edit-telefonos" [(valores)]="telefonosAdicionales"></anturi-contactos-adicionales>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Fecha de ingreso</label>
            <input type="date" class="campo-input" [(ngModel)]="fechaIngresoEdicion" name="edit-fechaIngreso">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Fecha de retiro</label>
            <input type="date" class="campo-input" [(ngModel)]="fechaRetiroEdicion" name="edit-fechaRetiro">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Municipio</label>
            <input type="text" class="campo-input" [(ngModel)]="edicionForm.municipio" name="edit-municipio">
          </div>
          <div class="campo-grupo campo-grupo--ancho">
            <label class="campo-etiqueta">Dirección</label>
            <input type="text" class="campo-input" [(ngModel)]="edicionForm.direccion" name="edit-direccion">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Clase aportante</label>
            <input type="text" class="campo-input" [(ngModel)]="edicionForm.claseAportante" name="edit-claseAportante" list="clases-empleador" autocomplete="off">
            <datalist id="clases-empleador"><option *ngFor="let c of clasesEmpleador" [value]="c"></option></datalist>
          </div>
          <!-- 2026-10-16: en el Excel las fincas venían en "Clase aportante" -->
          <div class="campo-grupo campo-grupo--ancho">
            <label class="campo-etiqueta" for="edit-lugarTrabajo">Lugares de trabajo (fincas, obras, sedes)</label>
            <textarea id="edit-lugarTrabajo" class="campo-input" rows="2" [(ngModel)]="edicionForm.lugarTrabajo" name="edit-lugarTrabajo" placeholder="Ej. Finca La Negrita, vereda El Gigante, Montenegro"></textarea>
          </div>
          <!-- 2026-10-22 -->
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="edit-repLegal">Representante legal</label>
            <input id="edit-repLegal" type="text" class="campo-input" [(ngModel)]="edicionForm.representanteLegal" name="edit-repLegal">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="edit-repDoc">Documento del representante</label>
            <input id="edit-repDoc" type="text" class="campo-input" [(ngModel)]="edicionForm.representanteDocumento" name="edit-repDoc" inputmode="numeric">
          </div>
          <!-- 2026-10-29 (Anyi): EPS, pensión y caja de la cuenta - antes no se podían cambiar -->
          <div class="campo-grupo" *ngFor="let t of tiposEntidad">
            <label class="campo-etiqueta" [for]="'edit-ent-' + t.campo">{{ t.nombre }}</label>
            <input [id]="'edit-ent-' + t.campo" type="text" class="campo-input" [(ngModel)]="$any(edicionForm)[t.campo]" [name]="'edit-ent-' + t.campo" [attr.list]="'lista-ent-' + t.campo" autocomplete="off" placeholder="Escriba o elija">
            <datalist [id]="'lista-ent-' + t.campo"><option *ngFor="let n of entidadesSugeridas[t.tipo] || []" [value]="n"></option></datalist>
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="edit-conocido">Conocido como / negocio</label>
            <input id="edit-conocido" type="text" class="campo-input" [(ngModel)]="edicionForm.conocidoComo" name="edit-conocido">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="edit-contacto">Contacto (contador, secretaria…)</label>
            <input id="edit-contacto" type="text" class="campo-input" [(ngModel)]="edicionForm.contactoNombre" name="edit-contacto">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="edit-contactoTel">Celular del contacto</label>
            <input id="edit-contactoTel" type="text" class="campo-input" [(ngModel)]="edicionForm.contactoTelefono" name="edit-contactoTel" inputmode="tel">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Días de pago</label>
            <input type="number" class="campo-input" [(ngModel)]="edicionForm.diasPago" name="edit-diasPago">
          </div>
          <div class="campo-grupo campo-grupo--ancho" *ngIf="esSecretaria">
            <label class="campo-etiqueta">Motivo del cambio <span class="requerido">*</span></label>
            <input type="text" class="campo-input" [(ngModel)]="motivoEdicion" placeholder="Por qué se hace este cambio">
          </div>
        </div>
        <div class="form-acciones">
          <button class="boton boton-secundario" (click)="cancelarEdicion()" [disabled]="guardandoEdicion">Cancelar</button>
          <button class="boton boton-primario" (click)="guardarEdicion()" [disabled]="guardandoEdicion">
            <span *ngIf="guardandoEdicion" class="spinner-inline"></span>
            {{ guardandoEdicion ? 'Guardando...' : (esSecretaria ? 'Enviar solicitud' : 'Guardar cambios') }}
          </button>
        </div>
      </div>
        <div class="tarjeta seccion-datos" *ngIf="!modoEdicion">
          <h3 class="seccion-titulo">Datos de la empresa</h3>
          <div class="datos-grid">
            <div class="dato-item">
              <span class="dato-etiqueta">NIT</span>
              <span class="dato-valor">{{ empresa.nit }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Correo</span>
              <span class="dato-valor">{{ empresa.correo || '—' }}<ng-container *ngFor="let c of lista(empresa.correosAdicionales)"><br>{{ c }}</ng-container></span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Celular / teléfono</span>
              <span class="dato-valor">{{ empresa.telefono || '—' }}<ng-container *ngFor="let t of lista(empresa.telefonosAdicionales)"><br>{{ t }}</ng-container></span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Municipio</span>
              <span class="dato-valor">{{ empresa.municipio || empresa.ciudad || '—' }}</span>
            </div>
            <div class="dato-item dato-item--ancho">
              <span class="dato-etiqueta">Dirección</span>
              <span class="dato-valor">{{ empresa.direccion || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Clase aportante</span>
              <span class="dato-valor">{{ empresa.claseAportante || '—' }}</span>
            </div>
            <div class="dato-item dato-item--ancho" *ngIf="empresa.lugarTrabajo">
              <span class="dato-etiqueta">Lugares de trabajo</span>
              <span class="dato-valor">{{ empresa.lugarTrabajo }}</span>
            </div>
            <div class="dato-item" *ngIf="empresa.representanteLegal">
              <span class="dato-etiqueta">Representante legal</span>
              <span class="dato-valor">{{ empresa.representanteLegal }}{{ empresa.representanteDocumento ? ' · CC ' + empresa.representanteDocumento : '' }}</span>
            </div>
            <div class="dato-item" *ngIf="empresa.conocidoComo">
              <span class="dato-etiqueta">Conocido como</span>
              <span class="dato-valor">{{ empresa.conocidoComo }}</span>
            </div>
            <div class="dato-item" *ngIf="empresa.contactoNombre || empresa.contactoTelefono">
              <span class="dato-etiqueta">Contacto</span>
              <span class="dato-valor">{{ empresa.contactoNombre || '—' }}{{ empresa.contactoTelefono ? ' · ' + empresa.contactoTelefono : '' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Días de pago</span>
              <span class="dato-valor">{{ empresa.diasPago ?? '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Asopagos</span>
              <span class="dato-valor">{{ empresa.asopagos || '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Fecha de ingreso</span>
              <span class="dato-valor">{{ empresa.fechaIngreso ? (empresa.fechaIngreso | date:'dd/MM/yyyy':'UTC') : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Fecha de retiro</span>
              <span class="dato-valor">{{ empresa.fechaRetiro ? (empresa.fechaRetiro | date:'dd/MM/yyyy':'UTC') : '—' }}</span>
            </div>
            <div class="dato-item">
              <span class="dato-etiqueta">Registrada</span>
              <span class="dato-valor">{{ empresa.creadoEn | date:'d MMM y' }}</span>
            </div>
          </div>
        </div>

        <!-- 2026-10-30: grupo de quien paga por varios (solo aparece si hace parte de uno) -->
        <anturi-grupo-cliente tipo="EMPRESA" [id]="empresa.id" [tarjeta]="true"></anturi-grupo-cliente>

        <!-- 2026-10-08: usuarios y claves de portales de la empresa -->
        <div class="tarjeta seccion-datos">
          <h3 class="seccion-titulo">Usuarios y claves de portales</h3>
          <anturi-credenciales-titular titularTipo="EMPRESA" [titularId]="empresa.id"></anturi-credenciales-titular>
        </div>

        <!-- 2026-10-15: documentos de la empresa, por carpetas -->
        <div class="tarjeta seccion-datos">
          <anturi-documentos-titular titularTipo="EMPRESA" [titularId]="empresa.id" [titulo]="empresa.razonSocial + ' (la cuenta, no los trabajadores)'"></anturi-documentos-titular>
        </div>

        <!-- 2026-10-22: familia o relación con otros clientes -->
        <div class="tarjeta seccion-datos" *ngIf="empresa">
          <anturi-vinculos-cliente tipo="EMPRESA" [id]="empresa.id"></anturi-vinculos-cliente>
        </div>

        <!-- 2026-10-08: personal de la empresa (antes solo se veían sucursales) -->
        <div class="tarjeta seccion-datos">
          <div class="seccion-titulo-fila">
            <h3 class="seccion-titulo">Personal de la empresa ({{ personalActivo.length }})</h3>
            <button class="boton boton-primario boton-sm" (click)="abrirAgregarPersonal()">+ Agregar persona</button>
          </div>
          <div *ngIf="cargandoPersonal" style="color: var(--texto-terciario); font-size: var(--tamano-sm);">Cargando personal...</div>
          <div *ngIf="!cargandoPersonal && personal.length === 0" style="color: var(--texto-terciario); font-size: var(--tamano-sm);">
            Todavía no hay personas vinculadas a esta empresa. Use "Agregar persona" para buscarlas por nombre o documento.
          </div>
          <!-- 2026-10-09: con sucursales, cada trabajador se asigna a una (o a la sede principal) -->
          <div *ngIf="sucursales.length > 0 && personal.length > 0" class="filtro-sucursal">
            <label for="filtroSucursal">Ver:</label>
            <select id="filtroSucursal" class="campo-input campo-input--sm" [(ngModel)]="filtroSucursal">
              <option value="todas">Todas las sedes</option>
              <option value="principal">Sede principal ({{ cuantosEn(null) }})</option>
              <option *ngFor="let s of sucursales" [value]="s.id">{{ s.nombre }} ({{ cuantosEn(s.id) }})</option>
            </select>
          </div>
          <div class="tabla-contenedor" *ngIf="personal.length > 0">
            <table class="tabla">
              <thead>
                <tr><th>Persona</th><th>Documento</th><th>Cargo</th><th>Salario</th><th *ngIf="sucursales.length > 0">Sucursal</th><th>Desde</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of personalFiltrado" [class.fila-retirada]="p.estadoRelacion !== 'ACTIVA'">
                  <td>{{ p.nombre }}</td>
                  <td>{{ sigla(p.tipoDocumento) }} {{ p.documento }}</td>
                  <!-- 2026-10-30 (Anyi): editar cargo y salario aquí mismo -->
                  <ng-container *ngIf="editandoRel?.relacionId !== p.relacionId; else celdasEdicion">
                    <td>{{ p.cargo || '—' }}</td>
                    <td class="celda-salario">{{ tieneValor(p.salario) ? (+p.salario! | currency:'COP':'symbol-narrow':'1.0-0') : '—' }}</td>
                  </ng-container>
                  <ng-template #celdasEdicion>
                    <td><input class="campo-input campo-input--sm" [(ngModel)]="editandoRel!.cargo" [attr.aria-label]="'Cargo de ' + p.nombre" placeholder="Cargo"></td>
                    <td><input class="campo-input campo-input--sm" type="number" min="0" step="1000" [(ngModel)]="editandoRel!.salario" [attr.aria-label]="'Salario de ' + p.nombre" placeholder="Salario"></td>
                  </ng-template>
                  <td *ngIf="sucursales.length > 0">
                    <select *ngIf="p.estadoRelacion === 'ACTIVA'; else sedeFija" class="campo-input campo-input--sm"
                            [ngModel]="p.sucursalId" (ngModelChange)="cambiarSucursal(p, $event)" [disabled]="asignandoSucursal === p.relacionId"
                            [attr.aria-label]="'Sucursal de ' + p.nombre">
                      <option [ngValue]="null">Sede principal</option>
                      <option *ngFor="let s of sucursales" [ngValue]="s.id">{{ s.nombre }}{{ s.activa === false ? ' (inactiva)' : '' }}</option>
                    </select>
                    <ng-template #sedeFija>{{ p.sucursalNombre || 'Sede principal' }}</ng-template>
                  </td>
                  <td>{{ p.fechaIngreso ? (p.fechaIngreso | date:'dd/MM/yyyy') : '—' }}</td>
                  <td>
                    <span class="badge-estado" [ngClass]="p.estadoRelacion === 'ACTIVA' ? 'badge-activo' : 'badge-inactivo'">
                      {{ p.estadoRelacion === 'ACTIVA' ? 'TRABAJA AQUÍ' : 'RETIRADO' + (p.fechaRetiro ? ' ' + (p.fechaRetiro | date:'dd/MM/yyyy') : '') }}
                    </span>
                  </td>
                  <td class="acciones-personal">
                    <ng-container *ngIf="editandoRel?.relacionId === p.relacionId">
                      <button type="button" class="boton boton-primario boton-sm" [disabled]="guardandoRel" (click)="guardarRel()">{{ guardandoRel ? 'Guardando…' : 'Guardar' }}</button>
                      <button type="button" class="boton boton-texto boton-sm" (click)="editandoRel = null">Cancelar</button>
                    </ng-container>
                    <button *ngIf="editandoRel?.relacionId !== p.relacionId && p.estadoRelacion === 'ACTIVA'" type="button" class="boton boton-texto boton-sm" (click)="editarRel(p)">Editar</button>
                    <a *ngIf="p.afiliado" [routerLink]="[prefijo, 'afiliados', p.afiliado.id]" class="boton boton-texto boton-sm">Ver ficha</a>
                    <a *ngIf="!p.afiliado && p.cuentaEmpresaId" [routerLink]="[prefijo, 'empresas', p.cuentaEmpresaId]" class="boton boton-texto boton-sm" title="Esta persona tiene su propia cuenta">Ver su cuenta</a>
                    <a [routerLink]="[prefijo, 'trabajadores', p.personaId]" class="boton boton-texto boton-sm" title="Cargo, salario, documentos y familia del trabajador">Ficha del trabajador</a>
                    <button *ngIf="!esSecretaria && p.estadoRelacion === 'ACTIVA'" class="boton boton-texto boton-sm" (click)="retirarPersonal(p)">Retirar</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="tarjeta seccion-datos">
          <div class="seccion-titulo-fila">
            <h3 class="seccion-titulo">Sucursales ({{ sucursales.length }})</h3>
            <button class="boton boton-secundario boton-sm" (click)="activarCrearSucursal()">+ Agregar sucursal</button>
          </div>
          <div *ngIf="sucursales.length === 0" style="color: var(--texto-terciario); font-size: var(--tamano-sm);">Sin sucursales registradas.</div>
          <div class="tabla-contenedor" *ngIf="sucursales.length > 0">
            <table class="tabla">
              <thead>
                <tr><th>Nombre</th><th>Ciudad</th><th>Trabajadores</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of sucursales">
                  <td>{{ s.nombre }}</td>
                  <td>{{ s.ciudad || '—' }}</td>
                  <td>{{ cuantosEn(s.id) }}</td>
                  <td><span class="badge-estado" [ngClass]="s.activa ? 'badge-activo' : 'badge-inactivo'">{{ s.activa ? 'ACTIVA' : 'INACTIVA' }}</span></td>
                  <td><button class="boton boton-texto boton-sm" (click)="activarEditarSucursal(s)">Editar</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>

    </div>

    <anturi-confirmar-eliminar *ngIf="confirmandoEliminar && empresa" [nombre]="empresa.razonSocial"
      detalle="Se borra la cuenta, su personal y sus sedes. Si tiene pagos o documentos no se deja eliminar: en ese caso desactívela. Queda anotado en el historial."
      [trabajando]="eliminandoEmpresa" [error]="errorEliminar" (cancelar)="confirmandoEliminar = false" (confirmar)="eliminarEmpresa($event)"></anturi-confirmar-eliminar>

    <!-- MODAL: cambiar estado (activar/desactivar) -->
    <div *ngIf="modalEstado" class="modal-overlay" (click)="modalEstado = false">
      <div class="modal-form" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-titulo">{{ empresa?.activa ? 'Desactivar' : 'Activar' }} {{ empresa?.razonSocial }}</h3>
          <button class="boton boton-icono" (click)="modalEstado = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-cuerpo">
          <div class="campo-grupo">
            <label class="campo-etiqueta">Motivo <span class="requerido">*</span></label>
            <input type="text" class="campo-input" [(ngModel)]="motivoEstado" placeholder="Por qué se activa/desactiva">
          </div>
        </div>
        <div class="modal-pie">
          <button class="boton boton-secundario" (click)="modalEstado = false" [disabled]="guardandoEstado">Cancelar</button>
          <button class="boton boton-primario" (click)="confirmarCambiarEstado()" [disabled]="guardandoEstado || !motivoEstado.trim()">
            {{ guardandoEstado ? 'Guardando...' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: agregar persona a la empresa (2026-10-08) -->
    <div *ngIf="modalPersonal" class="modal-overlay" (click)="modalPersonal = false">
      <div class="modal-form" (click)="$event.stopPropagation()">
        <div class="modal-header"><h3 class="modal-titulo">Agregar persona a {{ empresa?.razonSocial }}</h3></div>
        <div class="modal-cuerpo">
        <!-- 2026-10-22 (Anyi): el trabajador NO tiene que ser afiliado - paga la empresa con la cédula del empleador -->
        <ng-container *ngIf="!modoNuevoTrabajador">
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="busquedaPersonal">Buscar por nombre o documento</label>
            <input id="busquedaPersonal" type="text" class="campo-input" [(ngModel)]="busquedaPersonal" name="busquedaPersonal"
                   placeholder="Ej. 1094933466 o Pérez" (ngModelChange)="buscarPersonal()">
            <small class="ayuda-personal">Busca afiliados y trabajadores de otras empresas. Si no está, créelo como trabajador nuevo (no hace falta crearlo como afiliado).</small>
          </div>
          <div *ngIf="buscandoPersonal" style="color: var(--texto-terciario); font-size: var(--tamano-sm);">Buscando...</div>
          <ul class="lista-busqueda" *ngIf="resultadosPersonal.length > 0">
            <li *ngFor="let p of resultadosPersonal" [class.seleccionado]="seleccionPersonal?.personaId === p.personaId" (click)="seleccionPersonal = p">
              <strong>{{ p.nombre }}</strong>
              <span>{{ sigla(p.tipoDocumento) }} {{ p.numeroDocumento }}
                · {{ p.afiliado ? 'Afiliado (' + p.afiliado.estado + ')' : 'Trabajador' }}{{ p.trabajaEn.length ? ' · trabaja en ' + nombresEmpresas(p) : '' }}</span>
            </li>
          </ul>
          <div *ngIf="!buscandoPersonal && busquedaPersonal.trim().length >= 3 && resultadosPersonal.length === 0" style="color: var(--texto-terciario); font-size: var(--tamano-sm);">
            No se encontró a nadie con ese nombre o documento.
          </div>
          <button type="button" class="boton boton-secundario boton-sm" style="align-self: flex-start;" (click)="iniciarTrabajadorNuevo()">+ Crear trabajador nuevo</button>
        </ng-container>

        <ng-container *ngIf="modoNuevoTrabajador">
          <p class="ayuda-personal">Trabajador nuevo de {{ empresa?.razonSocial }}. Queda en el personal de la empresa con su ficha de trabajador (documentos, familia, fecha de nacimiento…).</p>
          <div class="fila-doc-personal">
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="tnTipo">Tipo de documento</label>
              <select id="tnTipo" class="campo-input" [(ngModel)]="nuevoTrabajador.tipoDocumento" name="tnTipo">
                <option *ngFor="let t of tiposDocumento" [value]="t.valor">{{ t.nombre }}</option>
              </select>
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="tnNumero">Número de documento *</label>
              <input id="tnNumero" class="campo-input" [(ngModel)]="nuevoTrabajador.numeroDocumento" name="tnNumero" inputmode="numeric">
            </div>
          </div>
          <div class="fila-doc-personal">
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="tnNombres">Nombres *</label>
              <input id="tnNombres" class="campo-input" [(ngModel)]="nuevoTrabajador.nombres" name="tnNombres">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="tnApellidos">Apellidos</label>
              <input id="tnApellidos" class="campo-input" [(ngModel)]="nuevoTrabajador.apellidos" name="tnApellidos">
            </div>
          </div>
          <!-- 2026-10-30 (Anyi): todo desde el registro, sin tener que volver a editar -->
          <div class="fila-doc-personal">
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="tnTel">Celular</label>
              <input id="tnTel" class="campo-input" [(ngModel)]="nuevoTrabajador.telefono" name="tnTel" inputmode="tel">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="tnCorreo">Correo electrónico</label>
              <input id="tnCorreo" type="email" class="campo-input" [(ngModel)]="nuevoTrabajador.correo" name="tnCorreo">
            </div>
          </div>
          <div class="fila-doc-personal">
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="tnDir">Dirección</label>
              <input id="tnDir" class="campo-input" [(ngModel)]="nuevoTrabajador.direccion" name="tnDir">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="tnMun">Municipio</label>
              <input id="tnMun" class="campo-input" [(ngModel)]="nuevoTrabajador.municipio" name="tnMun">
            </div>
          </div>
          <div class="fila-doc-personal">
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="tnNac">Fecha de nacimiento</label>
              <input id="tnNac" type="date" class="campo-input" [(ngModel)]="nuevoTrabajador.fechaNacimiento" name="tnNac" [max]="hoy">
            </div>
            <div class="campo-grupo">
              <label class="campo-etiqueta" for="tnExp">Fecha de expedición del documento</label>
              <input id="tnExp" type="date" class="campo-input" [(ngModel)]="nuevoTrabajador.fechaExpedicion" name="tnExp" [max]="hoy">
            </div>
          </div>
          <button type="button" class="boton boton-texto boton-sm" style="align-self: flex-start;" (click)="modoNuevoTrabajador = false">← Volver a buscar</button>
        </ng-container>
        <div class="campo-grupo" *ngIf="puedeGuardarPersonal && sucursales.length > 0">
          <label class="campo-etiqueta" for="sucursalPersonal">Sucursal donde trabaja</label>
          <select id="sucursalPersonal" class="campo-input" [(ngModel)]="sucursalPersonal" name="sucursalPersonal">
            <option [ngValue]="null">Sede principal</option>
            <option *ngFor="let s of sucursales" [ngValue]="s.id">{{ s.nombre }}</option>
          </select>
        </div>
        <div class="campo-grupo" *ngIf="puedeGuardarPersonal">
          <label class="campo-etiqueta">Cargo (opcional)</label>
          <input type="text" class="campo-input" [(ngModel)]="cargoPersonal" name="cargoPersonal" placeholder="Ej. Auxiliar de bodega">
        </div>
        <div class="fila-doc-personal" *ngIf="puedeGuardarPersonal">
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="salPersonal">Salario</label>
            <input id="salPersonal" type="number" class="campo-input" min="0" step="1000" [(ngModel)]="salarioPersonal" name="salarioPersonal" placeholder="Ej. 1423500">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta" for="auxPersonal">Auxilio de transporte</label>
            <input id="auxPersonal" type="number" class="campo-input" min="0" step="100" [(ngModel)]="auxilioPersonal" name="auxilioPersonal">
          </div>
        </div>
        <div class="campo-grupo" *ngIf="puedeGuardarPersonal">
          <label class="campo-etiqueta">Fecha de ingreso a la empresa</label>
          <input type="date" class="campo-input" [(ngModel)]="fechaIngresoPersonal" name="fechaIngresoPersonal">
        </div>
        <div *ngIf="errorPersonal" class="alerta-error">{{ errorPersonal }}</div>
        </div>
        <div class="modal-pie">
          <button class="boton boton-secundario" (click)="modalPersonal = false">Cancelar</button>
          <button class="boton boton-primario" [disabled]="!puedeGuardarPersonal || guardandoPersonal" (click)="guardarPersonal()">
            {{ guardandoPersonal ? 'Guardando...' : (modoNuevoTrabajador ? 'Crear y agregar a la empresa' : 'Vincular a la empresa') }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: crear/editar sucursal -->
    <div *ngIf="modalSucursal" class="modal-overlay" (click)="modalSucursal = false">
      <div class="modal-form" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-titulo">{{ sucursalEditando ? 'Editar sucursal' : 'Nueva sucursal' }}</h3>
          <button class="boton boton-icono" (click)="modalSucursal = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-cuerpo">
          <div *ngIf="errorModalSucursal" class="alerta-error" style="margin-bottom: var(--espacio-4);">{{ errorModalSucursal }}</div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Nombre <span class="requerido">*</span></label>
            <input type="text" class="campo-input" [(ngModel)]="formSucursal.nombre">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Ciudad</label>
            <input type="text" class="campo-input" [(ngModel)]="formSucursal.ciudad">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Dirección</label>
            <input type="text" class="campo-input" [(ngModel)]="formSucursal.direccion">
          </div>
          <div class="campo-grupo">
            <label class="campo-etiqueta">Teléfono</label>
            <input type="tel" class="campo-input" [(ngModel)]="formSucursal.telefono">
          </div>
          <div class="campo-grupo" *ngIf="sucursalEditando">
            <label class="permiso-check"><input type="checkbox" [(ngModel)]="formSucursal.activa"> Activa</label>
          </div>
        </div>
        <div class="modal-pie">
          <button class="boton boton-secundario" (click)="modalSucursal = false" [disabled]="guardandoSucursal">Cancelar</button>
          <button class="boton boton-primario" (click)="guardarSucursal()" [disabled]="guardandoSucursal || !formSucursal.nombre?.trim()">
            {{ guardandoSucursal ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .celda-salario { white-space: nowrap; font-weight: 600; }
    td .campo-input--sm { min-width: 110px; }
    .enlace-cruzado { font-size: var(--tamano-sm); font-weight: 600; color: var(--color-secundario, #E8570C); }
    .ayuda-personal { color: var(--texto-terciario); font-size: var(--tamano-sm); margin: 4px 0 0; display: block; }
    .fila-doc-personal { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 520px) { .fila-doc-personal { grid-template-columns: 1fr; } }
    .detalle-contenedor { display: flex; flex-direction: column; gap: var(--espacio-5); }
    .detalle-encabezado { display: flex; align-items: center; gap: var(--espacio-3); flex-wrap: wrap; }
    .detalle-encabezado__info { display: flex; align-items: center; gap: var(--espacio-3); flex: 1; flex-wrap: wrap; }
    .detalle-acciones { display: flex; gap: var(--espacio-2); margin-left: auto; flex-wrap: wrap; }
    .pagina-titulo { font-size: var(--tamano-2xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .boton-peligro-suave { color: var(--color-error); }
    .boton-exito-suave { color: #15803d; }
    .aviso-secretaria { display: flex; align-items: center; gap: var(--espacio-2); font-size: var(--tamano-sm); color: var(--color-advertencia); background: rgba(249,115,22,0.08); padding: var(--espacio-2) var(--espacio-3); border-radius: var(--radio-sm); margin-bottom: var(--espacio-4); }
    .aviso-pendiente { display: flex; flex-direction: column; gap: var(--espacio-1); padding: var(--espacio-3) var(--espacio-4); background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.35); border-left: 4px solid #eab308; border-radius: var(--radio-md); color: var(--texto-principal); font-size: var(--tamano-sm); }
    .aviso-pendiente--eliminar { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.3); border-left-color: #ef4444; }
    .aviso-pendiente__enlace { color: var(--color-primario); font-weight: 600; text-decoration: none; align-self: flex-start; }
    .fila-retirada td { color: var(--texto-terciario); }
    .filtro-sucursal { display: flex; align-items: center; gap: var(--espacio-2); margin-bottom: var(--espacio-3); font-size: var(--tamano-sm); color: var(--texto-secundario); }
    .filtro-sucursal select { max-width: 260px; }
    .campo-input--sm { padding: 4px 8px; font-size: var(--tamano-sm); min-width: 150px; }
    .acciones-personal { white-space: nowrap; display: flex; gap: var(--espacio-2); align-items: center; }
    .sin-ficha { font-size: var(--tamano-xs); color: var(--texto-terciario); }
    .lista-busqueda { list-style: none; margin: 0 0 var(--espacio-3); padding: 0; max-height: 260px; overflow-y: auto; border: 1px solid var(--borde-color); border-radius: var(--radio-md); }
    .lista-busqueda li { display: flex; flex-direction: column; gap: 2px; padding: var(--espacio-2) var(--espacio-3); cursor: pointer; border-bottom: 1px solid var(--borde-color); font-size: var(--tamano-sm); }
    .lista-busqueda li span { color: var(--texto-terciario); font-size: var(--tamano-xs); }
    .lista-busqueda li:hover { background: rgba(0,0,0,0.03); }
    .lista-busqueda li.seleccionado { background: rgba(27,50,112,0.08); border-left: 3px solid var(--color-primario); }
    .alerta-exito { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: var(--radio-md); color: #15803d; font-size: var(--tamano-sm); }
    .alerta-error { display: flex; align-items: center; gap: var(--espacio-2); padding: var(--espacio-3) var(--espacio-4); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radio-md); color: var(--color-error); font-size: var(--tamano-sm); }
    .form-acciones { display: flex; justify-content: flex-end; gap: var(--espacio-3); margin-top: var(--espacio-4); }
    .campos-grid-modal { display: grid; grid-template-columns: 1fr 1fr; gap: var(--espacio-4); }
    .campo-grupo { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .campo-grupo--ancho { grid-column: 1 / -1; }
    .requerido { color: var(--color-error); }
    .permiso-check { display: flex; align-items: center; gap: var(--espacio-2); font-size: var(--tamano-sm); color: var(--texto-principal); cursor: pointer; }
    .seccion-titulo-fila { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espacio-4); }
    .seccion-titulo-fila .seccion-titulo { margin: 0; }
    .boton-sm { font-size: var(--tamano-sm); padding: var(--espacio-1) var(--espacio-3); }
    .boton-texto { background: none; border: none; color: var(--color-primario); cursor: pointer; }
    .spinner-inline { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: girar 0.8s linear infinite; margin-right: var(--espacio-2); }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: var(--espacio-4); }
    .modal-form { background: var(--fondo-tarjeta, #fff); border-radius: var(--radio-xl); width: 100%; max-width: 480px; display: flex; flex-direction: column; box-shadow: var(--sombra-md); max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--espacio-5); border-bottom: 1px solid var(--borde-color, #e5e7eb); }
    .modal-titulo { font-size: var(--tamano-xl); font-weight: 700; color: var(--texto-principal); margin: 0; }
    .modal-cuerpo { padding: var(--espacio-5); display: flex; flex-direction: column; gap: var(--espacio-3); }
    .modal-pie { display: flex; justify-content: flex-end; gap: var(--espacio-3); padding: var(--espacio-4) var(--espacio-5); border-top: 1px solid var(--borde-color, #e5e7eb); }

    .estado-carga { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); color: var(--texto-terciario); }
    .spinner { width: 40px; height: 40px; border: 3px solid var(--borde-color, #e5e7eb); border-top-color: var(--color-primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }
    .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: var(--espacio-4); padding: var(--espacio-10); text-align: center; }

    .seccion-datos { padding: var(--espacio-5); }
    .seccion-titulo { font-size: var(--tamano-lg); font-weight: 600; color: var(--texto-principal); margin: 0 0 var(--espacio-4); }
    .datos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--espacio-4); }
    .dato-item { display: flex; flex-direction: column; gap: var(--espacio-1); }
    .dato-item--ancho { grid-column: 1 / -1; }
    .dato-etiqueta { font-size: var(--tamano-sm); color: var(--texto-terciario); font-weight: 500; }
    .dato-valor { font-size: var(--tamano-base); color: var(--texto-principal); font-weight: 500; }

    .badge-estado { display: inline-flex; align-items: center; padding: 2px var(--espacio-2); border-radius: var(--radio-sm); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-activo { background: rgba(34,197,94,0.12); color: #15803d; }
    .badge-inactivo { background: rgba(239,68,68,0.12); color: #b91c1c; }

    .tabla-contenedor { overflow: hidden; }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla thead th { padding: var(--espacio-3) var(--espacio-4); text-align: left; font-size: var(--tamano-sm); font-weight: 600; color: var(--texto-secundario); background: var(--fondo-tabla-cabecera, rgba(0,0,0,0.03)); border-bottom: 1px solid var(--borde-color, #e5e7eb); }
    .tabla tbody td { padding: var(--espacio-3) var(--espacio-4); border-bottom: 1px solid var(--borde-color, #e5e7eb); font-size: var(--tamano-sm); color: var(--texto-principal); }
    .tabla tbody tr:last-child td { border-bottom: none; }
  `]
})
export class DetalleEmpresaComponent implements OnInit {
  empresa: Empresa | null = null;
  sucursales: Sucursal[] = [];
  cargando = false;
  error = '';
  private id!: number;

  mensajeExito = '';
  mensajeError = '';

  // ── Edición de empresa ──
  modoEdicion = false;
  edicionForm: Partial<Empresa> = {};
  readonly clasesEmpleador = ['Empleador', 'Doméstica', 'Servicio doméstico', 'Obra', 'Construcción', 'Finca', 'Trabajadores', 'Independiente', 'Cooperativa'];
  motivoEdicion = '';
  guardandoEdicion = false;

  // ── Activar/desactivar ──
  modalEstado = false;
  motivoEstado = '';
  guardandoEstado = false;

  // ── Personal de la empresa (2026-10-08) ──
  personal: PersonalEmpresa[] = [];
  cargandoPersonal = false;
  modalPersonal = false;
  busquedaPersonal = '';
  buscandoPersonal = false;
  resultadosPersonal: PersonaEncontrada[] = [];
  seleccionPersonal: PersonaEncontrada | null = null;
  // 2026-10-22: crear el trabajador aquí mismo (sin ficha de afiliado)
  modoNuevoTrabajador = false;
  nuevoTrabajador = this.trabajadorVacio();
  salarioPersonal: number | null = null;
  auxilioPersonal: number | null = null;
  readonly hoy = new Date().toISOString().slice(0, 10);

  private trabajadorVacio(numeroDocumento = '', nombres = '') {
    return { tipoDocumento: 'CC', numeroDocumento, nombres, apellidos: '', telefono: '', correo: '', direccion: '', municipio: '', fechaNacimiento: '', fechaExpedicion: '' };
  }

  // ── 2026-10-30 (Anyi): editar cargo y salario en la lista del personal ──
  editandoRel: { relacionId: number; cargo: string; salario: number | null } | null = null;
  guardandoRel = false;

  tieneValor(v: unknown): boolean {
    return v !== null && v !== undefined && v !== '';
  }

  editarRel(p: PersonalEmpresa): void {
    this.editandoRel = { relacionId: p.relacionId, cargo: p.cargo ?? '', salario: this.tieneValor(p.salario) ? Number(p.salario) : null };
  }

  guardarRel(): void {
    const e = this.editandoRel;
    if (!e) return;
    this.guardandoRel = true;
    const salario = this.tieneValor(e.salario) ? Number(e.salario) : null;
    this.trabajadoresServicio.actualizarRelacion(e.relacionId, { cargo: e.cargo.trim(), salario }).pipe(finalize(() => (this.guardandoRel = false))).subscribe({
      next: () => {
        this.editandoRel = null;
        this.mensajeExito = 'Cargo y salario guardados.';
        setTimeout(() => (this.mensajeExito = ''), 4000);
        this.cargarPersonal();
      },
      error: (err) => (this.mensajeError = err?.error?.message || 'No se pudo guardar el salario.'),
    });
  }
  // casos como Tatiana: la misma persona es independiente y empleadora
  fichaIndependiente: { id: number; estado: string } | null = null;

  get puedeGuardarPersonal(): boolean {
    if (this.modoNuevoTrabajador) return this.nuevoTrabajador.numeroDocumento.replace(/\D/g, '').length >= 4 && this.nuevoTrabajador.nombres.trim().length >= 2;
    return !!this.seleccionPersonal;
  }

  private buscarFichaIndependiente(nit: string | null | undefined): void {
    const doc = String(nit ?? '').replace(/\D/g, '');
    this.fichaIndependiente = null;
    if (doc.length < 5) return;
    this.afiliadosServicio.listar(doc, undefined, undefined, 1, 5).pipe(catchError(() => of({ datos: [] } as any))).subscribe((r: any) => {
      const a = (r.datos ?? []).find((x: Afiliado) => String(x.cedula ?? '').replace(/\D/g, '') === doc);
      this.fichaIndependiente = a ? { id: a.id, estado: a.estado } : null;
    });
  }

  nombresEmpresas(p: PersonaEncontrada): string {
    return p.trabajaEn.map((t) => t.razonSocial).join(', ');
  }

  iniciarTrabajadorNuevo(): void {
    const t = this.busquedaPersonal.trim();
    const digitos = t.replace(/\D/g, '');
    this.nuevoTrabajador = this.trabajadorVacio(digitos.length >= 4 ? digitos : '', digitos.length >= 4 ? '' : t);
    this.seleccionPersonal = null;
    this.modoNuevoTrabajador = true;
  }
  cargoPersonal = '';
  fechaIngresoPersonal = new Date().toISOString().slice(0, 10);
  guardandoPersonal = false;
  errorPersonal = '';
  private temporizadorBusqueda: ReturnType<typeof setTimeout> | null = null;
  readonly sigla = siglaDocumento;
  readonly tiposDocumento = TIPOS_DOCUMENTO;

  sucursalPersonal: number | null = null;
  filtroSucursal: string = 'todas';
  asignandoSucursal: number | null = null;

  get personalFiltrado(): PersonalEmpresa[] {
    if (this.filtroSucursal === 'todas') return this.personal;
    const id = this.filtroSucursal === 'principal' ? null : Number(this.filtroSucursal);
    return this.personal.filter((p) => (p.sucursalId ?? null) === id);
  }

  cuantosEn(sucursalId: number | null): number {
    return this.personalActivo.filter((p) => (p.sucursalId ?? null) === sucursalId).length;
  }

  cambiarSucursal(p: PersonalEmpresa, sucursalId: number | null): void {
    const anterior = p.sucursalId;
    p.sucursalId = sucursalId;
    this.asignandoSucursal = p.relacionId;
    this.empresasServicio.asignarSucursal(this.id, p.relacionId, sucursalId).pipe(
      finalize(() => (this.asignandoSucursal = null)),
    ).subscribe({
      next: () => {
        p.sucursalNombre = this.sucursales.find((s) => s.id === sucursalId)?.nombre ?? null;
        this.mensajeExito = `${p.nombre}: ${p.sucursalNombre ?? 'Sede principal'}.`;
        setTimeout(() => (this.mensajeExito = ''), 3000);
      },
      error: (err) => {
        p.sucursalId = anterior;
        this.mensajeError = err?.error?.message || 'No se pudo cambiar la sucursal.';
      },
    });
  }

  get personalActivo(): PersonalEmpresa[] {
    return this.personal.filter((p) => p.estadoRelacion === 'ACTIVA');
  }

  get prefijo(): string {
    return this.router.url.startsWith('/asistente') ? '/asistente' : '/admin';
  }

  cargarPersonal(): void {
    this.cargandoPersonal = true;
    this.empresasServicio.personal(this.id).pipe(
      catchError(() => of([] as PersonalEmpresa[])),
      finalize(() => (this.cargandoPersonal = false)),
    ).subscribe((lista) => (this.personal = lista));
  }

  abrirAgregarPersonal(): void {
    this.modalPersonal = true;
    this.busquedaPersonal = '';
    this.resultadosPersonal = [];
    this.seleccionPersonal = null;
    this.modoNuevoTrabajador = false;
    this.cargoPersonal = '';
    this.salarioPersonal = null;
    this.auxilioPersonal = null;
    this.sucursalPersonal = null;
    this.errorPersonal = '';
    this.fechaIngresoPersonal = new Date().toISOString().slice(0, 10);
  }

  buscarPersonal(): void {
    if (this.temporizadorBusqueda) clearTimeout(this.temporizadorBusqueda);
    const termino = this.busquedaPersonal.trim();
    this.seleccionPersonal = null;
    if (termino.length < 3) { this.resultadosPersonal = []; return; }
    this.temporizadorBusqueda = setTimeout(() => {
      this.buscandoPersonal = true;
      this.trabajadoresServicio.buscar(termino).pipe(
        catchError(() => of([] as PersonaEncontrada[])),
        finalize(() => (this.buscandoPersonal = false)),
      ).subscribe((lista) => {
        const vinculados = new Set(this.personalActivo.map((p) => p.personaId));
        this.resultadosPersonal = lista.filter((p) => !vinculados.has(p.personaId));
      });
    }, 350);
  }

  guardarPersonal(): void {
    if (!this.puedeGuardarPersonal) return;
    this.guardandoPersonal = true;
    this.errorPersonal = '';
    const sel = this.seleccionPersonal;
    const n = this.nuevoTrabajador;
    const quien = this.modoNuevoTrabajador
      ? { nuevo: {
          tipoDocumento: n.tipoDocumento, numeroDocumento: n.numeroDocumento.trim(), nombres: n.nombres.trim(), apellidos: n.apellidos.trim() || undefined, telefono: n.telefono.trim() || undefined,
          correo: n.correo.trim() || undefined, direccion: n.direccion.trim() || undefined, municipio: n.municipio.trim() || undefined,
          fechaNacimiento: n.fechaNacimiento || undefined, fechaExpedicion: n.fechaExpedicion || undefined,
        } }
      : sel!.afiliado ? { afiliadoId: sel!.afiliado.id } : { personaId: sel!.personaId };
    this.empresasServicio.agregarPersonal(this.id, {
      ...quien,
      cargo: this.cargoPersonal.trim() || undefined,
      fechaIngreso: this.fechaIngresoPersonal || undefined,
      sucursalId: this.sucursalPersonal,
      salario: this.tieneValor(this.salarioPersonal) ? Number(this.salarioPersonal) : undefined,
      auxilioTransporte: this.tieneValor(this.auxilioPersonal) ? Number(this.auxilioPersonal) : undefined,
    }).pipe(finalize(() => (this.guardandoPersonal = false))).subscribe({
      next: () => {
        this.modalPersonal = false;
        this.mensajeExito = this.modoNuevoTrabajador ? 'Trabajador creado y agregado a la empresa. Sus documentos y familia están en "Ficha del trabajador".' : 'Persona vinculada a la empresa.';
        setTimeout(() => (this.mensajeExito = ''), 4000);
        this.cargarPersonal();
      },
      error: (err) => (this.errorPersonal = err?.error?.message || 'No se pudo vincular. Intente de nuevo.'),
    });
  }

  retirarPersonal(p: PersonalEmpresa): void {
    const motivo = prompt(`¿Por qué se retira ${p.nombre} de la empresa? (ej. terminó contrato)`);
    if (!motivo || motivo.trim().length < 3) return;
    this.empresasServicio.retirarPersonal(this.id, p.relacionId, { motivo: motivo.trim() }).pipe(
      catchError((err) => { this.mensajeError = err?.error?.message || 'No se pudo retirar.'; return of(null); }),
    ).subscribe((r) => {
      if (r !== null) {
        this.mensajeExito = 'Persona retirada de la empresa (queda en el historial).';
        setTimeout(() => (this.mensajeExito = ''), 4000);
        this.cargarPersonal();
      }
    });
  }

  // ── Sucursales ──
  modalSucursal = false;
  sucursalEditando: Sucursal | null = null;
  formSucursal: Partial<Sucursal> = {};
  errorModalSucursal = '';
  guardandoSucursal = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private empresasServicio: EmpresasServicio,
    private afiliadosServicio: AfiliadosServicio,
    private sucursalesServicio: SucursalesServicio,
    private solicitudesServicio: SolicitudesServicio,
    private auth: AutenticacionServicio,
    private trabajadoresServicio: TrabajadoresServicio,
    private entidadesServicio: EntidadesServicio,
  ) {}

  get esSecretaria(): boolean {
    return this.auth.tieneRol(['SECRETARIA']);
  }

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.empresasServicio.obtener(this.id).pipe(
      catchError(() => {
        this.error = 'Error al cargar la empresa. Verifique la conexión.';
        return of(null);
      })
    ).subscribe(resp => {
      this.empresa = resp;
      this.cargando = false;
      if (resp) {
        this.buscarFichaIndependiente(resp.nit);
        this.cargarSucursales();
        this.cargarPendientes();
        this.cargarPersonal();
      }
    });
  }

  pendientes: SolicitudCambio[] = [];

  cargarPendientes(): void {
    this.solicitudesServicio.pendientesDe('empresas', this.id).pipe(
      catchError(() => of([] as SolicitudCambio[])),
    ).subscribe((lista) => { this.pendientes = lista; });
  }

  textoPendiente(s: SolicitudCambio): string {
    if (s.tipo === 'EDICION') return 'Cambios guardados';
    if (s.tipo === 'ELIMINACION') return 'Desactivación solicitada';
    if (s.tipo === 'RESTAURACION') return 'Activación solicitada';
    return 'Cambio solicitado';
  }

  private cargarSucursales(): void {
    this.sucursalesServicio.listarPorEmpresa(this.id).pipe(
      catchError(() => of([] as Sucursal[])),
    ).subscribe((lista) => { this.sucursales = lista; });
  }

  // ── EDICIÓN ──────────────────────────────────────────────
  // 2026-10-15: contactos adicionales y fechas de la empresa
  telefonosAdicionales: string[] = [];
  correosAdicionales: string[] = [];
  fechaIngresoEdicion = '';
  fechaRetiroEdicion = '';
  lista(v: unknown): string[] { return Array.isArray(v) ? v.filter((x) => !!x) : []; }

  readonly tiposEntidad = [
    { campo: 'eps', tipo: 'EPS', nombre: 'EPS' },
    { campo: 'afp', tipo: 'PENSION', nombre: 'Fondo de pensión' },
    { campo: 'cajaCom', tipo: 'CAJA_COMPENSACION', nombre: 'Caja de compensación' },
  ];
  entidadesSugeridas: Record<string, string[]> = {};

  // ── 2026-10-30: eliminar la cuenta (solo Anturi y el Super Admin) ──
  confirmandoEliminar = false;
  eliminandoEmpresa = false;
  errorEliminar = '';

  eliminarEmpresa(motivo: string): void {
    this.eliminandoEmpresa = true;
    this.errorEliminar = '';
    this.empresasServicio.eliminar(this.id, motivo).pipe(finalize(() => (this.eliminandoEmpresa = false))).subscribe({
      next: () => this.router.navigate([this.prefijo, 'empresas']),
      error: (err) => {
        const m = err?.error?.message;
        this.errorEliminar = (Array.isArray(m) ? m[0] : m) || 'No se pudo eliminar.';
      },
    });
  }

  activarEdicion(): void {
    if (!this.empresa) return;
    this.edicionForm = { ...this.empresa };
    this.entidadesServicio.porTipo().subscribe((r) => (this.entidadesSugeridas = r));
    this.telefonosAdicionales = this.lista(this.empresa.telefonosAdicionales);
    this.correosAdicionales = this.lista(this.empresa.correosAdicionales);
    this.fechaIngresoEdicion = this.empresa.fechaIngreso ? String(this.empresa.fechaIngreso).slice(0, 10) : '';
    this.fechaRetiroEdicion = this.empresa.fechaRetiro ? String(this.empresa.fechaRetiro).slice(0, 10) : '';
    this.motivoEdicion = '';
    this.modoEdicion = true;
    this.mensajeExito = '';
    this.mensajeError = '';
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.edicionForm = {};
  }

  guardarEdicion(): void {
    if (this.esSecretaria && !this.motivoEdicion.trim()) {
      this.mensajeError = 'Debe indicar el motivo del cambio para enviar la solicitud.';
      return;
    }
    this.guardandoEdicion = true;
    this.mensajeError = '';

    // Payload explícito, solo los campos editables reales - mandar
    // sucursales/id/creadoEn de más rechazaría el request entero
    // (forbidNonWhitelisted:true), mismo patrón ya usado en afiliados.
    const datos = {
      razonSocial: this.edicionForm.razonSocial,
      nit: this.edicionForm.nit,
      correo: this.edicionForm.correo || undefined,
      telefono: this.edicionForm.telefono,
      direccion: this.edicionForm.direccion,
      municipio: this.edicionForm.municipio,
      claseAportante: this.edicionForm.claseAportante,
      lugarTrabajo: (this.edicionForm.lugarTrabajo ?? '').trim() || undefined,
      representanteLegal: (this.edicionForm.representanteLegal ?? '').trim() || undefined,
      representanteDocumento: (this.edicionForm.representanteDocumento ?? '').trim() || undefined,
      conocidoComo: (this.edicionForm.conocidoComo ?? '').trim() || undefined,
      eps: (this.edicionForm.eps ?? '').trim() || undefined,
      afp: (this.edicionForm.afp ?? '').trim() || undefined,
      cajaCom: (this.edicionForm.cajaCom ?? '').trim() || undefined,
      contactoNombre: (this.edicionForm.contactoNombre ?? '').trim() || undefined,
      contactoTelefono: (this.edicionForm.contactoTelefono ?? '').trim() || undefined,
      diasPago: this.edicionForm.diasPago == null || (this.edicionForm.diasPago as any) === '' ? undefined : Number(this.edicionForm.diasPago),
      telefonosAdicionales: limpiarContactos(this.telefonosAdicionales),
      correosAdicionales: limpiarContactos(this.correosAdicionales),
      ...(this.fechaIngresoEdicion ? { fechaIngreso: this.fechaIngresoEdicion } : {}),
      ...(this.fechaRetiroEdicion ? { fechaRetiro: this.fechaRetiroEdicion } : {}),
    };

    if (this.esSecretaria) {
      this.solicitudesServicio.crear({
        tipo: 'EDICION',
        tabla: 'empresas',
        registroId: this.id,
        motivo: this.motivoEdicion,
        datosOriginales: this.empresa,
        datosNuevos: datos,
      }).pipe(
        catchError(() => { this.mensajeError = 'Error al enviar la solicitud. Intente nuevamente.'; return of(null); }),
        finalize(() => { this.guardandoEdicion = false; }),
      ).subscribe((res) => {
        if (res) {
          this.mensajeExito = mensajeSolicitud(res, 'Cambio guardado. Queda pendiente hasta que Anturi lo confirme.');
          this.modoEdicion = false;
          this.cargarPendientes();
          if (res.aplicadaDirecto) this.cargar();
          setTimeout(() => { this.mensajeExito = ''; }, 5000);
        }
      });
    } else {
      const motivo = this.motivoEdicion || 'Actualización desde panel de administración';
      this.empresasServicio.actualizar(this.id, datos, motivo).pipe(
        catchError((err) => { this.mensajeError = err?.error?.message || 'Error al guardar los cambios.'; return of(null); }),
        finalize(() => { this.guardandoEdicion = false; }),
      ).subscribe((emp) => {
        if (emp) {
          this.empresa = emp;
          this.modoEdicion = false;
          this.mensajeExito = 'Datos actualizados correctamente.';
          setTimeout(() => { this.mensajeExito = ''; }, 4000);
        }
      });
    }
  }

  // ── ACTIVAR/DESACTIVAR ───────────────────────────────────
  abrirCambiarEstado(): void {
    this.motivoEstado = '';
    this.modalEstado = true;
  }

  confirmarCambiarEstado(): void {
    if (!this.empresa || !this.motivoEstado.trim()) return;
    this.guardandoEstado = true;
    const nuevoEstado = !this.empresa.activa;

    if (this.esSecretaria) {
      this.solicitudesServicio.crear({
        tipo: nuevoEstado ? 'RESTAURACION' : 'ELIMINACION',
        tabla: 'empresas',
        registroId: this.id,
        motivo: this.motivoEstado,
      }).pipe(
        catchError(() => { this.mensajeError = 'Error al enviar la solicitud.'; return of(null); }),
        finalize(() => { this.guardandoEstado = false; }),
      ).subscribe((res) => {
        if (res) {
          this.mensajeExito = mensajeSolicitud(res, 'Solicitud guardada. Queda pendiente hasta que Anturi la confirme.');
          this.modalEstado = false;
          this.cargarPendientes();
          if (res.aplicadaDirecto) this.cargar();
          setTimeout(() => { this.mensajeExito = ''; }, 5000);
        }
      });
    } else {
      this.empresasServicio.cambiarEstado(this.id, nuevoEstado, this.motivoEstado).pipe(
        catchError((err) => { this.mensajeError = err?.error?.message || 'Error al cambiar el estado.'; return of(null); }),
        finalize(() => { this.guardandoEstado = false; }),
      ).subscribe((emp) => {
        if (emp) {
          this.empresa = emp;
          this.modalEstado = false;
          this.mensajeExito = `Empresa ${nuevoEstado ? 'activada' : 'desactivada'} correctamente.`;
          setTimeout(() => { this.mensajeExito = ''; }, 4000);
        }
      });
    }
  }

  // ── SUCURSALES (directo, sin SolicitudCambio - ver nota de cabecera) ──
  activarCrearSucursal(): void {
    this.sucursalEditando = null;
    this.formSucursal = { activa: true };
    this.errorModalSucursal = '';
    this.modalSucursal = true;
  }

  activarEditarSucursal(s: Sucursal): void {
    this.sucursalEditando = s;
    this.formSucursal = { ...s };
    this.errorModalSucursal = '';
    this.modalSucursal = true;
  }

  guardarSucursal(): void {
    if (!this.formSucursal.nombre?.trim()) return;
    this.guardandoSucursal = true;
    this.errorModalSucursal = '';

    if (this.sucursalEditando) {
      const { id, empresaId, creadoEn, _count, ...datos } = this.formSucursal as any;
      this.sucursalesServicio.actualizar(this.sucursalEditando.id, datos, 'Actualización desde ficha de empresa').pipe(
        catchError((err) => { this.errorModalSucursal = err?.error?.message || 'Error al guardar.'; return of(null); }),
        finalize(() => { this.guardandoSucursal = false; }),
      ).subscribe((res) => {
        if (res) { this.modalSucursal = false; this.cargarSucursales(); }
      });
    } else {
      this.sucursalesServicio.crear({
        nombre: this.formSucursal.nombre!,
        empresaId: this.id,
        direccion: this.formSucursal.direccion,
        telefono: this.formSucursal.telefono,
        ciudad: this.formSucursal.ciudad,
      }).pipe(
        catchError((err) => { this.errorModalSucursal = err?.error?.message || 'Error al crear la sucursal.'; return of(null); }),
        finalize(() => { this.guardandoSucursal = false; }),
      ).subscribe((res) => {
        if (res) { this.modalSucursal = false; this.cargarSucursales(); }
      });
    }
  }
}
