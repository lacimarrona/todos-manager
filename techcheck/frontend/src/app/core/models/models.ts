// ─── PROYECTO ────────────────────────────────────────────────
export interface Proyecto {
  id: string;
  nombre: string;
  descripcion: string;
  restringido?: boolean;
  creadoEn: string;
  actualizadoEn: string;
  totalEquipos?: number;
}

export interface ProyectoPermiso {
  tecnicoId: string;
  nivel: 'ver' | 'asignados' | 'editar';
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
  tipo?: 'checkbox' | 'catalogo';
  catalogoId?: string;
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
  tarea?: TareaProgramada | null;
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
  tipo?: 'checkbox' | 'catalogo';
  catalogoId?: string;
}

export interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string;
  items: ItemPlantilla[];
  creadoPor?: string | null;
  proyectoIds?: string[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface PlantillaForm {
  nombre: string;
  descripcion: string;
  items: ItemPlantilla[];
  proyectoIds?: string[];
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
export type EstadoItem = 'ok' | 'observacion' | 'problema';

export interface ItemRevision {
  label: string;
  checked: boolean;
  nota: string;
  notas?: string[];
  estado?: EstadoItem | null;
  archivos: (ArchivoAdjunto | string)[];
  observacionGuia?: string;
  archivosGuia?: (ArchivoAdjunto | string)[];
  tipo?: 'checkbox' | 'catalogo';
  catalogoId?: string;
  valor?: string;
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

// ─── TAREAS PROGRAMADAS ──────────────────────────────────────
export type TipoTarea = 'recurrente' | 'fecha_especifica';

export interface TareaProgramada {
  id: string;
  equipoId: string;
  equipoNombre: string;
  tecnicoId: string | null;
  tecnicoNombre: string;
  hora: string;        // HH:MM
  diasSemana: number[]; // 0=domingo … 6=sábado
  activa: boolean;
  fechaFin: string | null;
  tipo: TipoTarea;
  fechaEspecifica: string | null; // YYYY-MM-DD para tipo fecha_especifica
  creadoEn: string;
}

export interface TareaForm {
  equipoId: string;
  tecnicoId?: string;
  hora: string;
  diasSemana: number[];
  activa?: boolean;
  fechaFin?: string;
  tipo?: TipoTarea;
  fechaEspecifica?: string;
}

// ─── DASHBOARD ───────────────────────────────────────────────
export interface DashboardStats {
  totales: {
    proyectos: number;
    equiposActivos: number;
    equiposArchivados: number;
    revisiones: number;
    tecnicos: number;
    revisionesEstaSemana: number;
  };
  equiposPorEstado: {
    ok: number;
    observacion: number;
    problema: number;
    sinRevision: number;
  };
  revisionesPorDia: { fecha: string; total: number }[];
  topTecnicos: { nombre: string; total: number }[];
  topEquipos: { nombre: string; total: number }[];
  ultimasRevisiones: {
    id: string;
    estado: string;
    creadoEn: string;
    tecnicoNombre: string;
    equipoNombre: string;
  }[];
}

// ─── CATÁLOGOS ───────────────────────────────────────────────
export interface ElementoGrupo {
  id: string;
  grupoId: string;
  valor: string;
  descripcion: string;
  activo: boolean;
  creadoEn: string;
}

export interface GrupoElemento {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  creadoEn: string;
  elementos: ElementoGrupo[];
  proyectos?: string[];
}

// ─── TAREA NO CUMPLIDA ───────────────────────────────────────
export interface TareaNoCumplida {
  id: string;
  tareaId: string;
  equipoId: string;
  equipoNombre: string;
  proyectoId: string;
  fecha: string;
  hora: string;
  tecnicoId: string | null;
  tecnicoNombre: string;
  registradoEn: string;
}

// ─── USUARIO ─────────────────────────────────────────────────
export type UserRol = 'admin' | 'project_admin' | 'tecnico';

export interface Usuario {
  id: string;
  nombre: string;
  username: string;
  rol: UserRol;
  activo: boolean;
  creadoEn: string;
}

export interface UsuarioForm {
  nombre: string;
  username: string;
  password?: string;
  rol: UserRol;
  activo?: boolean;
}

export interface ProyectoAsignacion {
  id: string;
  nombre: string;
  username: string;
  rol: UserRol;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: { id: string; nombre: string; username: string; rol: UserRol };
}

// ─── API RESPONSE ────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}