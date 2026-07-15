'use strict';

const { Router } = require('express');
const auth  = require('../middleware/auth');
const roles = require('../middleware/roles');
const c     = require('../controllers/proyecto.controller');

const router = Router();

// Lectura: cualquier usuario autenticado (técnicos también necesitan ver proyectos)
router.get('/',                    auth, c.list);
router.get('/:id',                 auth, c.getOne);
router.get('/:id/equipos',         auth, c.listEquipos);
router.get('/:id/tareas-vencidas', auth, c.tareaVencidas);
router.get('/:id/exportar-csv',    auth, roles('admin', 'superadmin'), c.exportarCSV);
router.get('/:id/exportar-json',   auth, roles('admin', 'superadmin'), c.exportarJSON);

// Permisos por proyecto: solo admin y superadmin
router.get('/:id/permisos',        auth, roles('admin', 'superadmin'), c.getPermissions);
router.put('/:id/permisos',        auth, roles('admin', 'superadmin'), c.updatePermissions);

// Escritura: solo admin y superadmin
router.post('/',                   auth, roles('admin', 'superadmin'), c.create);
router.post('/importar-json',      auth, roles('admin', 'superadmin'), c.importarJSON);
router.put('/:id',                 auth, roles('admin', 'superadmin'), c.update);
router.delete('/:id',              auth, roles('admin', 'superadmin'), c.remove);

module.exports = router;
