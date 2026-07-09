export interface Tecnico {
  id: number;
  workspace_id: number;
  nombre: string;
  email: string | null;
  activo: boolean;
  createdAt?: string;
}

export interface TecnicoForm {
  nombre: string;
  email?: string;
}
