import { Routes } from '@angular/router';

export const rutasAdmin: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./panel-principal/panel-principal.component').then((m) => m.PanelPrincipalComponent),
    children: [
      { path: '', redirectTo: 'resumen', pathMatch: 'full' },
      {
        path: 'resumen',
        loadComponent: () =>
          import('./panel-principal/resumen/resumen.component').then((m) => m.ResumenComponent),
      },
      {
        path: 'afiliados',
        loadComponent: () =>
          import('./afiliados/lista-afiliados/lista-afiliados.component').then((m) => m.ListaAfiliadosComponent),
      },
      {
        path: 'afiliados/nuevo',
        loadComponent: () =>
          import('./afiliados/formulario-afiliado/formulario-afiliado.component').then((m) => m.FormularioAfiliadoComponent),
      },
      {
        // Debe ir ANTES de 'afiliados/:id' - si no, Nest/Angular la matchea
        // como si 'papelera' fuera un id (mismo motivo que en el backend).
        path: 'afiliados/papelera',
        loadComponent: () =>
          import('./afiliados/papelera-afiliados/papelera-afiliados.component').then((m) => m.PapeleraAfiliadosComponent),
      },
      {
        path: 'afiliados/:id',
        loadComponent: () =>
          import('./afiliados/detalle-afiliado/detalle-afiliado.component').then((m) => m.DetalleAfiliadoComponent),
      },
      {
        path: 'empresas',
        loadComponent: () =>
          import('./empresas/lista-empresas/lista-empresas.component').then((m) => m.ListaEmpresasComponent),
      },
      {
        path: 'empresas/:id',
        loadComponent: () =>
          import('./empresas/detalle-empresa/detalle-empresa.component').then((m) => m.DetalleEmpresaComponent),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./usuarios-sistema/usuarios-sistema.component').then((m) => m.UsuariosSistemaComponent),
      },
      {
        path: 'solicitudes',
        loadComponent: () =>
          import('./solicitudes/solicitudes-admin.component').then((m) => m.SolicitudesAdminComponent),
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./configuracion/configuracion.component').then((m) => m.ConfiguracionComponent),
      },
      {
        path: 'mis-dispositivos',
        loadComponent: () =>
          import('../compartido/mis-dispositivos/mis-dispositivos.component').then((m) => m.MisDispositivosComponent),
      },
      {
        path: 'dispositivos',
        loadComponent: () =>
          import('./dispositivos/administrar-dispositivos.component').then((m) => m.AdministrarDispositivosComponent),
      },
      {
        path: 'calendario',
        loadComponent: () =>
          import('../compartido/calendario-pagos/calendario-pagos.component').then((m) => m.CalendarioPagosComponent),
      },
      {
        path: 'recordatorios-llamada',
        loadComponent: () =>
          import('../compartido/recordatorios-llamada/recordatorios-llamada.component').then((m) => m.RecordatoriosLlamadaComponent),
      },
      {
        path: 'horario-acceso',
        loadComponent: () =>
          import('./horario-acceso/horario-acceso.component').then((m) => m.HorarioAccesoComponent),
      },
      {
        path: 'parametros-legales',
        loadComponent: () =>
          import('./parametros-legales/parametros-legales.component').then((m) => m.ParametrosLegalesComponent),
      },
      {
        path: 'hallazgos-reconciliacion',
        loadComponent: () =>
          import('./hallazgos-reconciliacion/lista-hallazgos/lista-hallazgos.component').then((m) => m.ListaHallazgosComponent),
      },
      {
        path: 'hallazgos-reconciliacion/:id',
        loadComponent: () =>
          import('./hallazgos-reconciliacion/detalle-hallazgo/detalle-hallazgo.component').then((m) => m.DetalleHallazgoComponent),
      },
    ],
  },
];
