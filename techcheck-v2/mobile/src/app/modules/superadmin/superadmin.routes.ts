import { Routes } from '@angular/router';

export const SUPERADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./workspaces/workspace-list/workspace-list.component')
        .then(m => m.WorkspaceListComponent),
  },
  {
    path: 'usuarios',
    loadComponent: () =>
      import('./users/user-list/user-list.component')
        .then(m => m.SuperadminUserListComponent),
  },
];
