'use strict';

const { Router } = require('express');
const multer = require('multer');
const auth   = require('../middleware/auth');
const roles  = require('../middleware/roles');
const c      = require('../controllers/plantilla.controller');

const router = Router();

// Multer en memoria para Excel (max 5 MB, extensión .xlsx/.xls)
// La validación de magic bytes se hace DESPUÉS de que multer carga el buffer.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
    }
  },
});

// Valida magic bytes: OOXML (.xlsx) = ZIP (50 4B 03 04); XLS = OLE2 (D0 CF 11 E0)
function validateExcelMagicBytes(req, res, next) {
  if (!req.file) return next();
  const buf = req.file.buffer;
  const isOOXML = buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04;
  const isXLS   = buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0;
  if (!isOOXML && !isXLS) {
    return res.status(400).json({ error: 'El archivo no es un Excel válido (firma inválida)' });
  }
  next();
}

// Wrapper para propagar errores de multer como JSON
function uploadSingle(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  };
}

// ── Rutas literales primero (antes de /:id) ──────────────────────────────────
router.post(
  '/importar-excel',
  auth,
  roles('admin', 'superadmin'),
  uploadSingle('archivo'),
  validateExcelMagicBytes,
  c.importarExcel
);

// ── CRUD Plantilla ───────────────────────────────────────────────────────────
router.get('/',     auth, roles('admin', 'superadmin'), c.list);
router.get('/:id',  auth, roles('admin', 'superadmin'), c.getOne);
router.post('/',    auth, roles('admin', 'superadmin'), c.create);
router.put('/:id',  auth, roles('admin', 'superadmin'), c.update);
router.delete('/:id', auth, roles('admin', 'superadmin'), c.remove);

// ── Aplicar plantilla ────────────────────────────────────────────────────────
router.post('/:id/aplicar', auth, roles('admin', 'superadmin'), c.aplicarAEquipo);

// ── Ítems sub-recurso ────────────────────────────────────────────────────────
router.get('/:id/items',              auth, roles('admin', 'superadmin'), c.listItems);
router.post('/:id/items',             auth, roles('admin', 'superadmin'), c.addItem);
router.put('/:id/items/:itemId',      auth, roles('admin', 'superadmin'), c.updateItem);
router.delete('/:id/items/:itemId',   auth, roles('admin', 'superadmin'), c.removeItem);

module.exports = router;
