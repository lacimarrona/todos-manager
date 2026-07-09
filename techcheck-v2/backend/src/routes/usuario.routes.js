'use strict';

const { Router } = require('express');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const usuarioController = require('../controllers/usuario.controller');

const router = Router();

// Admin y superadmin pueden gestionar usuarios
router.use(auth, roles('admin', 'superadmin'));

router.get('/', usuarioController.list);
router.get('/:id', usuarioController.getOne);
router.post('/', usuarioController.create);
router.put('/:id', usuarioController.update);
router.delete('/:id', usuarioController.remove);

module.exports = router;
