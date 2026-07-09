'use strict';

const { Router } = require('express');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const workspaceController = require('../controllers/workspace.controller');

const router = Router();

// Todas las rutas de /api/admin requieren superadmin
router.use(auth, roles('superadmin'));

router.get('/workspaces', workspaceController.list);
router.get('/workspaces/:id', workspaceController.getOne);
router.post('/workspaces', workspaceController.create);
router.put('/workspaces/:id', workspaceController.update);
router.delete('/workspaces/:id', workspaceController.remove);
router.get('/usuarios/disponibles', workspaceController.listDisponibles);
router.post('/workspaces/:id/admins', workspaceController.assignAdmin);
router.put('/workspaces/:id/admins', workspaceController.assignExisting);

module.exports = router;
