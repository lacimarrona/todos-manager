'use strict';

const router = require('express').Router();
const { auth, roles } = require('../middleware/auth');
const c = require('../controllers/grupo-elemento.controller');

router.use(auth);
router.use(roles('admin', 'superadmin'));

// Grupos
router.get('/',          c.listGrupos);
router.get('/:id',       c.getGrupo);
router.post('/',         c.createGrupo);
router.put('/:id',       c.updateGrupo);
router.delete('/:id',    c.deleteGrupo);

// Elementos dentro de un grupo
router.get('/:grupoId/elementos',       c.listElementos);
router.post('/:grupoId/elementos',      c.createElemento);
router.put('/:grupoId/elementos/:id',   c.updateElemento);
router.delete('/:grupoId/elementos/:id',c.deleteElemento);

module.exports = router;
