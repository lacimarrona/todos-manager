import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface ElementoGrupo {
  id: number;
  grupo_id: number;
  valor: string;
  descripcion?: string;
  activo: boolean;
}

export interface GrupoElemento {
  id: number;
  workspace_id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  elementos?: ElementoGrupo[];
}

@Injectable({ providedIn: 'root' })
export class GrupoElementoService {
  private readonly api = inject(ApiService);

  listGrupos()                                     { return this.api.get<GrupoElemento[]>('/grupos-elementos'); }
  getGrupo(id: number)                             { return this.api.get<GrupoElemento>(`/grupos-elementos/${id}`); }
  createGrupo(dto: Partial<GrupoElemento>)         { return this.api.post<GrupoElemento>('/grupos-elementos', dto); }
  updateGrupo(id: number, dto: Partial<GrupoElemento>) { return this.api.put<GrupoElemento>(`/grupos-elementos/${id}`, dto); }
  deleteGrupo(id: number)                          { return this.api.delete(`/grupos-elementos/${id}`); }

  listElementos(grupoId: number)                              { return this.api.get<ElementoGrupo[]>(`/grupos-elementos/${grupoId}/elementos`); }
  createElemento(grupoId: number, dto: Partial<ElementoGrupo>){ return this.api.post<ElementoGrupo>(`/grupos-elementos/${grupoId}/elementos`, dto); }
  updateElemento(grupoId: number, id: number, dto: Partial<ElementoGrupo>) { return this.api.put<ElementoGrupo>(`/grupos-elementos/${grupoId}/elementos/${id}`, dto); }
  deleteElemento(grupoId: number, id: number)                 { return this.api.delete(`/grupos-elementos/${grupoId}/elementos/${id}`); }
}
