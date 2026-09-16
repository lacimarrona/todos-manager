const db = require('../db/dataAccess');

// Solo el admin puede ejecutar esta acción
function soloAdmin(req, res, next) {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ success: false, message: 'Solo el administrador puede realizar esta acción' });
  }
  next();
}

// Admin o project_admin (sin filtrar por proyecto específico)
function adminOProjectAdmin(req, res, next) {
  if (req.user.rol === 'admin' || req.user.rol === 'project_admin') return next();
  return res.status(403).json({ success: false, message: 'Sin permisos para esta acción' });
}

// Verifica que el usuario (project_admin o técnico con permiso 'editar') tiene acceso al proyecto
// El admin siempre pasa. El técnico sin permiso elevado → 403.
function verificarAccesoProyecto(req, res, next) {
  if (req.user.rol === 'admin') return next();

  const proyectoId = req.params.id || req.params.proyectoId || req.body?.proyectoId;
  if (!proyectoId) return next();

  if (req.user.rol === 'project_admin') {
    if (!db.tieneAccesoAProyecto(req.user.sub, proyectoId)) {
      return res.status(403).json({ success: false, message: 'No tienes acceso a este proyecto' });
    }
  } else if (req.user.rol === 'tecnico') {
    // Técnico con permiso 'editar' en el proyecto puede actuar como project_admin en ese proyecto
    const elevados = db.getPermisosElevadosTecnico(req.user.sub);
    if (!elevados.includes(proyectoId)) {
      return res.status(403).json({ success: false, message: 'Sin permisos en este proyecto' });
    }
  }

  next();
}

// Inyecta req.proyectosIds: lista de IDs de proyectos visibles para el usuario
// Admin → null (sin filtro), project_admin → sus asignados, tecnico → solo los suyos
function inyectarProyectosVisibles(req, res, next) {
  if (req.user.rol === 'admin') {
    req.proyectosIds = null; // sin filtro
  } else if (req.user.rol === 'project_admin') {
    req.proyectosIds = db.getProyectosDeUsuario(req.user.sub).map(p => p.id);
  } else {
    // técnico: solo ve los proyectos donde tiene permisos asignados
    const permisos = db.getPermisosDelTecnico(req.user.sub);
    req.proyectosIds = permisos.map(p => p.proyectoId);
  }
  next();
}

module.exports = { soloAdmin, adminOProjectAdmin, verificarAccesoProyecto, inyectarProyectosVisibles };
