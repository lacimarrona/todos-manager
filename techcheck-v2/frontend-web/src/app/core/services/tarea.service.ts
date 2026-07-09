import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { TareaProgramada } from '../models/tarea.model';

@Injectable({ providedIn: 'root' })
export class TareaService {
  private readonly api = inject(ApiService);

  list(equipoId?: number) {
    return this.api.get<TareaProgramada[]>(
      '/tareas-programadas',
      equipoId ? { equipo_id: equipoId } : undefined,
    );
  }

  create(dto: { equipo_id: number; hora: string; dias_semana: number[] }) {
    return this.api.post<TareaProgramada>('/tareas-programadas', dto);
  }

  update(id: number, dto: { hora?: string; dias_semana?: number[] }) {
    return this.api.put<TareaProgramada>(`/tareas-programadas/${id}`, dto);
  }

  remove(id: number) { return this.api.delete(`/tareas-programadas/${id}`); }

  toggle(id: number) { return this.api.patch<TareaProgramada>(`/tareas-programadas/${id}/toggle`); }
}
