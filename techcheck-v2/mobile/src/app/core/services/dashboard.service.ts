import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface DashboardStats {
  resumen: {
    total: number;
    terminadas: number;
    en_proceso: number;
    pendientes: number;
    con_problemas: number;
    con_observaciones: number;
    ok: number;
  };
  esta_semana: { total: number; terminadas: number };
  proyectos_total: number;
  equipos_total: number;
  top_tecnicos: { id: number; nombre: string; total: number; terminadas: number }[];
  top_equipos:  { id: number; nombre: string; proyecto: string; total: number; problemas: number }[];
  recientes: {
    id: number; equipo: string; proyecto: string;
    estado: string; calidad: string; tecnico: string; fecha: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  getStats() { return this.api.get<DashboardStats>('/dashboard'); }
}
