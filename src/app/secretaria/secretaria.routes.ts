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
        path: 'mis-solicitudes',
        loadComponent: () =>
          import('./mis-solicitudes/mis-solicitudes.component').then(
            (m) => m.MisSolicitudesComponent
          ),
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('../admin/configuracion/configuracion.component').then(
            (m) => m.ConfiguracionComponent
          ),
      },
    ],
  },
];
