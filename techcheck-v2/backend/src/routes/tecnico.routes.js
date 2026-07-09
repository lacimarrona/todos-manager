'use strict';

const { Router } = require('express');
const auth  = require('../middleware/auth');
const roles = require('../middleware/roles');
const c     = require('../controllers/tecnico.controller');

const router = Router();

router.get('/',       auth, c.list);
router.post('/',      auth, roles('admin', 'superadmin'), c.create);
router.put('/:id',    auth, roles('admin', 'superadmin'), c.update);
router.delete('/:id', auth, roles('admin', 'superadmin'), c.remove);

module.exports = router;
