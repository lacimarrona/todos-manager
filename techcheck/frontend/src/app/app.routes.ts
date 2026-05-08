import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'equipos', pathMatch: 'full' },
  {
    path: 'equipos',
    loadChildren: () => import('./modules/equipos/equipos.routes').then(m => m.EQUIPOS_ROUTES)
  },
  {
    path: 'revisiones',
    loadChildren: () => import('./modules/revisiones/revisiones.routes').then(m => m.REVISIONES_ROUTES)
  },
  {
    path: 'plantillas',
    loadChildren: () => import('./modules/plantillas/plantillas.routes').then(m => m.PLANTILLAS_ROUTES)
  },
  {
    path: 'historial',
    loadChildren: () => import('./modules/historial/historial.routes').then(m => m.HISTORIAL_ROUTES)
  },
  {
    path: 'tecnicos',
    loadChildren: () => import('./modules/tecnicos/tecnicos.routes').then(m => m.TECNICOS_ROUTES)
  },
  { path: '**', redirectTo: 'equipos' }
];