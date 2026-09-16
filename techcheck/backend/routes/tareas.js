const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/dataAccess');

// GET /api/tareas
router.get('/', (req, res) => {
  try {
    if (req.user.rol !== 'tecnico') {
      return res.json({ success: true, data: db.getTareas() });
    }

    const permisos = db.getPermisosDelTecnico(req.user.sub);
    if (!permisos.length) {
      return res.json({ success: true, data: [] });
    }

    const vistas = new Map();
    for (const permiso of permisos) {
      const lista = permiso.nivel === 'ver'
        ? db.getTareasDeProyecto(permiso.proyectoId)
        : db.getTareasDeTecnicoEnProyecto(req.user.sub, permiso.proyectoId);
      for (const t of lista) {
        if (!vistas.has(t.id)) vistas.set(t.id, t);
      }
    }

    res.json({ success: true, data: [...vistas.values()] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/tareas/:id
router.get('/:id', (req, res) => {
  try {
    const tarea = db.getTareaById(req.params.id);
    if (!tarea) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
    res.json({ success: true, data: tarea });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/tareas
router.post('/', (req, res) => {
  try {
    // técnico necesita permiso especial asignar_tareas
    if (req.user.rol === 'tecnico' && !db.tienePemisoEspecial(req.user.sub, 'asignar_tareas')) {
      return res.status(403).json({ success: false, message: 'Sin permiso para programar tareas' });
    }
    const { equipoId, tecnicoId, hora, diasSemana, activa, fechaFin } = req.body;
    if (!equipoId) return res.status(400).json({ success: false, message: 'equipoId es requerido' });
    if (!diasSemana || !diasSemana.length) return res.status(400).json({ success: false, message: 'diasSemana es requerido' });

    const equipo = db.getEquipoById(equipoId);
    if (!equipo) return res.status(404).json({ success: false, message: 'Equipo no encontrado' });

    const nueva = db.createTarea({
      id: uuidv4(),
      equipoId,
      tecnicoId: tecnicoId || null,
      hora: hora || '',
      diasSemana,
      activa: activa !== false,
      fechaFin: fechaFin || null,
    });
    res.status(201).json({ success: true, data: nueva });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/tareas/:id
router.put('/:id', (req, res) => {
  try {
    const tarea = db.getTareaById(req.params.id);
    if (!tarea) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
    const { hora, diasSemana, tecnicoId, activa, fechaFin } = req.body;
    const actualizada = db.updateTarea(req.params.id, { hora, diasSemana, tecnicoId, activa, fechaFin });
    res.json({ success: true, data: actualizada });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/tareas/:id/toggle
router.put('/:id/toggle', (req, res) => {
  try {
    const tarea = db.getTareaById(req.params.id);
    if (!tarea) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
    const actualizada = db.updateTarea(req.params.id, { activa: !tarea.activa });
    res.json({ success: true, data: actualizada });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/tareas/:id
router.delete('/:id', (req, res) => {
  try {
    const eliminada = db.deleteTarea(req.params.id);
    if (!eliminada) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
    res.json({ success: true, message: 'Tarea eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
