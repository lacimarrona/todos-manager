import { Routes } from '@angular/router';

export const TECNICOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tecnicos-list/tecnicos-list.component').then(m => m.TecnicosListComponent)
  }
];