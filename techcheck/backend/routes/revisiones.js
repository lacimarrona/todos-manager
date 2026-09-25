const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/dataAccess');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const { id, equipoId, tecnicoId, tecnicoNombre, estado, items, observacionGeneral, fotos, creadoEn } = req.body;
    if (!equipoId) return res.status(400).json({ success: false, message: 'equipoId es requerido' });
    if (!estado) return res.status(400).json({ success: false, message: 'estado es requerido' });

    // Revisiones hechas sin conexión llegan con su id generado en el dispositivo;
    // si el envío se repite, se devuelve la ya creada en vez de duplicarla.
    const idCliente = typeof id === 'string' && UUID_RE.test(id) ? id : null;
    if (idCliente) {
      const existente = db.getRevisionById(idCliente);
      if (existente) return res.status(200).json({ success: true, data: existente });
    }

    const equipo = db.getEquipoById(equipoId);
    if (!equipo) return res.status(404).json({ success: false, message: 'Equipo no encontrado' });

    const fechaCliente = typeof creadoEn === 'string' && !isNaN(Date.parse(creadoEn)) && Date.parse(creadoEn) <= Date.now()
      ? new Date(creadoEn).toISOString()
      : null;

    const nueva = {
      id: idCliente || uuidv4(),
      equipoId,
      tecnicoId: tecnicoId || null,
      tecnicoNombre: tecnicoNombre || '',
      estado, // 'ok' | 'observacion' | 'problema'
      items: items || [],
      observacionGeneral: observacionGeneral?.trim() || '',
      fotos: fotos || [],
      creadoEn: fechaCliente || new Date().toISOString(),
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
    const { estado, items, observacionGeneral, fotos, tecnicoId, tecnicoNombre } = req.body;
    const actualizada = db.updateRevision(req.params.id, { estado, items, observacionGeneral, fotos, tecnicoId, tecnicoNombre });
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
