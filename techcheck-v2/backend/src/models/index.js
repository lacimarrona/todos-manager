'use strict';

const Workspace         = require('./Workspace');
const Usuario           = require('./Usuario');
const UsuarioWorkspace  = require('./UsuarioWorkspace');
const RefreshToken      = require('./RefreshToken');
const Proyecto          = require('./Proyecto');
const Plantilla         = require('./Plantilla');
const ItemPlantilla     = require('./ItemPlantilla');
const Equipo            = require('./Equipo');
const ItemEquipo        = require('./ItemEquipo');
const ArchivoGuia       = require('./ArchivoGuia');
const Revision          = require('./Revision');
const ItemRevision      = require('./ItemRevision');
const ArchivoRevision   = require('./ArchivoRevision');
const TareaProgramada   = require('./TareaProgramada');
const Tecnico           = require('./Tecnico');
const ArchivoObsGeneral = require('./ArchivoObsGeneral');
const ProyectoPermiso   = require('./ProyectoPermiso');

// ── Workspace ↔ Usuario (FK primario = workspace activo) ─────────────────────
Workspace.hasMany(Usuario,   { foreignKey: 'workspace_id', as: 'usuarios' });
Usuario.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'workspace' });

// ── Usuario ↔ Workspace (many-to-many, membresías gestionadas por superadmin) ─
Usuario.belongsToMany(Workspace, {
  through: UsuarioWorkspace, foreignKey: 'usuario_id', otherKey: 'workspace_id', as: 'workspaces',
});
Workspace.belongsToMany(Usuario, {
  through: UsuarioWorkspace, foreignKey: 'workspace_id', otherKey: 'usuario_id', as: 'miembros',
});

// ── Workspace ↔ Proyecto ─────────────────────────────────────────────────────
Workspace.hasMany(Proyecto,   { foreignKey: 'workspace_id', as: 'proyectos' });
Proyecto.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'workspace' });

// ── Workspace ↔ Plantilla ────────────────────────────────────────────────────
Workspace.hasMany(Plantilla,   { foreignKey: 'workspace_id', as: 'plantillas' });
Plantilla.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'workspace' });

// ── Plantilla ↔ ItemPlantilla ────────────────────────────────────────────────
Plantilla.hasMany(ItemPlantilla,    { foreignKey: 'plantilla_id', as: 'items' });
ItemPlantilla.belongsTo(Plantilla,  { foreignKey: 'plantilla_id', as: 'plantilla' });

// ── Plantilla ↔ Equipo ───────────────────────────────────────────────────────
Plantilla.hasMany(Equipo,    { foreignKey: 'plantilla_id', as: 'equipos' });
Equipo.belongsTo(Plantilla,  { foreignKey: 'plantilla_id', as: 'plantilla' });

// ── Usuario ↔ Proyecto (creador) ─────────────────────────────────────────────
Usuario.hasMany(Proyecto,  { foreignKey: 'creado_por', as: 'proyectos_creados' });
Proyecto.belongsTo(Usuario, { foreignKey: 'creado_por', as: 'creador' });

// ── Proyecto ↔ Equipo ────────────────────────────────────────────────────────
Proyecto.hasMany(Equipo,   { foreignKey: 'proyecto_id', as: 'equipos' });
Equipo.belongsTo(Proyecto, { foreignKey: 'proyecto_id', as: 'proyecto' });

// ── Usuario ↔ Equipo (técnico asignado) ──────────────────────────────────────
Usuario.hasMany(Equipo,  { foreignKey: 'tecnico_asignado_id', as: 'equipos_asignados' });
Equipo.belongsTo(Usuario, { foreignKey: 'tecnico_asignado_id', as: 'tecnico_asignado' });

// ── Equipo ↔ ItemEquipo ──────────────────────────────────────────────────────
Equipo.hasMany(ItemEquipo,    { foreignKey: 'equipo_id', as: 'items' });
ItemEquipo.belongsTo(Equipo,  { foreignKey: 'equipo_id', as: 'equipo' });

// ── ItemEquipo ↔ ArchivoGuia ─────────────────────────────────────────────────
ItemEquipo.hasMany(ArchivoGuia,   { foreignKey: 'item_id', as: 'archivos' });
ArchivoGuia.belongsTo(ItemEquipo, { foreignKey: 'item_id', as: 'item' });

