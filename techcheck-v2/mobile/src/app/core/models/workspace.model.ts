import { User } from './user.model';

export interface Workspace {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  usuarios?: Pick<User, 'id' | 'nombre' | 'email' | 'rol'>[];
  createdAt: string;
}
