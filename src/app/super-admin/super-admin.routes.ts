import { Routes } from '@angular/router';

export const rutasSuperAdmin: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./panel-super-admin/panel-super-admin.component').then(
        (m) => m.PanelSuperAdminComponent
      ),
  },
];
