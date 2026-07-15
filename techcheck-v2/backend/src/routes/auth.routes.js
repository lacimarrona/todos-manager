'use strict';

const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');

const router = Router();

router.post('/login',            authController.login);
router.post('/refresh',          authController.refresh);
router.post('/logout',           auth, authController.logout);
router.get('/me',                auth, authController.me);
router.post('/change-password',  auth, authController.changePassword);
router.post('/switch-workspace', auth, authController.switchWorkspace);

module.exports = router;
