import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Equipo, ItemEquipo, ArchivoGuia } from '../models/equipo.model';
import { RevisionResumen } from '../models/revision.model';

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

export interface ImportarMasivoDto {
  proyecto_id: number;
  equipos: { nombre: string }[];
  plantilla_id?: number | null;
}

export interface ImportarMasivoResult {
  message: string;
  ids: number[];
}

@Injectable({ providedIn: 'root' })
export class EquipoService {
  private readonly api = inject(ApiService);

  getOne(id: number)               { return this.api.get<Equipo>(`/equipos/${id}`); }
  create(dto: CreateEquipoDto)     { return this.api.post<Equipo>('/equipos', dto); }
  update(id: number, dto: UpdateEquipoDto) { return this.api.put<Equipo>(`/equipos/${id}`, dto); }
  remove(id: number)               { return this.api.delete(`/equipos/${id}`); }
  archivar(id: number)             { return this.api.post<{ message: string }>(`/equipos/${id}/archivar`, {}); }
  importarMasivo(dto: ImportarMasivoDto) { return this.api.post<ImportarMasivoResult>('/equipos/importar-masivo', dto); }
  importarExcelNombres(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return this.api.postForm<{ equipos: { nombre: string }[] }>('/equipos/importar-excel-nombres', fd);
  }
  descargarPlantillaExcel() { return this.api.getBlob('/equipos/plantilla-excel'); }

  listRevisiones(equipoId: number) {
    return this.api.get<RevisionResumen[]>(`/equipos/${equipoId}/revisiones`);
  }

  addItem(equipoId: number, label: string, observacion_guia?: string | null) {
    return this.api.post<ItemEquipo>(`/equipos/${equipoId}/items`, { label, observacion_guia: observacion_guia ?? null });
  }
  updateItem(equipoId: number, itemId: number, dto: { label?: string; observacion_guia?: string | null }) {
    return this.api.put<ItemEquipo>(`/equipos/${equipoId}/items/${itemId}`, dto);
  }
  removeItem(equipoId: number, itemId: number) {
    return this.api.delete(`/equipos/${equipoId}/items/${itemId}`);
  }
  addArchivoGuia(equipoId: number, itemId: number, dto: { url: string; tipo: string }) {
    return this.api.post<ArchivoGuia>(`/equipos/${equipoId}/items/${itemId}/archivos`, dto);
  }
  removeArchivoGuia(equipoId: number, itemId: number, archivoId: number) {
    return this.api.delete(`/equipos/${equipoId}/items/${itemId}/archivos/${archivoId}`);
  }
}
