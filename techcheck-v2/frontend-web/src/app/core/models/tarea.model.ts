export interface TareaUsuario {
  id: number;
  nombre: string;
  email: string;
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
  equipo?: {
    id: number;
    nombre: string;
    tecnico_asignado_id?: number | null;
    proyecto?: { id: number; nombre: string; workspace_id: number };
  };
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
