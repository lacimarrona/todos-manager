import { Component, signal, inject, effect, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonMenuButton, IonButtons,
  IonSpinner, IonRefresher, IonRefresherContent, IonCard, IonCardContent,
  IonCardHeader, IonCardTitle, IonBadge, IonText, IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, checkmarkCircleOutline, timeOutline, warningOutline } from 'ionicons/icons';
import { DashboardService, DashboardStats } from '../../../core/services/dashboard.service';
import { AuthService } from '../../../core/services/auth.service';

const REFRESH_INTERVAL_MS = 30_000;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonMenuButton, IonButtons,
    IonSpinner, IonRefresher, IonRefresherContent, IonCard, IonCardContent,
    IonCardHeader, IonCardTitle, IonBadge, IonText, IonIcon,
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
    addIcons({ alertCircleOutline, checkmarkCircleOutline, timeOutline, warningOutline });
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

  estadoColor(e: string): string {
    return e === 'terminado' ? 'success' : e === 'en_proceso' ? 'warning' : 'medium';
  }

  estadoLabel(e: string): string {
    return e === 'terminado' ? 'Terminado' : e === 'en_proceso' ? 'En proceso' : 'Pendiente';
  }

  calidadColor(c: string): string {
    return c === 'problema' ? 'danger' : c === 'observacion' ? 'warning' : 'success';
  }

  calidadLabel(c: string): string {
    return c === 'problema' ? 'Problema' : c === 'observacion' ? 'Observación' : 'OK';
  }
}
