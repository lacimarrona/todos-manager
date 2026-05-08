import { Routes } from '@angular/router';

export const EQUIPOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./equipos-list/equipos-list.component').then(m => m.EquiposListComponent)
  }
];