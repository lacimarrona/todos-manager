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

// Solo equipos pendientes (sin revision completa)
router.get('/:id/equipos', (req, res) => {
  try {
    const proyecto = db.getProyectoById(req.params.id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    const equipos = db.getEquipos().filter(e => e.proyectoIds && e.proyectoIds.includes(req.params.id));
    const revisiones = db.getRevisiones();
    const enriquecidos = equipos.map(e => {
      const revsEquipo = revisiones.filter(r => r.equipoId === e.id);
      const ultima = revsEquipo.length > 0
        ? revsEquipo.reduce((a, b) => new Date(a.creadoEn) > new Date(b.creadoEn) ? a : b)
        : null;
      const tecnico = e.tecnicoAsignadoId ? db.getTecnicoById(e.tecnicoAsignadoId) : null;
      return { ...e, ultimaRevision: ultima, totalRevisiones: revsEquipo.length, tecnicoAsignadoNombre: tecnico?.nombre || '' };
    });

    const filtro = req.query.estado;
    let resultado = enriquecidos;

    if (filtro === 'pendiente') {
      resultado = enriquecidos.filter(e => !e.ultimaRevision);
    } else if (filtro === 'en_proceso') {
      resultado = enriquecidos.filter(e => {
        if (!e.ultimaRevision) return false;
        const total = e.items.length;
        if (total === 0) return false;
        const completados = e.ultimaRevision.items.filter(i => i.checked).length;
        return completados > 0 && completados < total;
      });
    } else if (filtro === 'terminado') {
      resultado = enriquecidos.filter(e => {
        if (!e.ultimaRevision) return false;
        const total = e.items.length;
        if (total === 0) return false;
        const completados = e.ultimaRevision.items.filter(i => i.checked).length;
        return completados === total;
      });
    }

    res.json({ success: true, data: resultado });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Todos los equipos sin filtrar (para historial)
router.get('/:id/todos-equipos', (req, res) => {
  try {
    const proyecto = db.getProyectoById(req.params.id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    const equipos = db.getEquipos().filter(e => e.proyectoIds && e.proyectoIds.includes(req.params.id));
    res.json({ success: true, data: equipos });
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

// Exportar proyecto como JSON
router.get('/:id/exportar', (req, res) => {
  try {
    const datos = db.exportarProyecto(req.params.id);
    if (!datos) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    res.json({ success: true, data: datos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Importar proyecto desde JSON
router.post('/importar', (req, res) => {
  try {
    const datos = req.body;
    if (!datos || !datos.proyecto) return res.status(400).json({ success: false, message: 'Datos invalidos' });
    const nuevo = db.importarProyecto(datos);
    res.status(201).json({ success: true, data: nuevo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;