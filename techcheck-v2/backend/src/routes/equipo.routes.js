'use strict';

const { Router } = require('express');
const multer = require('multer');
const auth  = require('../middleware/auth');
const roles = require('../middleware/roles');
const c     = require('../controllers/equipo.controller');
const revisionController = require('../controllers/revision.controller');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── Rutas estáticas primero (deben ir antes de /:id para evitar conflictos) ──
router.post('/importar-masivo',      auth, roles('admin', 'superadmin'), c.importarMasivo);
router.get('/plantilla-excel',       auth, roles('admin', 'superadmin'), c.descargarPlantillaExcel);
router.post('/importar-excel-nombres', auth, roles('admin', 'superadmin'), upload.single('file'), c.importarExcelNombres);

// ── Equipo CRUD ──────────────────────────────────────────────────────────────
router.get('/:id',     auth, c.getOne);
router.post('/',       auth, roles('admin', 'superadmin'), c.create);
router.put('/:id',     auth, roles('admin', 'superadmin'), c.update);
router.delete('/:id',  auth, roles('admin', 'superadmin'), c.remove);
router.post('/:id/clonar',   auth, roles('admin', 'superadmin'), c.clonar);
router.post('/:id/archivar', auth, roles('admin', 'superadmin'), c.archivar);
router.get('/:id/exportar-json', auth, c.exportarJSON);
router.get('/:id/exportar-csv',  auth, c.exportarCSV);
router.get('/:equipoId/revisiones', auth, revisionController.listByEquipo);

// ── Items sub-recurso ────────────────────────────────────────────────────────
router.get('/:id/items',                     auth, c.listItems);
router.post('/:id/items',                    auth, roles('admin', 'superadmin'), c.addItem);
router.put('/:id/items/:itemId',             auth, roles('admin', 'superadmin'), c.updateItem);
router.delete('/:id/items/:itemId',          auth, roles('admin', 'superadmin'), c.removeItem);

// ── Archivos guía sub-recurso ────────────────────────────────────────────────
router.post('/:id/items/:itemId/archivos',              auth, roles('admin', 'superadmin'), c.addArchivoGuia);
router.delete('/:id/items/:itemId/archivos/:archivoId', auth, roles('admin', 'superadmin'), c.removeArchivoGuia);

module.exports = router;
