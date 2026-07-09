'use strict';

const { Router } = require('express');
const express = require('express');
const auth  = require('../middleware/auth');
const roles = require('../middleware/roles');
const c     = require('../controllers/revision.controller');

const router = Router();

// Los endpoints que reciben archivos en base64 necesitan un límite mayor
const jsonArchivo = express.json({ limit: '20mb' });

// ── Revisión CRUD ────────────────────────────────────────────────────────────
// Listado por proyecto (historial)
router.get('/', auth, c.listByProyecto);
// Lectura: todos los usuarios autenticados (técnico consulta su revisión)
router.get('/:id', auth, c.getOne);

// Crear / actualizar: cualquier usuario autenticado puede crear y completar revisiones
router.post('/',       auth, c.create);
router.put('/:id',     auth, c.update);
// Eliminar: solo admin y superadmin
router.delete('/:id',  auth, roles('admin', 'superadmin'), c.remove);

// ── Items: el técnico puede marcar y agregar notas ───────────────────────────
router.put('/:id/items/:itemRevId', auth, c.updateItem);

// ── Archivos de evidencia: el técnico puede subir (base64 → 20 MB) ───────────
router.post('/:id/items/:itemRevId/archivos',              auth, jsonArchivo, c.addArchivo);
router.delete('/:id/items/:itemRevId/archivos/:archivoId', auth, c.removeArchivo);

// ── Archivos de observación general ─────────────────────────────────────────
router.post('/:id/archivos-obs',              auth, jsonArchivo, c.addArchivoObs);
router.delete('/:id/archivos-obs/:archivoId', auth, c.removeArchivoObs);

module.exports = router;
