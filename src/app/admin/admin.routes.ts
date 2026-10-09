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
        // 2026-10-09: plantilla de cooperativa
        path: 'afiliados/nuevo-cooperativa',
        loadComponent: () =>
          import('./afiliados/formulario-cooperativa/formulario-cooperativa.component').then((m) => m.FormularioCooperativaComponent),
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
        path: 'afiliados/:id/incapacidades',
        loadComponent: () =>
          import('./afiliados/incapacidades-afiliado/incapacidades-afiliado.component').then((m) => m.IncapacidadesAfiliadoComponent),
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
        path: 'registrar-pago',
        loadComponent: () =>
          import('../compartido/registrar-pago/registrar-pago.component').then((m) => m.RegistrarPagoComponent),
      },
      {
        path: 'horario-acceso',
        loadComponent: () =>
          import('./horario-acceso/horario-acceso.component').then((m) => m.HorarioAccesoComponent),
      },
      {
        path: 'backup',
        loadComponent: () =>
          import('./backup/backup.component').then((m) => m.BackupComponent),
      },
      {
        // 2026-10-09: control del dinero - solo Administrador y Super Admin
        path: 'recaudo',
        loadComponent: () =>
          import('./recaudo/recaudo.component').then((m) => m.RecaudoComponent),
      },
      {
        // 2026-10-09: nómina de los empleadores - solo Administrador y Super Admin
        path: 'nomina',
        loadComponent: () =>
          import('./nomina/nomina.component').then((m) => m.NominaComponent),
      },
      {
        // 2026-10-09: recibos de caja menor (todos los roles)
        path: 'caja-menor',
        loadComponent: () =>
          import('../compartido/caja-menor/caja-menor.component').then((m) => m.CajaMenorComponent),
      },
      {
        path: 'parametros-legales',
        loadComponent: () =>
          import('./parametros-legales/parametros-legales.component').then((m) => m.ParametrosLegalesComponent),
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
