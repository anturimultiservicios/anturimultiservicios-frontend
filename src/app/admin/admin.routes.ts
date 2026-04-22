import { Routes } from '@angular/router';

export const rutasAdmin: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./panel-principal/panel-principal.component').then(
        (m) => m.PanelPrincipalComponent
      ),
    children: [
      {
        path: '',
        redirectTo: 'resumen',
        pathMatch: 'full',
      },
      {
        path: 'resumen',
        loadComponent: () =>
          import('./panel-principal/resumen/resumen.component').then(
            (m) => m.ResumenComponent
          ),
      },
      {
        path: 'empresas',
        loadComponent: () =>
          import('./empresas/lista-empresas/lista-empresas.component').then(
            (m) => m.ListaEmpresasComponent
          ),
      },
      {
        path: 'empresas/:id',
        loadComponent: () =>
          import('./empresas/detalle-empresa/detalle-empresa.component').then(
            (m) => m.DetalleEmpresaComponent
          ),
      },
      {
        path: 'afiliados',
        loadComponent: () =>
          import('./afiliados/lista-afiliados/lista-afiliados.component').then(
            (m) => m.ListaAfiliadosComponent
          ),
      },
      {
        path: 'afiliados/:id',
        loadComponent: () =>
          import('./afiliados/detalle-afiliado/detalle-afiliado.component').then(
            (m) => m.DetalleAfiliadoComponent
          ),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./usuarios-sistema/usuarios-sistema.component').then(
            (m) => m.UsuariosSistemaComponent
          ),
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./configuracion/configuracion.component').then(
            (m) => m.ConfiguracionComponent
          ),
      },
    ],
  },
];
