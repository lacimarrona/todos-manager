import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex min-h-screen bg-gray-50">
      <nav class="w-56 bg-slate-900 text-slate-300 flex flex-col fixed top-0 left-0 bottom-0 z-50">
        <div class="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">✓</div>
          <span class="text-white font-semibold text-base">TechCheck</span>
        </div>
        <ul class="flex-1 py-3 space-y-0.5">
          <li>
            <a routerLink="/equipos" routerLinkActive="bg-blue-600 !text-white"
               class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
              <span>💻</span> Proyectos
            </a>
          </li>
          <li>
            <a routerLink="/revisiones" routerLinkActive="bg-blue-600 !text-white"
               class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
              <span>🔍</span> Nueva Revisión
            </a>
          </li>
          <li>
            <a routerLink="/historial" routerLinkActive="bg-blue-600 !text-white"
               class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
              <span>📋</span> Historial
            </a>
          </li>
          <li>
            <a routerLink="/plantillas" routerLinkActive="bg-blue-600 !text-white"
               class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
              <span>📄</span> Plantillas
            </a>
          </li>
          <li>
            <a routerLink="/tecnicos" routerLinkActive="bg-blue-600 !text-white"
               class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all text-sm">
              <span>👥</span> Técnicos
            </a>
          </li>
        </ul>
        <div class="px-4 py-3 text-xs text-slate-600 border-t border-white/5">v1.0.0</div>
      </nav>
      <main class="ml-56 flex-1">
        <router-outlet />
      </main>
    </div>
  `
})
export class App {}