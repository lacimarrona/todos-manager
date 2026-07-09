import { User } from './user.model';

export interface Proyecto {
  id: number;
  workspace_id: number;
  nombre: string;
  descripcion: string | null;
  creado_por: number;
  creador?: Pick<User, 'id' | 'nombre'>;
  createdAt: string;
  updatedAt: string;
}
