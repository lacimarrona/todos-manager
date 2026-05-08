const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/dataAccess');

router.get('/', (req, res) => {
  try {
    const proyectos = db.getProyectos();
    const equipos = db.getEquipos();
    const enriquecidos = proyectos.map(p => ({
      ...p,
      totalEquipos: equipos.filter(e => e.proyectoIds && e.proyectoIds.includes(p.id)).length
    }));
    res.json({ success: true, data: enriquecidos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const proyecto = db.getProyectoById(req.params.id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    res.json({ success: true, data: proyecto });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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
    res.json({ success: true, data: enriquecidos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre) return res.status(400).json({ success: false, message: 'El nombre es requerido' });
    const nuevo = {
      id: uuidv4(),
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || '',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };
    res.status(201).json({ success: true, data: db.createProyecto(nuevo) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    const actualizado = db.updateProyecto(req.params.id, { nombre, descripcion });
    if (!actualizado) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    res.json({ success: true, data: actualizado });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const eliminado = db.deleteProyecto(req.params.id);
    if (!eliminado) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    res.json({ success: true, message: 'Proyecto eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;