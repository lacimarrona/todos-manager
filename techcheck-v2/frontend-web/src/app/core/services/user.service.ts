import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { User, UserRole } from '../models/user.model';

export interface CreateUserDto {
  nombre: string;
  email: string;
  password: string;
  rol: UserRole;
  workspace_id?: number | null;
}

export interface UpdateUserDto {
  nombre?: string;
  email?: string;
  password?: string;
  rol?: UserRole;
  activo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);

  list(workspaceId?: number) {
    const qs = workspaceId ? `?workspace_id=${workspaceId}` : '';
    return this.api.get<User[]>(`/usuarios${qs}`);
  }
  getOne(id: number)   { return this.api.get<User>(`/usuarios/${id}`); }
  create(dto: CreateUserDto)           { return this.api.post<User>('/usuarios', dto); }
  update(id: number, dto: UpdateUserDto) { return this.api.put<User>(`/usuarios/${id}`, dto); }
  remove(id: number)   { return this.api.delete(`/usuarios/${id}`); }
}
