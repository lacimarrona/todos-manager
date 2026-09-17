import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // Ruta pública
  {
    path: 'auth/login',
    loadComponent: () => import('./modules/auth/login.component').then(m => m.LoginComponent)
  },

  // Redireccion por defecto
  { path: '', redirectTo: 'equipos', pathMatch: 'full' },

  // Todos los roles — Proyectos/Equipos (la UI controla qué botones muestra)
  {
    path: 'equipos',
    canActivate: [authGuard],
    loadChildren: () => import('./modules/equipos/equipos.routes').then(m => m.EQUIPOS_ROUTES)
  },
  {
    path: 'revisiones',
    canActivate: [authGuard],
    loadChildren: () => import('./modules/revisiones/revisiones.routes').then(m => m.REVISIONES_ROUTES)
  },
  {
    path: 'historial',
    canActivate: [authGuard],
    loadChildren: () => import('./modules/historial/historial.routes').then(m => m.HISTORIAL_ROUTES)
  },

  // Admin, project_admin y técnicos con permiso asignar_tareas
  {
    path: 'tareas',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'project_admin', 'tecnico'] },
    loadComponent: () => import('./modules/tareas/tareas.component').then(m => m.TareasComponent)
  },
  {
    path: 'usuarios',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'project_admin'] },
    loadComponent: () => import('./modules/usuarios/usuarios.component').then(m => m.UsuariosComponent)
  },

  // Admin, project_admin y técnicos con permisos especiales
  {
    path: 'plantillas',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'project_admin', 'tecnico'] },
    loadChildren: () => import('./modules/plantillas/plantillas.routes').then(m => m.PLANTILLAS_ROUTES)
  },
  {
    path: 'tecnicos',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
    loadChildren: () => import('./modules/tecnicos/tecnicos.routes').then(m => m.TECNICOS_ROUTES)
  },
  {
    path: 'exportar',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () => import('./modules/exportar/exportar.component').then(m => m.ExportarComponent)
  },
  {
    path: 'catalogos',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () => import('./modules/catalogos/catalogos.component').then(m => m.CatalogosComponent)
  },

  { path: '**', redirectTo: 'equipos' }
];
