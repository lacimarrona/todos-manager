const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/dataAccess');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// Requiere auth + al menos rol project_admin
router.use(auth, roles('admin', 'project_admin'));

const clean = u => ({ id: u.id, nombre: u.nombre, username: u.username, rol: u.rol, activo: u.activo, creadoEn: u.creadoEn });

// GET /api/usuarios
// admin ve todos; project_admin solo ve sus técnicos (los que le fueron asignados)
router.get('/', (req, res) => {
  try {
    let usuarios;
    if (req.user.rol === 'project_admin') {
      // Solo los técnicos que pertenecen a este project_admin
      usuarios = db.getTecnicosDelSupervisor(req.user.sub);
    } else {
      usuarios = db.getUsuarios();
    }
    res.json({ success: true, data: usuarios.map(clean) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/usuarios
// admin puede crear admin/project_admin/tecnico; project_admin solo puede crear tecnico
// Al crear un técnico como project_admin, se auto-asigna a él mismo como supervisor
router.post('/', async (req, res) => {
  try {
    const { nombre, username, password, rol } = req.body;
    if (!nombre || !username || !password) {
      return res.status(400).json({ success: false, message: 'Nombre, nombre de usuario y contraseña son requeridos' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const existe = db.getUsuarioByUsername(username.trim().toLowerCase());
    if (existe) {
      return res.status(400).json({ success: false, message: 'Ya existe un usuario con ese nombre de usuario' });
    }

    let rolFinal = 'tecnico';
    if (req.user.rol === 'admin') {
      rolFinal = ['admin', 'project_admin', 'tecnico'].includes(rol) ? rol : 'tecnico';
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const nuevo = {
      id: uuidv4(),
      nombre: nombre.trim(),
      username: username.trim().toLowerCase(),
      passwordHash,
      rol: rolFinal,
      activo: true,
      creadoEn: new Date().toISOString(),
    };

    const creado = db.createUsuario(nuevo);

    // Si un project_admin crea un técnico, auto-asignarlo como su supervisor
    if (req.user.rol === 'project_admin' && rolFinal === 'tecnico') {
      db.asignarTecnicoASupervisor(creado.id, req.user.sub);
    }

    res.status(201).json({ success: true, data: clean(creado) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/usuarios/:id — admin edita cualquier campo; project_admin edita campos básicos de sus técnicos
router.put('/:id', async (req, res) => {
  try {
    const usuario = db.getUsuarioById(req.params.id);
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    // project_admin: solo puede editar sus propios técnicos, y solo campos básicos (no rol)
    if (req.user.rol === 'project_admin') {
      const esSuTecnico = db.getTecnicosDelSupervisor(req.user.sub).some(t => t.id === req.params.id);
      if (!esSuTecnico) {
        return res.status(403).json({ success: false, message: 'Solo puedes editar tus propios técnicos' });
      }
      const { nombre, username, activo, password } = req.body;
      const patch = {};
      if (nombre !== undefined)   patch.nombre   = nombre.trim();
      if (username !== undefined) patch.username = username.trim().toLowerCase();
      if (activo !== undefined)   patch.activo   = !!activo;
      if (password) {
        if (password.length < 8) return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
        patch.passwordHash = await bcrypt.hash(password, 12);
      }
      return res.json({ success: true, data: clean(db.updateUsuario(req.params.id, patch)) });
    }

    // Solo admin llega aquí
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'Sin acceso' });
    }
    const { nombre, username, rol, activo, password } = req.body;
    const patch = {};
    if (nombre !== undefined)   patch.nombre   = nombre.trim();
    if (username !== undefined) patch.username = username.trim().toLowerCase();
    if (rol !== undefined)      patch.rol      = ['admin', 'project_admin', 'tecnico'].includes(rol) ? rol : usuario.rol;
    if (activo !== undefined)   patch.activo   = !!activo;
    if (password) {
      if (password.length < 8) return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
      patch.passwordHash = await bcrypt.hash(password, 12);
    }
    res.json({ success: true, data: clean(db.updateUsuario(req.params.id, patch)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/usuarios/:id/permisos-proyectos — proyectos asignados a un técnico con su nivel
router.get('/:id/permisos-proyectos', (req, res) => {
  try {
    const usuario = db.getUsuarioById(req.params.id);
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    // project_admin solo puede ver permisos de sus propios técnicos
    if (req.user.rol === 'project_admin') {
      const esSuTecnico = db.getTecnicosDelSupervisor(req.user.sub).some(t => t.id === req.params.id);
      if (!esSuTecnico) return res.status(403).json({ success: false, message: 'Sin acceso' });
    }
    const permisos = db.getPermisosDelTecnico(req.params.id);
    res.json({ success: true, data: permisos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/usuarios/:id/permisos-proyectos — establece proyectos asignados al técnico con su nivel
router.put('/:id/permisos-proyectos', (req, res) => {
  try {
    const usuario = db.getUsuarioById(req.params.id);
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    // project_admin solo puede gestionar permisos de sus propios técnicos y solo en sus propios proyectos
    if (req.user.rol === 'project_admin') {
      const esSuTecnico = db.getTecnicosDelSupervisor(req.user.sub).some(t => t.id === req.params.id);
      if (!esSuTecnico) return res.status(403).json({ success: false, message: 'Sin acceso' });
      const susProyectos = db.getProyectosDeUsuario(req.user.sub).map(p => p.id);
      const permisos = (req.body.permisos || []).filter(p => susProyectos.includes(p.proyectoId));
      // Pasar scope para que solo modifique los proyectos de este project_admin
      db.setPermisosDelTecnico(req.params.id, permisos, susProyectos);
    } else {
      db.setPermisosDelTecnico(req.params.id, req.body.permisos || []);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/usuarios/:id/proyectos — proyectos asignados a un project_admin (solo admin)
router.get('/:id/proyectos', (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'Solo el administrador puede ver asignaciones' });
    }
    const proyectos = db.getProyectosDeUsuario(req.params.id);
    res.json({ success: true, data: proyectos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/usuarios/:id/supervisores — project_admins asignados a un técnico (solo admin)
router.get('/:id/supervisores', (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'Solo el administrador puede ver supervisores' });
    }
    const supervisores = db.getSupervisoresDelTecnico(req.params.id);
    res.json({ success: true, data: supervisores.map(clean) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/usuarios/:id/supervisores — asignar un project_admin como supervisor de un técnico (solo admin)
router.post('/:id/supervisores', (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'Solo el administrador puede gestionar supervisores' });
    }
    const { supervisorId } = req.body;
    if (!supervisorId) return res.status(400).json({ success: false, message: 'supervisorId requerido' });
    const supervisor = db.getUsuarioById(supervisorId);
    if (!supervisor || supervisor.rol !== 'project_admin') {
      return res.status(400).json({ success: false, message: 'El supervisor debe ser un administrador de proyectos' });
    }
    db.asignarTecnicoASupervisor(req.params.id, supervisorId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/usuarios/:id/supervisores/:supervisorId — quitar supervisor de un técnico (solo admin)
router.delete('/:id/supervisores/:supervisorId', (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'Solo el administrador puede gestionar supervisores' });
    }
    db.desasignarTecnicoASupervisor(req.params.id, req.params.supervisorId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/usuarios/:id/tareas — tareas asignadas al técnico (admin o su project_admin)
router.get('/:id/tareas', (req, res) => {
  try {
    if (req.user.rol === 'project_admin') {
      const esSuTecnico = db.getTecnicosDelSupervisor(req.user.sub).some(t => t.id === req.params.id);
      if (!esSuTecnico) return res.status(403).json({ success: false, message: 'Sin acceso' });
    }
    res.json({ success: true, data: db.getTareasDeTecnico(req.params.id) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/usuarios/:id/equipos-disponibles — equipos de los proyectos asignados al técnico
router.get('/:id/equipos-disponibles', (req, res) => {
  try {
    if (req.user.rol === 'project_admin') {
      const esSuTecnico = db.getTecnicosDelSupervisor(req.user.sub).some(t => t.id === req.params.id);
      if (!esSuTecnico) return res.status(403).json({ success: false, message: 'Sin acceso' });
    }
    res.json({ success: true, data: db.getEquiposDelTecnico(req.params.id) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/usuarios/:id/permisos-especiales — permisos especiales de un técnico
router.get('/:id/permisos-especiales', (req, res) => {
  try {
    const usuario = db.getUsuarioById(req.params.id);
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (req.user.rol === 'project_admin') {
      const esSuTecnico = db.getTecnicosDelSupervisor(req.user.sub).some(t => t.id === req.params.id);
      if (!esSuTecnico) return res.status(403).json({ success: false, message: 'Sin acceso' });
    }
    res.json({ success: true, data: db.getPermisosEspeciales(req.params.id) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/usuarios/:id/permisos-especiales — establece permisos especiales de un técnico
router.put('/:id/permisos-especiales', (req, res) => {
  try {
    const usuario = db.getUsuarioById(req.params.id);
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (usuario.rol !== 'tecnico') {
      return res.status(400).json({ success: false, message: 'Los permisos especiales solo aplican a técnicos' });
    }
    if (req.user.rol === 'project_admin') {
      const esSuTecnico = db.getTecnicosDelSupervisor(req.user.sub).some(t => t.id === req.params.id);
      if (!esSuTecnico) return res.status(403).json({ success: false, message: 'Sin acceso' });
    }
    db.setPermisosEspeciales(req.params.id, req.body.permisos || []);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/usuarios/:id — solo admin
router.delete('/:id', (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'Solo el administrador puede eliminar usuarios' });
    }
    if (req.params.id === req.user.sub) {
      return res.status(400).json({ success: false, message: 'No puedes eliminarte a ti mismo' });
    }
    const eliminado = db.deleteUsuario(req.params.id);
    if (!eliminado) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
