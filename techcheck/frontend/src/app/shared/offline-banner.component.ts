import { Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SwUpdate } from '@angular/service-worker';
import { OfflineService } from '../core/offline/offline.service';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (nuevaVersion()) {
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 lg:px-7 py-2.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-b border-blue-100 dark:border-blue-800">
        <span class="flex-1 min-w-0">Hay una versión nueva de TechCheck.</span>
        <button type="button" (click)="actualizar()" class="px-3 py-1 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700">Actualizar</button>
      </div>
    }

    @if (!off.enLinea()) {
      <div role="status" class="px-4 lg:px-7 py-2.5 text-sm bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-800">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="font-semibold">Sin conexión con el servidor</span>
          @if (off.pendientes().length) {
            <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-200/70 dark:bg-amber-800/60 tabular-nums">
              {{ off.pendientes().length }} {{ off.pendientes().length === 1 ? 'cambio' : 'cambios' }} por subir
            </span>
          }
          <button type="button" (click)="reintentar()" [disabled]="verificando()"
            class="ml-auto px-3 py-1 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-800/40 disabled:opacity-50">
            {{ verificando() ? 'Comprobando…' : 'Reintentar' }}
          </button>
        </div>
        <p class="text-xs mt-0.5 text-amber-800/90 dark:text-amber-200/80">
          Puedes seguir haciendo revisiones: se guardan en este dispositivo y se suben solas al reconectar.
          @if (off.ultimaDescarga()) { Datos guardados el {{ off.ultimaDescarga() | date:'dd/MM/yy HH:mm' }}. }
        </p>
      </div>
    } @else if (off.pendientes().length) {
      <div role="status" class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 lg:px-7 py-2.5 text-sm bg-sky-50 dark:bg-sky-900/30 text-sky-900 dark:text-sky-200 border-b border-sky-100 dark:border-sky-800">
        <span class="flex-1 min-w-0">
          {{ off.sincronizando() ? 'Subiendo' : 'Pendientes de subir:' }}
          <span class="font-semibold tabular-nums">{{ off.pendientes().length }}</span>
          {{ off.pendientes().length === 1 ? 'cambio' : 'cambios' }}{{ off.sincronizando() ? '…' : '' }}
        </span>
        @if (!off.sincronizando()) {
          <button type="button" (click)="off.sincronizar()" class="px-3 py-1 text-xs font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700">Subir ahora</button>
        }
      </div>
    }

    @if (off.fallidos().length) {
      <div class="px-4 lg:px-7 py-2.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-900 dark:text-red-200 border-b border-red-200 dark:border-red-800">
        <p class="font-semibold mb-1">
          {{ off.fallidos().length === 1 ? 'Un cambio no se pudo subir' : off.fallidos().length + ' cambios no se pudieron subir' }}
        </p>
        <ul class="space-y-1.5">
          @for (f of off.fallidos(); track f.id) {
            <li class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span class="flex-1 min-w-0 text-xs">
                <span class="font-medium">{{ f.descripcion }}</span>
                · {{ f.creadoEn | date:'dd/MM/yy HH:mm' }}
                @if (f.error) { · <span class="opacity-80">{{ f.error }}</span> }
              </span>
              <button type="button" (click)="off.descartar(f)" class="px-2.5 py-1 text-xs rounded-lg border border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-800/40">Descartar</button>
            </li>
          }
        </ul>
      </div>
    }

    @if (off.aviso(); as a) {
      <div role="status" aria-live="polite"
        class="fixed z-[55] left-4 right-4 sm:left-auto sm:right-6 bottom-4 sm:bottom-6 sm:max-w-sm px-4 py-3 rounded-xl shadow-lg text-sm text-white"
        [class]="a.tipo === 'ok' ? 'bg-green-600' : a.tipo === 'error' ? 'bg-red-600' : 'bg-slate-800'">
        {{ a.texto }}
      </div>
    }
  `,
})
export class OfflineBannerComponent {
  readonly off = inject(OfflineService);
  private auth = inject(AuthService);
  private sw = inject(SwUpdate);

  readonly nuevaVersion = signal(false);
  readonly verificando = signal(false);
  private descargadoPara = '';

  constructor() {
    if (this.sw.isEnabled) {
      this.sw.versionUpdates.subscribe(ev => { if (ev.type === 'VERSION_READY') this.nuevaVersion.set(true); });
      setInterval(() => this.sw.checkForUpdate().catch(() => {}), 15 * 60 * 1000);
    }

    // Al entrar (o cambiar de usuario) con conexión: subir lo pendiente y guardar los datos para uso sin conexión.
    effect(() => {
      const uid = this.auth.user()?.id || '';
      if (!uid || uid === this.descargadoPara || !this.off.enLinea()) return;
      this.descargadoPara = uid;
      this.off.refrescarOutbox().then(() => this.off.sincronizar());
      this.off.descargarDatos();
    });
  }

  async reintentar() {
    this.verificando.set(true);
    const ok = await this.off.verificarConexion();
    this.verificando.set(false);
    if (!ok) this.off.avisar('Todavía no hay conexión con el servidor.', 'error');
  }

  actualizar() {
    this.sw.activateUpdate().then(() => document.location.reload());
  }
}
