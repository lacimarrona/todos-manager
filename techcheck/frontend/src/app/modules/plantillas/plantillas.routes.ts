import { Routes } from '@angular/router';

export const PLANTILLAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./plantillas-list/plantillas-list.component').then(m => m.PlantillasListComponent)
  }
];