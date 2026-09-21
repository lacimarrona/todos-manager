import { Component, OnInit, signal } from '@angular/core';
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

        <!-- Top bar móvil -->
        <header class="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-slate-900 flex items-center px-4 gap-3 border-b border-white/10">
          <button (click)="sidebarAbierto.set(!sidebarAbierto())"
            class="w-9 h-9 flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect y="3" width="20" height="2" rx="1"/>
              <rect y="9" width="20" height="2" rx="1"/>
              <rect y="15" width="20" height="2" rx="1"/>
            </svg>
          </button>
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">✓</div>
            <span class="text-white font-semibold text-sm">TechCheck</span>
          </div>
        </header>

        <!-- Overlay backdrop móvil -->
        @if (sidebarAbierto()) {
          <div class="lg:hidden fixed inset-0 z-40 bg-black/50" (click)="sidebarAbierto.set(false)"></div>
        }

        <!-- Sidebar -->
        <nav class="w-56 bg-slate-900 text-slate-300 flex flex-col fixed top-0 left-0 bottom-0 z-50 transition-transform duration-200"
          [ngClass]="sidebarAbierto() ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'">
          <div class="flex items-center gap-3 px-4 py-5 border-b border-white/10">
            <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">✓</div>
            <span class="text-white font-semibold text-base">TechCheck</span>
          </div>

          <ul class="flex-1 py-3 space-y-0.5 overflow-y-auto">
            <li>
              <a routerLink="/equipos" routerLinkActive="bg-blue-600 !text-white"
                 (click)="sidebarAbierto.set(false)"
                 class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
                <span>💻</span> Proyectos
              </a>
            </li>


            @if (auth.puedeGestionarPlantillas()) {
              <li>
                <a routerLink="/plantillas" routerLinkActive="bg-blue-600 !text-white"
                   (click)="sidebarAbierto.set(false)"
                   class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
                  <span>📄</span> Plantillas
                </a>
              </li>
            }

            @if (auth.isAdmin()) {
              <li>
                <a routerLink="/exportar" routerLinkActive="bg-blue-600 !text-white"
                   (click)="sidebarAbierto.set(false)"
                   class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
                  <span>📤</span> Exportar
                </a>
              </li>
              <li>
                <a routerLink="/catalogos" routerLinkActive="bg-blue-600 !text-white"
                   (click)="sidebarAbierto.set(false)"
                   class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
                  <span>🗂</span> Catálogos
                </a>
              </li>
            }

            @if (auth.canManage()) {
              <li>
                <a routerLink="/usuarios" routerLinkActive="bg-blue-600 !text-white"
                   (click)="sidebarAbierto.set(false)"
                   class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
                  <span>🔐</span> Usuarios
                </a>
              </li>
            }
          </ul>

          <div class="border-t border-white/10 px-4 py-3 space-y-2">
            <button
              (click)="theme.toggle()"
              class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-xs"
              [title]="theme.isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
            >
              <span class="text-base">{{ theme.isDark() ? '☀️' : '🌙' }}</span>
              <span>{{ theme.isDark() ? 'Modo claro' : 'Modo oscuro' }}</span>
            </button>

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

        <main class="lg:ml-56 flex-1 pt-14 lg:pt-0">
          <router-outlet />
        </main>
      </div>
    } @else {
      <router-outlet />
    }
  `
})
export class App implements OnInit {
  sidebarAbierto = signal(false);
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
