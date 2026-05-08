const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/dataAccess');

router.get('/', (req, res) => {
  try {
    res.json({ success: true, data: db.getPlantillas() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const p = db.getPlantillaById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    res.json({ success: true, data: p });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { nombre, descripcion, items } = req.body;
    if (!nombre || !items?.length)
      return res.status(400).json({ success: false, message: 'Nombre e ítems son requeridos' });
    const nueva = {
      id: uuidv4(),
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || '',
      items,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };
    res.status(201).json({ success: true, data: db.createPlantilla(nueva) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { nombre, descripcion, items } = req.body;
    const actualizada = db.updatePlantilla(req.params.id, { nombre, descripcion, items });
    if (!actualizada) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    res.json({ success: true, data: actualizada });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const eliminada = db.deletePlantilla(req.params.id);
    if (!eliminada) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    res.json({ success: true, message: 'Plantilla eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
