import { Component, ElementRef, HostListener, ViewChild, effect } from '@angular/core';
import { ConfirmService } from '../core/services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (svc.actual(); as c) {
      <div class="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" (click)="svc.responder(false)">
        <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-titulo" aria-describedby="confirm-mensaje"
          class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6"
          (click)="$event.stopPropagation()">
          <div class="flex items-start gap-3 mb-5">
            <div class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-lg"
              [class]="c.peligro ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30'">
              {{ c.peligro ? '⚠️' : '❔' }}
            </div>
            <div class="min-w-0">
              <h2 id="confirm-titulo" class="text-base font-semibold text-gray-800 dark:text-gray-100">{{ c.titulo }}</h2>
              <p id="confirm-mensaje" class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ c.mensaje }}</p>
            </div>
          </div>
          <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button #btnCancelar type="button" (click)="svc.responder(false)"
              class="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
              {{ c.textoCancelar || 'Cancelar' }}
            </button>
            <button type="button" (click)="svc.responder(true)"
              class="px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors"
              [class]="c.peligro ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'">
              {{ c.textoConfirmar || 'Aceptar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  @ViewChild('btnCancelar') btnCancelar?: ElementRef<HTMLButtonElement>;

  constructor(public svc: ConfirmService) {
    effect(() => {
      if (svc.actual()) setTimeout(() => this.btnCancelar?.nativeElement.focus());
    });
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.svc.actual()) this.svc.responder(false);
  }
}
