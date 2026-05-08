import { Routes } from '@angular/router';

export const REVISIONES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./revisiones-form/revisiones-form.component').then(m => m.RevisionesFormComponent)
  }
];