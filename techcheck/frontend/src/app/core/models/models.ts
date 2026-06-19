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

// ─── ARCHIVO ADJUNTO ────────────────────────────────────────
export interface ArchivoAdjunto {
  nombre: string;
  tipo: string;
  data?: string;  // base64 data URL (legado / datos existentes)
  id?: string;    // hash SHA-256 (nuevo)
  url?: string;   // /api/archivos/{hash} (nuevo)
}

// ─── EQUIPO ─────────────────────────────────────────────────

export interface ItemEquipo {
  label: string;
  observacionGuia: string;
  archivosGuia: (ArchivoAdjunto | string)[];
}

export interface Equipo {
  id: string;
  nombre: string;
  descripcion: string;
  items: ItemEquipo[];
  proyectoIds: string[];
  plantillaId: string | null;
  creadoEn: string;
  actualizadoEn: string;
  ultimaRevision?: Revision | null;
  totalRevisiones?: number;
  tecnicoAsignadoId: string | null;
  tecnicoAsignadoNombre?: string;
  archivado?: boolean;
}

export interface EquipoForm {
  nombre: string;
  descripcion: string;
  items: ItemEquipo[];
  plantillaId?: string;
  proyectoIds?: string[];
  tecnicoAsignadoId?: string;
}

// ─── PLANTILLA ──────────────────────────────────────────────
export interface ItemPlantilla {
  label: string;
  observacionGuia: string;
  archivosGuia: (ArchivoAdjunto | string)[];
}

export interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string;
  items: ItemPlantilla[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface PlantillaForm {
  nombre: string;
  descripcion: string;
  items: ItemPlantilla[];
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
  archivos: (ArchivoAdjunto | string)[];
  observacionGuia?: string;
  archivosGuia?: (ArchivoAdjunto | string)[];
}

export interface Revision {
  id: string;
  equipoId: string;
  tecnicoId: string | null;
  tecnicoNombre: string;
  estado: EstadoRevision;
  items: ItemRevision[];
  observacionGeneral: string;
  fotos: (ArchivoAdjunto | string)[];
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
  fotos: (ArchivoAdjunto | string)[];
}

// ─── API RESPONSE ────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}