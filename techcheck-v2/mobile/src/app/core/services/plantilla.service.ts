import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Plantilla, ItemPlantilla } from '../models/plantilla.model';

@Injectable({ providedIn: 'root' })
export class PlantillaService {
  private readonly api = inject(ApiService);

  list()             { return this.api.get<Plantilla[]>('/plantillas'); }
  getOne(id: number) { return this.api.get<Plantilla>(`/plantillas/${id}`); }

  create(dto: { nombre: string; descripcion?: string; items?: { label: string; orden?: number }[] }) {
    return this.api.post<Plantilla>('/plantillas', dto);
  }

  update(id: number, dto: { nombre?: string; descripcion?: string }) {
    return this.api.put<Plantilla>(`/plantillas/${id}`, dto);
  }

  remove(id: number) { return this.api.delete(`/plantillas/${id}`); }

  addItem(plantillaId: number, dto: { label: string }) {
    return this.api.post<ItemPlantilla>(`/plantillas/${plantillaId}/items`, dto);
  }

  updateItem(plantillaId: number, itemId: number, dto: { label?: string; orden?: number }) {
    return this.api.put<ItemPlantilla>(`/plantillas/${plantillaId}/items/${itemId}`, dto);
  }

  removeItem(plantillaId: number, itemId: number) {
    return this.api.delete(`/plantillas/${plantillaId}/items/${itemId}`);
  }

  importarExcel(file: File) {
    const fd = new FormData();
    fd.append('archivo', file);
    return this.api.postForm<{ items: string[]; count: number }>('/plantillas/importar-excel', fd);
  }

  aplicar(plantillaId: number, dto: { equipo_id: number; modo: 'reemplazar' | 'agregar' }) {
    return this.api.post<{ message: string }>(`/plantillas/${plantillaId}/aplicar`, dto);
  }
}
