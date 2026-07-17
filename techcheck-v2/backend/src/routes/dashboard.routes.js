'use strict';

const { Router } = require('express');
const auth  = require('../middleware/auth');
const roles = require('../middleware/roles');
const c     = require('../controllers/dashboard.controller');

const router = Router();

router.use(auth);
router.use(roles('admin', 'superadmin'));

router.get('/', c.getStats);

module.exports = router;
