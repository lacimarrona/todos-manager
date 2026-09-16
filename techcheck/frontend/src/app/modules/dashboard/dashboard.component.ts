import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DashboardStats } from '../../core/models/models';
import { DashboardService } from '../../core/services/otros.services';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  stats = signal<DashboardStats | null>(null);
  cargando = signal(true);
  error = signal('');

  constructor(private dashboardSvc: DashboardService) {}

  ngOnInit() {
    this.dashboardSvc.getStats().subscribe({
      next: d => { this.stats.set(d); this.cargando.set(false); },
      error: () => { this.error.set('Error al cargar estadísticas'); this.cargando.set(false); }
    });
  }

  // Altura relativa de cada barra del gráfico (0–100)
  alturaBarras = computed(() => {
    const dias = this.stats()?.revisionesPorDia ?? [];
    const max = Math.max(...dias.map(d => d.total), 1);
    return dias.map(d => ({ ...d, pct: Math.round((d.total / max) * 100) }));
  });

  // Anchura relativa de cada barra horizontal (0–100)
  anchoTopTecnicos = computed(() => {
    const lista = this.stats()?.topTecnicos ?? [];
    const max = Math.max(...lista.map(t => t.total), 1);
    return lista.map(t => ({ ...t, pct: Math.round((t.total / max) * 100) }));
  });

  anchoTopEquipos = computed(() => {
    const lista = this.stats()?.topEquipos ?? [];
    const max = Math.max(...lista.map(t => t.total), 1);
    return lista.map(t => ({ ...t, pct: Math.round((t.total / max) * 100) }));
  });

  totalEquiposConEstado = computed(() => {
    const e = this.stats()?.equiposPorEstado;
    if (!e) return 1;
    return (e.ok + e.observacion + e.problema + e.sinRevision) || 1;
  });

  pctEstado(n: number): number {
    return Math.round((n / this.totalEquiposConEstado()) * 100);
  }

  diaCorto(fecha: string): string {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const d = new Date(fecha + 'T12:00:00');
    return dias[d.getDay()];
  }

  estadoLabel(estado: string): string {
    const map: Record<string, string> = { ok: 'OK', observacion: 'Obs', problema: 'Problema' };
    return map[estado] || estado;
  }

  estadoClass(estado: string): string {
    const map: Record<string, string> = {
      ok: 'bg-green-100 text-green-700',
      observacion: 'bg-yellow-100 text-yellow-700',
      problema: 'bg-red-100 text-red-700',
    };
    return map[estado] || 'bg-gray-100 text-gray-500';
  }
}
