import { Routes } from '@angular/router';

export const HISTORIAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./historial-list/historial-list.component').then(m => m.HistorialListComponent)
  }
];