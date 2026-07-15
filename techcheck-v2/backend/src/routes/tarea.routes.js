'use strict';

const { Router } = require('express');
const auth  = require('../middleware/auth');
const roles = require('../middleware/roles');
const c     = require('../controllers/tarea.controller');

const router = Router();

// Todos los usuarios autenticados pueden ver y crear sus propias tareas.
// El controlador aplica la visibilidad y permisos por rol.
router.use(auth);

router.get('/',         c.list);
router.get('/:id',      c.getOne);
router.post('/',        c.create);
router.put('/:id',      c.update);
router.delete('/:id',   c.remove);
router.patch('/:id/toggle', c.toggle);

module.exports = router;
