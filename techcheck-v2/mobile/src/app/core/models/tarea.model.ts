export interface ElementoGrupoRef {
  id: number;
  valor: string;
  descripcion?: string;
}

export interface TareaProgramada {
  id: number;
  equipo_id: number;
  hora: string;          // "HH:MM:SS"
  dias_semana: number[]; // 0=Sunday … 6=Saturday
  activa: boolean;
  grupo_elemento_id?: number | null;
  equipo?: {
    id: number;
    nombre: string;
    tecnico_asignado_id?: number | null;
    proyecto?: { id: number; nombre: string; workspace_id: number };
  };
  grupo_elemento?: {
    id: number;
    nombre: string;
    elementos?: ElementoGrupoRef[];
  } | null;
  createdAt?: string;
}
