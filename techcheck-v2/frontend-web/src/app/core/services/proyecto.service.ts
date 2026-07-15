import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Proyecto } from '../models/proyecto.model';
import { Equipo } from '../models/equipo.model';

export interface TareaVencida {
  id: string;
  tarea_id: number;
  equipo_id: number;
  equipo_nombre: string;
  fecha_programada: string; // YYYY-MM-DD
  hora: string;
  dias_semana: number[];
  asignado_a: { id: number; nombre: string; email: string } | null;
}

export interface ProyectoPermiso {
  usuario_id: number;
  nivel: 'ver' | 'editar';
  usuario?: { id: number; nombre: string; email: string };
}

export interface ProyectoPermisosResponse {
  proyecto_id: number;
  restringido: boolean;
  permisos: ProyectoPermiso[];
}

export interface PagedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

@Injectable({ providedIn: 'root' })
export class ProyectoService {
  private readonly api = inject(ApiService);

  list()             { return this.api.get<Proyecto[]>('/proyectos'); }
  getOne(id: number) { return this.api.get<Proyecto>(`/proyectos/${id}`); }

  create(dto: { nombre: string; descripcion?: string }) {
    return this.api.post<Proyecto>('/proyectos', dto);
  }
  update(id: number, dto: { nombre?: string; descripcion?: string }) {
    return this.api.put<Proyecto>(`/proyectos/${id}`, dto);
  }
  remove(id: number) { return this.api.delete(`/proyectos/${id}`); }

  listEquipos(id: number, estado?: string, incluirArchivados = false, page = 1, limit = 50) {
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (estado) params['estado'] = estado;
    if (incluirArchivados) params['incluir_archivados'] = '1';
    return this.api.get<PagedResponse<Equipo>>(`/proyectos/${id}/equipos`, params);
  }

  exportarCSV(id: number) { return this.api.getBlob(`/proyectos/${id}/exportar-csv`); }
  exportarJSON(id: number) { return this.api.get<any>(`/proyectos/${id}/exportar-json`); }
  importarJSON(datos: any) { return this.api.post<{ mensaje: string; proyecto_id: number }>('/proyectos/importar-json', datos); }

  getTareasVencidas(id: number) {
    return this.api.get<TareaVencida[]>(`/proyectos/${id}/tareas-vencidas`);
  }

  getPermissions(id: number) {
    return this.api.get<ProyectoPermisosResponse>(`/proyectos/${id}/permisos`);
  }
  updatePermissions(id: number, dto: { restringido?: boolean; permisos?: ProyectoPermiso[] }) {
    return this.api.put<{ message: string; proyecto_id: number }>(`/proyectos/${id}/permisos`, dto);
  }
}
