import { Routes } from '@angular/router';

export const rutasSecretaria: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./panel-secretaria/panel-secretaria.component').then(
        (m) => m.PanelSecretariaComponent
      ),
  },
];
