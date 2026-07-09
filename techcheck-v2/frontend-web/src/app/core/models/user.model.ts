export type UserRole = 'superadmin' | 'admin' | 'usuario';

export interface User {
  id: number;
  workspace_id: number | null;
  nombre: string;
  email: string;
  rol: UserRole;
  activo: boolean;
  createdAt: string;
  workspace?: { id: number; nombre: string } | null;
}
