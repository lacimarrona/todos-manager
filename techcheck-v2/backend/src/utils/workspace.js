'use strict';

// Workspace del usuario autenticado para filtrar queries multi-tenant.
// superadmin no pertenece a ningún workspace -> null = sin filtro (ve todo).
function wsId(req) {
  return req.user.rol === 'superadmin' ? null : req.user.workspace_id;
}

// Variante usada en endpoints donde el superadmin puede acotar el listado a un
// workspace puntual vía ?workspace_id=; para el resto de roles se ignora el query
// y siempre se usa su propio workspace.
function wsIdFiltrable(req) {
  return req.user.rol === 'superadmin'
    ? (req.query.workspace_id ? parseInt(req.query.workspace_id) : null)
    : req.user.workspace_id;
}

module.exports = { wsId, wsIdFiltrable };
