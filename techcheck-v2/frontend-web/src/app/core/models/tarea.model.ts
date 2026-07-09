export interface TareaProgramada {
  id: number;
  equipo_id: number;
  hora: string;          // "HH:MM:SS"
  dias_semana: number[]; // 0=Sunday … 6=Saturday
  activa: boolean;
  equipo?: {
    id: number;
    nombre: string;
    tecnico_asignado_id?: number | null;
    proyecto?: { id: number; nombre: string; workspace_id: number };
  };
  createdAt?: string;
}
