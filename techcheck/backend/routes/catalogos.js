const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/sqlite');

const now = () => new Date().toISOString();

// ── Helpers ──────────────────────────────────────────────────────────────────

function rowToGrupo(r) {
  if (!r) return null;
  return { id: r.id, nombre: r.nombre, descripcion: r.descripcion, activo: r.activo === 1, creadoEn: r.creado_en };
}

function rowToElemento(r) {
  if (!r) return null;
  return { id: r.id, grupoId: r.grupo_id, valor: r.valor, descripcion: r.descripcion, activo: r.activo === 1, creadoEn: r.creado_en };
}

// ── Grupos ───────────────────────────────────────────────────────────────────

// GET /api/catalogos — lista grupos con sus elementos activos
router.get('/', (req, res) => {
  try {
    const grupos = db.prepare('SELECT * FROM grupos_elemento ORDER BY nombre ASC').all().map(rowToGrupo);
    for (const g of grupos) {
      g.elementos = db.prepare(
        'SELECT * FROM elementos_grupo WHERE grupo_id = ? ORDER BY valor ASC'
      ).all(g.id).map(rowToElemento);
    }
    res.json({ success: true, data: grupos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/catalogos
router.post('/', (req, res) => {
  try {
    const { nombre, descripcion = '' } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ success: false, message: 'El nombre es requerido' });
    const id = uuidv4();
    db.prepare('INSERT INTO grupos_elemento (id, nombre, descripcion, activo, creado_en) VALUES (?,?,?,1,?)')
      .run(id, nombre.trim(), descripcion, now());
    const grupo = rowToGrupo(db.prepare('SELECT * FROM grupos_elemento WHERE id = ?').get(id));
    grupo.elementos = [];
    res.status(201).json({ success: true, data: grupo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/catalogos/:id
router.put('/:id', (req, res) => {
  try {
    const grupo = db.prepare('SELECT * FROM grupos_elemento WHERE id = ?').get(req.params.id);
    if (!grupo) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });
    const { nombre, descripcion, activo } = req.body;
    if (nombre !== undefined && !nombre.trim()) return res.status(400).json({ success: false, message: 'El nombre es requerido' });
    const fields = [];
    const vals = [];
    if (nombre      !== undefined) { fields.push('nombre = ?');      vals.push(nombre.trim()); }
    if (descripcion !== undefined) { fields.push('descripcion = ?'); vals.push(descripcion); }
    if (activo      !== undefined) { fields.push('activo = ?');      vals.push(activo ? 1 : 0); }
    if (fields.length) {
      vals.push(req.params.id);
      db.prepare(`UPDATE grupos_elemento SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    }
    const updated = rowToGrupo(db.prepare('SELECT * FROM grupos_elemento WHERE id = ?').get(req.params.id));
    updated.elementos = db.prepare('SELECT * FROM elementos_grupo WHERE grupo_id = ? ORDER BY valor ASC').all(req.params.id).map(rowToElemento);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/catalogos/:id
router.delete('/:id', (req, res) => {
  try {
    const grupo = db.prepare('SELECT * FROM grupos_elemento WHERE id = ?').get(req.params.id);
    if (!grupo) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });
    db.prepare('DELETE FROM grupos_elemento WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Elementos ────────────────────────────────────────────────────────────────

// GET /api/catalogos/:grupoId/elementos
router.get('/:grupoId/elementos', (req, res) => {
  try {
    const grupo = db.prepare('SELECT id FROM grupos_elemento WHERE id = ?').get(req.params.grupoId);
    if (!grupo) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });
    const elementos = db.prepare('SELECT * FROM elementos_grupo WHERE grupo_id = ? ORDER BY valor ASC').all(req.params.grupoId).map(rowToElemento);
    res.json({ success: true, data: elementos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/catalogos/:grupoId/elementos
router.post('/:grupoId/elementos', (req, res) => {
  try {
    const grupo = db.prepare('SELECT id FROM grupos_elemento WHERE id = ?').get(req.params.grupoId);
    if (!grupo) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });
    const { valor, descripcion = '' } = req.body;
    if (!valor?.trim()) return res.status(400).json({ success: false, message: 'El valor es requerido' });
    const id = uuidv4();
    db.prepare('INSERT INTO elementos_grupo (id, grupo_id, valor, descripcion, activo, creado_en) VALUES (?,?,?,?,1,?)')
      .run(id, req.params.grupoId, valor.trim(), descripcion, now());
    const elemento = rowToElemento(db.prepare('SELECT * FROM elementos_grupo WHERE id = ?').get(id));
    res.status(201).json({ success: true, data: elemento });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/catalogos/:grupoId/elementos/:id
router.put('/:grupoId/elementos/:id', (req, res) => {
  try {
    const elemento = db.prepare('SELECT * FROM elementos_grupo WHERE id = ? AND grupo_id = ?').get(req.params.id, req.params.grupoId);
    if (!elemento) return res.status(404).json({ success: false, message: 'Elemento no encontrado' });
    const { valor, descripcion, activo } = req.body;
    if (valor !== undefined && !valor.trim()) return res.status(400).json({ success: false, message: 'El valor es requerido' });
    const fields = [];
    const vals = [];
    if (valor       !== undefined) { fields.push('valor = ?');       vals.push(valor.trim()); }
    if (descripcion !== undefined) { fields.push('descripcion = ?'); vals.push(descripcion); }
    if (activo      !== undefined) { fields.push('activo = ?');      vals.push(activo ? 1 : 0); }
    if (fields.length) {
      vals.push(req.params.id);
      db.prepare(`UPDATE elementos_grupo SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    }
    const updated = rowToElemento(db.prepare('SELECT * FROM elementos_grupo WHERE id = ?').get(req.params.id));
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/catalogos/:grupoId/elementos/:id
router.delete('/:grupoId/elementos/:id', (req, res) => {
  try {
    const elemento = db.prepare('SELECT * FROM elementos_grupo WHERE id = ? AND grupo_id = ?').get(req.params.id, req.params.grupoId);
    if (!elemento) return res.status(404).json({ success: false, message: 'Elemento no encontrado' });
    db.prepare('DELETE FROM elementos_grupo WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
