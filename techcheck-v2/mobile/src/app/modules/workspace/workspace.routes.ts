import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const WORKSPACE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shell/workspace-shell.component').then(m => m.WorkspaceShellComponent),
    children: [
      {
        path: 'usuarios',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'superadmin'] },
        loadComponent: () =>
          import('./users/user-list/user-list.component').then(m => m.UserListComponent),
      },
      {
        path: 'proyectos',
        loadComponent: () =>
          import('./proyectos/proyecto-list/proyecto-list.component')
            .then(m => m.ProyectoListComponent),
      },
      {
        path: 'proyectos/:id/equipos',
        loadComponent: () =>
          import('./equipos/equipo-list/equipo-list.component')
            .then(m => m.EquipoListComponent),
      },
      {
        path: 'proyectos/:id/historial',
        loadComponent: () =>
          import('./historial/historial.component').then(m => m.HistorialComponent),
      },
      {
        path: 'plantillas',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'superadmin'] },
        loadComponent: () =>
          import('./plantillas/plantilla-list/plantilla-list.component')
            .then(m => m.PlantillaListComponent),
      },
      {
        path: 'tareas',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'superadmin'] },
        loadComponent: () =>
          import('./tareas/tarea-list/tarea-list.component').then(m => m.TareaListComponent),
      },
      {
        path: 'tecnicos',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'superadmin'] },
        loadComponent: () =>
          import('./tecnicos/tecnico-list/tecnico-list.component').then(m => m.TecnicoListComponent),
      },
      {
        path: 'dashboard',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'superadmin'] },
        loadComponent: () =>
          import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      { path: '', redirectTo: 'proyectos', pathMatch: 'full' },
    ],
  },
];
