export type UserRole = 'superadmin' | 'admin' | 'usuario';

export interface WorkspaceSummary {
  id: number;
  nombre: string;
}

export interface User {
  id: number;
  workspace_id: number | null;
  nombre: string;
  email: string;
  rol: UserRole;
  activo: boolean;
  createdAt: string;
  workspace?: WorkspaceSummary | null;
  workspaces?: WorkspaceSummary[];
}
