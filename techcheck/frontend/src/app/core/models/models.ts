// ─── PROYECTO ────────────────────────────────────────────────
export interface Proyecto {
  id: string;
  nombre: string;
  descripcion: string;
  creadoEn: string;
  actualizadoEn: string;
  totalEquipos?: number;
}

export interface ProyectoForm {
  nombre: string;
  descripcion: string;
}

// ─── EQUIPO ─────────────────────────────────────────────────
export interface Equipo {
  id: string;
  nombre: string;
  descripcion: string;
  items: string[];
  proyectoIds: string[];
  plantillaId: string | null;
  creadoEn: string;
  actualizadoEn: string;
  ultimaRevision?: Revision | null;
  totalRevisiones?: number;
}

export interface EquipoForm {
  nombre: string;
  descripcion: string;
  items: string[];
  plantillaId?: string;
  proyectoIds?: string[];
}

// ─── PLANTILLA ──────────────────────────────────────────────
export interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string;
  items: string[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface PlantillaForm {
  nombre: string;
  descripcion: string;
  items: string[];
}

// ─── TÉCNICO ────────────────────────────────────────────────
export interface Tecnico {
  id: string;
  nombre: string;
  email: string;
  creadoEn: string;
}

export interface TecnicoForm {
  nombre: string;
  email: string;
}

// ─── REVISION ───────────────────────────────────────────────
export type EstadoRevision = 'ok' | 'observacion' | 'problema';

export interface ItemRevision {
  label: string;
  checked: boolean;
  nota: string;
}

export interface Revision {
  id: string;
  equipoId: string;
  tecnicoId: string | null;
  tecnicoNombre: string;
  estado: EstadoRevision;
  items: ItemRevision[];
  observacionGeneral: string;
  fotos: string[];
  creadoEn: string;
  actualizadoEn: string;
  equipoNombre?: string;
}

export interface RevisionForm {
  equipoId: string;
  tecnicoId?: string;
  tecnicoNombre?: string;
  estado: EstadoRevision;
  items: ItemRevision[];
  observacionGeneral: string;
  fotos: string[];
}

// ─── API RESPONSE ────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}