// ── Equipo ↔ Revision ────────────────────────────────────────────────────────
Equipo.hasMany(Revision,    { foreignKey: 'equipo_id', as: 'revisiones' });
Revision.belongsTo(Equipo,  { foreignKey: 'equipo_id', as: 'equipo' });

// ── Usuario ↔ Revision (técnico) ─────────────────────────────────────────────
Usuario.hasMany(Revision,    { foreignKey: 'tecnico_id', as: 'revisiones_como_tecnico' });
Revision.belongsTo(Usuario,  { foreignKey: 'tecnico_id', as: 'tecnico' });

// ── Revision ↔ ItemRevision ──────────────────────────────────────────────────
Revision.hasMany(ItemRevision,    { foreignKey: 'revision_id', as: 'items' });
ItemRevision.belongsTo(Revision,  { foreignKey: 'revision_id', as: 'revision' });

// ── ItemEquipo ↔ ItemRevision ─────────────────────────────────────────────────
ItemEquipo.hasMany(ItemRevision,   { foreignKey: 'item_id', as: 'items_revision' });
ItemRevision.belongsTo(ItemEquipo, { foreignKey: 'item_id', as: 'item_equipo' });

// ── ItemRevision ↔ ArchivoRevision ───────────────────────────────────────────
ItemRevision.hasMany(ArchivoRevision,    { foreignKey: 'item_rev_id', as: 'archivos' });
ArchivoRevision.belongsTo(ItemRevision,  { foreignKey: 'item_rev_id', as: 'item_revision' });

// ── Equipo ↔ TareaProgramada ─────────────────────────────────────────────────
Equipo.hasMany(TareaProgramada,    { foreignKey: 'equipo_id', as: 'tareas_programadas' });
TareaProgramada.belongsTo(Equipo,  { foreignKey: 'equipo_id', as: 'equipo' });

// ── Usuario ↔ TareaProgramada (asignado / creador) ───────────────────────────
Usuario.hasMany(TareaProgramada, { foreignKey: 'asignado_a_id', as: 'tareas_asignadas' });
TareaProgramada.belongsTo(Usuario, { foreignKey: 'asignado_a_id', as: 'asignado_a' });
Usuario.hasMany(TareaProgramada, { foreignKey: 'creado_por_id', as: 'tareas_creadas' });
TareaProgramada.belongsTo(Usuario, { foreignKey: 'creado_por_id', as: 'creado_por' });

// ── Usuario ↔ RefreshToken ───────────────────────────────────────────────────
Usuario.hasMany(RefreshToken,   { foreignKey: 'usuario_id', as: 'refresh_tokens' });
RefreshToken.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });

// ── Workspace ↔ Tecnico ──────────────────────────────────────────────────────
Workspace.hasMany(Tecnico,   { foreignKey: 'workspace_id', as: 'tecnicos' });
Tecnico.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'workspace' });

// ── Revision ↔ ArchivoObsGeneral ─────────────────────────────────────────────
Revision.hasMany(ArchivoObsGeneral,    { foreignKey: 'revision_id', as: 'archivos_obs' });
ArchivoObsGeneral.belongsTo(Revision,  { foreignKey: 'revision_id', as: 'revision' });

// ── Proyecto ↔ ProyectoPermiso (acceso por usuario) ──────────────────────────
Proyecto.hasMany(ProyectoPermiso,    { foreignKey: 'proyecto_id', as: 'permisos' });
ProyectoPermiso.belongsTo(Proyecto,  { foreignKey: 'proyecto_id', as: 'proyecto' });
ProyectoPermiso.belongsTo(Usuario,   { foreignKey: 'usuario_id',  as: 'usuario' });
Usuario.hasMany(ProyectoPermiso,     { foreignKey: 'usuario_id',  as: 'permisos_proyecto' });

module.exports = {
  Workspace, Usuario, UsuarioWorkspace, RefreshToken,
  Proyecto, Plantilla, ItemPlantilla,
  Equipo, ItemEquipo, ArchivoGuia,
  Revision, ItemRevision, ArchivoRevision,
  TareaProgramada, Tecnico, ArchivoObsGeneral, ProyectoPermiso,
};
