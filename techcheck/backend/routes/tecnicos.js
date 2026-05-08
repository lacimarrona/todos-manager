const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/dataAccess');

router.get('/', (req, res) => {
  try {
    res.json({ success: true, data: db.getTecnicos() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { nombre, email } = req.body;
    if (!nombre) return res.status(400).json({ success: false, message: 'El nombre es requerido' });
    const nuevo = {
      id: uuidv4(),
      nombre: nombre.trim(),
      email: email?.trim() || '',
      creadoEn: new Date().toISOString()
    };
    res.status(201).json({ success: true, data: db.createTecnico(nuevo) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { nombre, email } = req.body;
    const actualizado = db.updateTecnico(req.params.id, { nombre, email });
    if (!actualizado) return res.status(404).json({ success: false, message: 'Técnico no encontrado' });
    res.json({ success: true, data: actualizado });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const eliminado = db.deleteTecnico(req.params.id);
    if (!eliminado) return res.status(404).json({ success: false, message: 'Técnico no encontrado' });
    res.json({ success: true, message: 'Técnico eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
