'use strict';

const { Router } = require('express');
const auth  = require('../middleware/auth');
const roles = require('../middleware/roles');
const c     = require('../controllers/tarea.controller');

const router = Router();

// Solo admin y superadmin gestionan tareas programadas
router.use(auth, roles('admin', 'superadmin'));

router.get('/',         c.list);
router.get('/:id',      c.getOne);
router.post('/',        c.create);
router.put('/:id',      c.update);
router.delete('/:id',   c.remove);
router.patch('/:id/toggle', c.toggle);

module.exports = router;
