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
      // HALLAZGO (29/08): no existía ninguna ruta de Sucursal. Pantalla
      // independiente por ahora (no anidada en Empresa, que tiene cambios
      // ajenos sin commitear) - falta un enlace de navegación desde
      // lista-empresas/detalle-empresa hacia acá, pendiente hasta que esos
      // archivos se separen. Se puede llegar por URL directa mientras tanto.
      {
        path: 'sucursales',
        loadComponent: () =>
          import('./sucursales/sucursales.component').then((m) => m.SucursalesComponent),
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
    ],
  },
];
