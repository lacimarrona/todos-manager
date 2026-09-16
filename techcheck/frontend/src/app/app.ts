import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    @if (auth.isLogged()) {
      <div class="flex min-h-screen bg-gray-50 dark:bg-gray-950">
        <nav class="w-56 bg-slate-900 text-slate-300 flex flex-col fixed top-0 left-0 bottom-0 z-50">
          <div class="flex items-center gap-3 px-4 py-5 border-b border-white/10">
            <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">✓</div>
            <span class="text-white font-semibold text-base">TechCheck</span>
          </div>

          <ul class="flex-1 py-3 space-y-0.5 overflow-y-auto">
            <!-- Todos los roles ven Proyectos -->
            <li>
              <a routerLink="/equipos" routerLinkActive="bg-blue-600 !text-white"
                 class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
                <span>💻</span> Proyectos
              </a>
            </li>

            <!-- Admin y project_admin -->
            @if (auth.canManage() || (auth.isTecnico() && auth.tienePermiso('asignar_tareas'))) {
              <li>
                <a routerLink="/tareas" routerLinkActive="bg-blue-600 !text-white"
                   class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
                  <span>⏰</span> Tareas
                </a>
              </li>
            }

            <!-- Admin, project_admin y técnicos con permiso pueden ver Plantillas -->
            @if (auth.puedeGestionarPlantillas()) {
              <li>
                <a routerLink="/plantillas" routerLinkActive="bg-blue-600 !text-white"
                   class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
                  <span>📄</span> Plantillas
                </a>
              </li>
            }

            <!-- Solo admin -->
            @if (auth.isAdmin()) {
              <li>
                <a routerLink="/exportar" routerLinkActive="bg-blue-600 !text-white"
                   class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
                  <span>📤</span> Exportar
                </a>
              </li>
              <li>
                <a routerLink="/catalogos" routerLinkActive="bg-blue-600 !text-white"
                   class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
                  <span>🗂</span> Catálogos
                </a>
              </li>
            }

            <!-- Admin y project_admin (gestión de usuarios/técnicos) -->
            @if (auth.canManage()) {
              <li>
                <a routerLink="/usuarios" routerLinkActive="bg-blue-600 !text-white"
                   class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
                  <span>🔐</span> Usuarios
                </a>
              </li>
            }
          </ul>

          <!-- Pie del sidebar: tema + usuario + logout -->
          <div class="border-t border-white/10 px-4 py-3 space-y-2">
            <!-- Toggle de tema -->
            <button
              (click)="theme.toggle()"
              class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-xs"
              [title]="theme.isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
            >
              <span class="text-base">{{ theme.isDark() ? '☀️' : '🌙' }}</span>
              <span>{{ theme.isDark() ? 'Modo claro' : 'Modo oscuro' }}</span>
            </button>

            <!-- Usuario y logout -->
            <div>
              <div class="text-xs text-slate-300 font-medium truncate mb-0.5">{{ auth.user()?.nombre }}</div>
              <div class="flex items-center justify-between">
                <span class="text-xs px-1.5 py-0.5 rounded text-slate-500"
                  [class]="rolBadgeClass()">
                  {{ rolLabel() }}
                </span>
                <button (click)="logout()"
                  class="text-xs text-slate-500 hover:text-red-400 transition-colors" title="Cerrar sesión">
                  Salir →
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main class="ml-56 flex-1">
          <router-outlet />
        </main>
      </div>
    } @else {
      <router-outlet />
    }
  `
})
export class App implements OnInit {
  constructor(public auth: AuthService, public theme: ThemeService) {}

  ngOnInit() {
    this.theme.init();
  }

  logout() { this.auth.logout(); }

  rolLabel(): string {
    const rol = this.auth.user()?.rol;
    if (rol === 'admin') return 'Administrador';
    if (rol === 'project_admin') return 'Admin Proyectos';
    return 'Técnico';
  }

  rolBadgeClass(): string {
    const rol = this.auth.user()?.rol;
    if (rol === 'admin') return 'bg-purple-900/40 text-purple-300';
    if (rol === 'project_admin') return 'bg-blue-900/40 text-blue-300';
    return 'bg-gray-800 text-gray-400';
  }
}
