import { User } from './user.model';

export type RevisionEstado = 'pendiente' | 'en_proceso' | 'terminado';

export interface ArchivoGuia {
  id: number;
  item_id: number;
  url: string;
  tipo: string;
}

export interface ItemEquipo {
  id: number;
  equipo_id: number;
  label: string;
  observacion_guia: string | null;
  orden: number;
  archivos?: ArchivoGuia[];
}

export interface Equipo {
  id: number;
  proyecto_id: number;
  nombre: string;
  plantilla_id: number | null;
  tecnico_asignado_id: number | null;
  tiempo_limite: number | null;
  archivado: boolean;
  items?: ItemEquipo[];
  tecnico_asignado?: Pick<User, 'id' | 'nombre' | 'email'> | null;
  /** Calculado por el servidor: estado de la última revisión */
  ultimo_estado: RevisionEstado;
  createdAt: string;
}
