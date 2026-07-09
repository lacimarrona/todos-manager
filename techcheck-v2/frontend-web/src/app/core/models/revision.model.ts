import { RevisionEstado } from './equipo.model';
import { User } from './user.model';

export interface ArchivoRevision {
  id: number;
  item_rev_id: number;
  url: string;
  tipo: 'imagen' | 'documento' | string;
}

export interface ItemRevision {
  id: number;
  revision_id: number;
  item_id: number;
  label: string;
  checked: boolean;
  nota: string | null;
  archivos?: ArchivoRevision[];
}

export type CalidadRevision = 'ok' | 'observacion' | 'problema';

export interface ArchivoObsGeneral {
  id: number;
  revision_id: number;
  url: string;
  tipo: 'imagen' | 'documento' | string;
}

export interface Revision {
  id: number;
  equipo_id: number;
  tecnico_id: number | null;
  estado: RevisionEstado;
  estado_calidad: CalidadRevision | null;
  observacion_general: string | null;
  items: ItemRevision[];
  archivos_obs?: ArchivoObsGeneral[];
  tecnico?: Pick<User, 'id' | 'nombre' | 'email'> | null;
  equipo?: { id: number; nombre: string };
  createdAt: string;
  updatedAt: string;
}

export interface RevisionResumen {
  id: number;
  equipo_id: number;
  estado: RevisionEstado;
  estado_calidad?: CalidadRevision | null;
  createdAt: string;
  item_count: number;
  checked_count?: number;
  tecnico?: Pick<User, 'id' | 'nombre'> | null;
}
