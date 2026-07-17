export interface TareaUsuario {
  id: number;
  nombre: string;
  email: string;
}

export interface ElementoGrupoRef {
  id: number;
  valor: string;
  descripcion?: string;
}

export interface TareaProgramada {
  id: number;
  equipo_id: number;
  hora: string;
  dias_semana: number[];
  activa: boolean;
  asignado_a_id: number | null;
  creado_por_id: number | null;
  fecha_fin: string | null;
  grupo_elemento_id: number | null;
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
  asignado_a?: TareaUsuario | null;
  creado_por?: TareaUsuario | null;
  createdAt?: string;
}

export interface CreateTareaDto {
  equipo_id: number;
  hora: string;
  dias_semana: number[];
  asignado_a_id?: number | null;
  fecha_fin?: string | null;
}

export interface UpdateTareaDto {
  hora?: string;
  dias_semana?: number[];
  asignado_a_id?: number | null;
  fecha_fin?: string | null;
  activa?: boolean;
}
