const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/dataAccess');

// GET /api/revisiones?equipoId=&tecnicoId=&estado=
router.get('/', (req, res) => {
  try {
    const { equipoId, tecnicoId, estado } = req.query;
    const filtros = {};
    if (equipoId) filtros.equipoId = equipoId;
    if (tecnicoId) filtros.tecnicoId = tecnicoId;
    if (estado) filtros.estado = estado;
    const revisiones = db.getRevisiones(filtros);
    // Enriquecer con nombre del equipo y técnico
    const equipos = db.getEquipos();
    const tecnicos = db.getTecnicos();
    const enriquecidas = revisiones.map(r => ({
      ...r,
      equipoNombre: equipos.find(e => e.id === r.equipoId)?.nombre || 'Equipo eliminado',
      tecnicoNombre: tecnicos.find(t => t.id === r.tecnicoId)?.nombre || r.tecnicoNombre || 'Sin técnico'
    }));
    res.json({ success: true, data: enriquecidas });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/revisiones/:id
router.get('/:id', (req, res) => {
  try {
    const revision = db.getRevisionById(req.params.id);
    if (!revision) return res.status(404).json({ success: false, message: 'Revisión no encontrada' });
    const equipo = db.getEquipoById(revision.equipoId);
    const tecnico = db.getTecnicoById(revision.tecnicoId);
    res.json({
      success: true,
      data: {
        ...revision,
        equipoNombre: equipo?.nombre || 'Equipo eliminado',
        tecnicoNombre: tecnico?.nombre || revision.tecnicoNombre || 'Sin técnico'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revisiones
router.post('/', (req, res) => {
  try {
    const { equipoId, tecnicoId, tecnicoNombre, estado, items, observacionGeneral, fotos } = req.body;
    if (!equipoId) return res.status(400).json({ success: false, message: 'equipoId es requerido' });
    if (!estado) return res.status(400).json({ success: false, message: 'estado es requerido' });

    const equipo = db.getEquipoById(equipoId);
    if (!equipo) return res.status(404).json({ success: false, message: 'Equipo no encontrado' });

    const nueva = {
      id: uuidv4(),
      equipoId,
      tecnicoId: tecnicoId || null,
      tecnicoNombre: tecnicoNombre || '',
      estado, // 'ok' | 'observacion' | 'problema'
      items: items || [],
      observacionGeneral: observacionGeneral?.trim() || '',
      fotos: fotos || [],
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };

    const creada = db.createRevision(nueva);
    res.status(201).json({ success: true, data: creada });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/revisiones/:id
router.put('/:id', (req, res) => {
  try {
    const { estado, items, observacionGeneral, fotos } = req.body;
    const actualizada = db.updateRevision(req.params.id, { estado, items, observacionGeneral, fotos });
    if (!actualizada) return res.status(404).json({ success: false, message: 'Revisión no encontrada' });
    res.json({ success: true, data: actualizada });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/revisiones/:id
router.delete('/:id', (req, res) => {
  try {
    const eliminada = db.deleteRevision(req.params.id);
    if (!eliminada) return res.status(404).json({ success: false, message: 'Revisión no encontrada' });
    res.json({ success: true, message: 'Revisión eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
