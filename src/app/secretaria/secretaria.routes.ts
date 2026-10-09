import { Routes } from '@angular/router';

export const rutasSecretaria: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./panel-secretaria/panel-secretaria.component').then(
        (m) => m.PanelSecretariaComponent
      ),
    children: [
      { path: '', redirectTo: 'resumen', pathMatch: 'full' },
      {
        path: 'resumen',
        loadComponent: () =>
          import('../admin/panel-principal/resumen/resumen.component').then(
            (m) => m.ResumenComponent
          ),
      },
      {
        path: 'afiliados',
        loadComponent: () =>
          import('../admin/afiliados/lista-afiliados/lista-afiliados.component').then(
            (m) => m.ListaAfiliadosComponent
          ),
      },
      {
        // IMPORTANTE: la ruta 'nuevo' debe ir ANTES de ':id' para que no sea capturada como ID
        // 2026-10-09: plantilla de cooperativa (también la usa la Asistente)
        path: 'afiliados/nuevo-cooperativa',
        loadComponent: () =>
          import('../admin/afiliados/formulario-cooperativa/formulario-cooperativa.component').then(
            (m) => m.FormularioCooperativaComponent
          ),
      },
      {
        path: 'afiliados/nuevo',
        loadComponent: () =>
          import('../admin/afiliados/formulario-afiliado/formulario-afiliado.component').then(
            (m) => m.FormularioAfiliadoComponent
          ),
      },
      {
        path: 'afiliados/:id',
        loadComponent: () =>
          import('../admin/afiliados/detalle-afiliado/detalle-afiliado.component').then(
            (m) => m.DetalleAfiliadoComponent
          ),
      },
      {
        path: 'afiliados/:id/incapacidades',
        loadComponent: () =>
          import('../admin/afiliados/incapacidades-afiliado/incapacidades-afiliado.component').then(
            (m) => m.IncapacidadesAfiliadoComponent
          ),
      },
      {
        path: 'empresas',
        loadComponent: () =>
          import('../admin/empresas/lista-empresas/lista-empresas.component').then(
            (m) => m.ListaEmpresasComponent
          ),
      },
      {
        path: 'empresas/:id',
        loadComponent: () =>
          import('../admin/empresas/detalle-empresa/detalle-empresa.component').then(
            (m) => m.DetalleEmpresaComponent
          ),
      },
      {
        path: 'mis-solicitudes',
        loadComponent: () =>
          import('./mis-solicitudes/mis-solicitudes.component').then(
            (m) => m.MisSolicitudesComponent
          ),
      },
      {
        // 2026-10-09: los Excel originales, hoja por hoja
        path: 'archivos-excel',
        loadComponent: () =>
          import('../compartido/biblioteca/biblioteca.component').then((m) => m.BibliotecaComponent),
      },
      {
        path: 'hallazgos-reconciliacion',
        loadComponent: () =>
          import('../admin/hallazgos-reconciliacion/lista-hallazgos/lista-hallazgos.component').then(
            (m) => m.ListaHallazgosComponent
          ),
      },
      {
        path: 'hallazgos-reconciliacion/:id',
        loadComponent: () =>
          import('../admin/hallazgos-reconciliacion/detalle-hallazgo/detalle-hallazgo.component').then(
            (m) => m.DetalleHallazgoComponent
          ),
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('../admin/configuracion/configuracion.component').then(
            (m) => m.ConfiguracionComponent
          ),
      },
      {
        path: 'mis-dispositivos',
        loadComponent: () =>
          import('../compartido/mis-dispositivos/mis-dispositivos.component').then(
            (m) => m.MisDispositivosComponent
          ),
      },
      {
        path: 'calendario',
        loadComponent: () =>
          import('../compartido/calendario-pagos/calendario-pagos.component').then(
            (m) => m.CalendarioPagosComponent
          ),
      },
      {
        path: 'recordatorios-llamada',
        loadComponent: () =>
          import('../compartido/recordatorios-llamada/recordatorios-llamada.component').then(
            (m) => m.RecordatoriosLlamadaComponent
          ),
      },
      {
        path: 'registrar-pago',
        loadComponent: () =>
          import('../compartido/registrar-pago/registrar-pago.component').then(
            (m) => m.RegistrarPagoComponent
          ),
      },
    ],
  },
];
