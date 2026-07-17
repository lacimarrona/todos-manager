import { Component, signal, inject, effect, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonMenuButton, IonButtons,
  IonSpinner, IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';
import { DashboardService, DashboardStats } from '../../../core/services/dashboard.service';
import { AuthService } from '../../../core/services/auth.service';

const REFRESH_INTERVAL_MS = 30_000;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonMenuButton, IonButtons,
    IonSpinner, IonRefresher, IonRefresherContent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  private readonly svc     = inject(DashboardService);
  private readonly auth    = inject(AuthService);
  private readonly destroy = inject(DestroyRef);

  readonly stats   = signal<DashboardStats | null>(null);
  readonly loading = signal(true);
  readonly error   = signal('');

  constructor() {
    effect(() => {
      this.auth.user();
      this.load();
    });

    const timer = setInterval(() => this.load(), REFRESH_INTERVAL_MS);
    this.destroy.onDestroy(() => clearInterval(timer));
  }

  load(event?: { target: { complete: () => void } }) {
    this.loading.set(true);
    this.error.set('');
    this.svc.getStats().subscribe({
      next: data => { this.stats.set(data); this.loading.set(false); event?.target.complete(); },
      error: ()  => { this.error.set('Error al cargar estadísticas'); this.loading.set(false); event?.target.complete(); },
    });
  }

  pct(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }

  estadoLabel(e: string): string {
    return e === 'terminado' ? 'Terminado' : e === 'en_proceso' ? 'En proceso' : 'Pendiente';
  }

  estadoClass(e: string): string {
    return e === 'terminado' ? 'badge-ok' : e === 'en_proceso' ? 'badge-proceso' : 'badge-pendiente';
  }

  calidadClass(c: string): string {
    return c === 'problema' ? 'badge-problema' : c === 'observacion' ? 'badge-obs' : 'badge-ok';
  }

  calidadLabel(c: string): string {
    return c === 'problema' ? 'Problema' : c === 'observacion' ? 'Observación' : 'OK';
  }
}
