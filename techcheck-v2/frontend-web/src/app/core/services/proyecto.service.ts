import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Proyecto } from '../models/proyecto.model';
import { Equipo } from '../models/equipo.model';

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

  listEquipos(id: number, estado?: string, incluirArchivados = false) {
    const params: Record<string, string> = {};
    if (estado) params['estado'] = estado;
    if (incluirArchivados) params['incluir_archivados'] = '1';
    return this.api.get<Equipo[]>(`/proyectos/${id}/equipos`, Object.keys(params).length ? params : undefined);
  }

  exportarCSV(id: number) { return this.api.getBlob(`/proyectos/${id}/exportar-csv`); }
  exportarJSON(id: number) { return this.api.get<any>(`/proyectos/${id}/exportar-json`); }
  importarJSON(datos: any) { return this.api.post<{ mensaje: string; proyecto_id: number }>('/proyectos/importar-json', datos); }
}
