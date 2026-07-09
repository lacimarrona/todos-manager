import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'workspace', pathMatch: 'full' },

  {
    path: 'auth',
    loadChildren: () =>
      import('./modules/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },

  // SuperAdmin area
  {
    path: 'superadmin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['superadmin'] },
    loadChildren: () =>
      import('./modules/superadmin/superadmin.routes').then(m => m.SUPERADMIN_ROUTES),
  },

  // Workspace area (admin + usuario)
  {
    path: 'workspace',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'superadmin', 'usuario'] },
    loadChildren: () =>
      import('./modules/workspace/workspace.routes').then(m => m.WORKSPACE_ROUTES),
  },

  { path: 'unauthorized', redirectTo: 'auth/login', pathMatch: 'full' },
  { path: '**', redirectTo: 'workspace' },
];
