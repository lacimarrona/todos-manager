const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/dataAccess');

// GET /api/equipos
router.get('/:id/equipos', (req, res) => {
  try {
    const proyecto = db.getProyectoById(req.params.id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    const equipos = db.getEquipos().filter(e => e.proyectoIds && e.proyectoIds.includes(req.params.id));
    const revisiones = db.getRevisiones();
    const enriquecidos = equipos.map(e => {
      const revsEquipo = revisiones.filter(r => r.equipoId === e.id);
      const ultima = revsEquipo[0] || null;
      return { ...e, ultimaRevision: ultima, totalRevisiones: revsEquipo.length };
    });
    // Solo mostrar equipos cuya ultima revision NO este completa o no tengan revision
    const pendientes = enriquecidos.filter(e => {
      if (!e.ultimaRevision) return true;
      const total = e.items.length;
      if (total === 0) return true;
      const completados = e.ultimaRevision.items.filter((i) => i.checked).length;
      return completados < total;
    });
    res.json({ success: true, data: pendientes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/equipos/:id
router.get('/:id', (req, res) => {
  try {
    const equipo = db.getEquipoById(req.params.id);
    if (!equipo) return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
    res.json({ success: true, data: equipo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/equipos
router.post('/', (req, res) => {
  try {
    const { nombre, descripcion, items, plantillaId, proyectoIds } = req.body;
    if (!nombre) return res.status(400).json({ success: false, message: 'El nombre es requerido' });

    let itemsFinales = items || [];
    if (plantillaId) {
      const plantilla = db.getPlantillaById(plantillaId);
      if (plantilla) itemsFinales = [...plantilla.items, ...itemsFinales];
    }

    const nuevo = {
      id: uuidv4(),
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || '',
      items: itemsFinales,
      plantillaId: plantillaId || null,
      proyectoIds: proyectoIds || [],
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };
    const creado = db.createEquipo(nuevo);
    res.status(201).json({ success: true, data: creado });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/equipos/:id
router.put('/:id', (req, res) => {
  try {
    const { nombre, descripcion, items } = req.body;
    const actualizado = db.updateEquipo(req.params.id, { nombre, descripcion, items });
    if (!actualizado) return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
    res.json({ success: true, data: actualizado });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/equipos/:id
router.delete('/:id', (req, res) => {
  try {
    const eliminado = db.deleteEquipo(req.params.id);
    if (!eliminado) return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
    res.json({ success: true, message: 'Equipo eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
