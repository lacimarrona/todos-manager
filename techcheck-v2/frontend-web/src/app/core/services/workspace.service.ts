import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Workspace } from '../models/workspace.model';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly api = inject(ApiService);

  list()                  { return this.api.get<Workspace[]>('/admin/workspaces'); }
  getOne(id: number)      { return this.api.get<Workspace>(`/admin/workspaces/${id}`); }

  create(dto: { nombre: string; descripcion?: string }) {
    return this.api.post<Workspace>('/admin/workspaces', dto);
  }

  update(id: number, dto: { nombre?: string; descripcion?: string; activo?: boolean }) {
    return this.api.put<Workspace>(`/admin/workspaces/${id}`, dto);
  }

  remove(id: number) { return this.api.delete(`/admin/workspaces/${id}`); }

  assignAdmin(id: number, dto: { nombre: string; email: string; password: string }) {
    return this.api.post<User>(`/admin/workspaces/${id}/admins`, dto);
  }

  listDisponibles() {
    return this.api.get<User[]>('/admin/usuarios/disponibles');
  }

  assignExisting(workspaceId: number, userId: number) {
    return this.api.put<User>(`/admin/workspaces/${workspaceId}/admins`, { userId });
  }
}
