import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Equipo, ItemEquipo } from '../models/equipo.model';
import { RevisionResumen } from '../models/revision.model';
import { PagedResponse } from './proyecto.service';

export interface CreateEquipoDto {
  proyecto_id: number;
  nombre: string;
  plantilla_id?: number | null;
  tecnico_asignado_id?: number | null;
  tiempo_limite?: number | null;
  items?: { label: string; observacion_guia?: string | null }[];
}

export interface UpdateEquipoDto {
  nombre?: string;
  plantilla_id?: number | null;
  tecnico_asignado_id?: number | null;
  tiempo_limite?: number | null;
}

@Injectable({ providedIn: 'root' })
export class EquipoService {
  private readonly api = inject(ApiService);

  getOne(id: number)               { return this.api.get<Equipo>(`/equipos/${id}`); }
  create(dto: CreateEquipoDto)     { return this.api.post<Equipo>('/equipos', dto); }
  update(id: number, dto: UpdateEquipoDto) { return this.api.put<Equipo>(`/equipos/${id}`, dto); }
  remove(id: number)               { return this.api.delete(`/equipos/${id}`); }
  listRevisiones(equipoId: number, page = 1, limit = 20) {
    return this.api.get<PagedResponse<RevisionResumen>>(`/equipos/${equipoId}/revisiones`, { page: String(page), limit: String(limit) });
  }
  addItem(equipoId: number, label: string, observacion_guia?: string | null) {
    return this.api.post<ItemEquipo>(`/equipos/${equipoId}/items`, { label, observacion_guia: observacion_guia ?? null });
  }
  updateItem(equipoId: number, itemId: number, dto: { label?: string; observacion_guia?: string | null }) {
    return this.api.put<ItemEquipo>(`/equipos/${equipoId}/items/${itemId}`, dto);
  }
  removeItem(equipoId: number, itemId: number) { return this.api.delete(`/equipos/${equipoId}/items/${itemId}`); }
  archivar(id: number) { return this.api.post(`/equipos/${id}/archivar`, {}); }
  importarMasivo(dto: { proyecto_id: number; equipos: { nombre: string }[]; plantilla_id?: number | null; tecnico_asignado_id?: number | null }) {
    return this.api.post<{ message: string; ids: number[] }>('/equipos/importar-masivo', dto);
  }
  exportarJSON(id: number) { return this.api.get<any>(`/equipos/${id}/exportar-json`); }
  exportarCSV(id: number) { return this.api.getBlob(`/equipos/${id}/exportar-csv`); }

  importarExcelNombres(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return this.api.postForm<{ equipos: { nombre: string }[] }>('/equipos/importar-excel-nombres', fd);
  }

  descargarPlantillaExcel() {
    return this.api.getBlob('/equipos/plantilla-excel');
  }
}
