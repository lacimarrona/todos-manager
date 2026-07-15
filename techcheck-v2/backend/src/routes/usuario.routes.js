'use strict';

const { Router } = require('express');
const auth  = require('../middleware/auth');
const roles = require('../middleware/roles');
const { usuarioController, workspaceMembershipController } = require('../controllers/usuario.controller');

const router = Router();

router.use(auth, roles('admin', 'superadmin'));

router.get('/',    usuarioController.list);
router.get('/:id', usuarioController.getOne);
router.post('/',   usuarioController.create);
router.put('/:id', usuarioController.update);
router.delete('/:id', usuarioController.remove);

// Membresías de workspace — solo superadmin
router.get('/:id/workspaces',                   roles('superadmin'), workspaceMembershipController.listWorkspaces);
router.post('/:id/workspaces',                  roles('superadmin'), workspaceMembershipController.addWorkspace);
router.delete('/:id/workspaces/:workspaceId',   roles('superadmin'), workspaceMembershipController.removeWorkspace);

module.exports = router;
