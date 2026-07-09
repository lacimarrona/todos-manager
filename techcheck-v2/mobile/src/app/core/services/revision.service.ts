import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Revision, ItemRevision, ArchivoRevision, ArchivoObsGeneral, CalidadRevision } from '../models/revision.model';

@Injectable({ providedIn: 'root' })
export class RevisionService {
  private readonly api = inject(ApiService);

  getOne(id: number) { return this.api.get<Revision>(`/revisiones/${id}`); }

  create(dto: { equipo_id: number; tecnico_id?: number }) {
    return this.api.post<Revision>('/revisiones', dto);
  }

  update(id: number, dto: { estado?: string; observacion_general?: string | null; estado_calidad?: CalidadRevision | null }) {
    return this.api.put<Revision>(`/revisiones/${id}`, dto);
  }

  updateItem(revisionId: number, itemRevId: number, dto: { checked?: boolean; nota?: string | null }) {
    return this.api.put<ItemRevision>(`/revisiones/${revisionId}/items/${itemRevId}`, dto);
  }

  addArchivo(revisionId: number, itemRevId: number, dto: { url: string; tipo: string }) {
    return this.api.post<ArchivoRevision>(`/revisiones/${revisionId}/items/${itemRevId}/archivos`, dto);
  }

  listByProyecto(proyectoId: number) {
    return this.api.get<Revision[]>(`/revisiones?proyecto_id=${proyectoId}`);
  }

  addArchivoObs(revisionId: number, dto: { url: string; tipo: string }) {
    return this.api.post<ArchivoObsGeneral>(`/revisiones/${revisionId}/archivos-obs`, dto);
  }

  removeArchivoObs(revisionId: number, archivoId: number) {
    return this.api.delete(`/revisiones/${revisionId}/archivos-obs/${archivoId}`);
  }

  remove(id: number) { return this.api.delete(`/revisiones/${id}`); }

  removeArchivo(revisionId: number, itemRevId: number, archivoId: number) {
    return this.api.delete(`/revisiones/${revisionId}/items/${itemRevId}/archivos/${archivoId}`);
  }
}
