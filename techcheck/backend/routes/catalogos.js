const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/sqlite');
const roles = require('../middleware/roles');
const dataAccess = require('../db/dataAccess');

const adminOnly = roles('admin');
const adminOrProjectAdmin = roles('admin', 'project_admin');
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

// IDs de proyectos visibles para el usuario (null = todos)
function proyectosDelUsuario(req) {
  if (req.user.rol === 'admin') return null;
  if (req.user.rol === 'project_admin') {
    return dataAccess.getProyectosDeUsuario(req.user.sub).map(p => p.id);
  }
  // tecnico
  return dataAccess.getPermisosDelTecnico(req.user.sub).map(p => p.proyectoId);
}

// IDs de catálogos asignados a los proyectos dados
function catalogosDeProyectos(proyectoIds) {
  if (!proyectoIds.length) return [];
  const ph = proyectoIds.map(() => '?').join(',');
  return db.prepare(
    `SELECT DISTINCT catalogo_id FROM catalogo_proyectos WHERE proyecto_id IN (${ph})`
  ).all(...proyectoIds).map(r => r.catalogo_id);
}

// Proyectos asignados a un catálogo
function proyectosDeCatalogo(catalogoId) {
  return db.prepare('SELECT proyecto_id FROM catalogo_proyectos WHERE catalogo_id = ?').all(catalogoId).map(r => r.proyecto_id);
}

// El usuario (project_admin) tiene acceso a este catálogo si está asignado a alguno de sus proyectos,
// o si el catálogo aún no tiene proyectos asignados (catálogo nuevo sin asignar)
function tieneAccesoACatalogo(req, catalogoId) {
  if (req.user.rol === 'admin') return true;
  const misProyectos = proyectosDelUsuario(req);
  if (!misProyectos) return true;
  const cats = catalogosDeProyectos(misProyectos);
  return cats.includes(catalogoId);
}

// ── Grupos ───────────────────────────────────────────────────────────────────

// GET /api/catalogos — lista grupos con sus elementos activos (filtrado por rol)
router.get('/', (req, res) => {
  try {
    let grupos;
    if (req.user.rol === 'admin') {
      grupos = db.prepare('SELECT * FROM grupos_elemento ORDER BY nombre ASC').all().map(rowToGrupo);
    } else {
      const misProyectos = proyectosDelUsuario(req);
      if (!misProyectos || misProyectos.length === 0) {
        grupos = [];
      } else {
        const catIds = catalogosDeProyectos(misProyectos);
        if (!catIds.length) {
          grupos = [];
        } else {
          const ph = catIds.map(() => '?').join(',');
          grupos = db.prepare(
            `SELECT * FROM grupos_elemento WHERE id IN (${ph}) ORDER BY nombre ASC`
          ).all(...catIds).map(rowToGrupo);
        }
      }
    }
    for (const g of grupos) {
      g.elementos = db.prepare(
        'SELECT * FROM elementos_grupo WHERE grupo_id = ? ORDER BY valor ASC'
      ).all(g.id).map(rowToElemento);
      g.proyectos = proyectosDeCatalogo(g.id);
    }
    res.json({ success: true, data: grupos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/catalogos — admin y project_admin pueden crear
router.post('/', adminOrProjectAdmin, (req, res) => {
  try {
    const { nombre, descripcion = '', proyectos: proyectoIds = [] } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ success: false, message: 'El nombre es requerido' });

    // project_admin solo puede asignar a sus propios proyectos
    let idsAAsignar = proyectoIds;
    if (req.user.rol === 'project_admin') {
      const misProyectos = proyectosDelUsuario(req) || [];
      idsAAsignar = proyectoIds.filter(id => misProyectos.includes(id));
      // Si no mandaron proyectos, asignar automáticamente a todos sus proyectos
      if (!idsAAsignar.length) idsAAsignar = misProyectos;
    }

    const id = uuidv4();
    db.prepare('INSERT INTO grupos_elemento (id, nombre, descripcion, activo, creado_en) VALUES (?,?,?,1,?)')
      .run(id, nombre.trim(), descripcion, now());

    // Asignar proyectos
    const insCP = db.prepare('INSERT OR IGNORE INTO catalogo_proyectos (catalogo_id, proyecto_id) VALUES (?,?)');
    for (const pid of idsAAsignar) insCP.run(id, pid);

    const grupo = rowToGrupo(db.prepare('SELECT * FROM grupos_elemento WHERE id = ?').get(id));
    grupo.elementos = [];
    grupo.proyectos = proyectosDeCatalogo(id);
    res.status(201).json({ success: true, data: grupo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/catalogos/:id
router.put('/:id', adminOrProjectAdmin, (req, res) => {
  try {
    const grupo = db.prepare('SELECT * FROM grupos_elemento WHERE id = ?').get(req.params.id);
    if (!grupo) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });
    if (!tieneAccesoACatalogo(req, req.params.id)) {
      return res.status(403).json({ success: false, message: 'Sin acceso a este catálogo' });
    }

    const { nombre, descripcion, activo, proyectos: proyectoIds } = req.body;
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

    // Actualizar proyectos (solo admin puede cambiar proyectos arbitrariamente)
    if (proyectoIds !== undefined) {
      if (req.user.rol === 'admin') {
        db.prepare('DELETE FROM catalogo_proyectos WHERE catalogo_id = ?').run(req.params.id);
        const ins = db.prepare('INSERT OR IGNORE INTO catalogo_proyectos (catalogo_id, proyecto_id) VALUES (?,?)');
        for (const pid of proyectoIds) ins.run(req.params.id, pid);
      } else {
        // project_admin: solo puede asignar/quitar sus propios proyectos
        const misProyectos = proyectosDelUsuario(req) || [];
        // Quitar solo los suyos que ya no están en la lista
        const actuales = proyectosDeCatalogo(req.params.id);
        const aMantener = actuales.filter(pid => !misProyectos.includes(pid)); // proyectos de otros admins, no tocar
        const aAgregar = proyectoIds.filter(pid => misProyectos.includes(pid));
        db.prepare('DELETE FROM catalogo_proyectos WHERE catalogo_id = ? AND proyecto_id IN (' +
          misProyectos.map(() => '?').join(',') + ')').run(req.params.id, ...misProyectos);
        const ins = db.prepare('INSERT OR IGNORE INTO catalogo_proyectos (catalogo_id, proyecto_id) VALUES (?,?)');
        for (const pid of aAgregar) ins.run(req.params.id, pid);
      }
    }

    const updated = rowToGrupo(db.prepare('SELECT * FROM grupos_elemento WHERE id = ?').get(req.params.id));
    updated.elementos = db.prepare('SELECT * FROM elementos_grupo WHERE grupo_id = ? ORDER BY valor ASC').all(req.params.id).map(rowToElemento);
    updated.proyectos = proyectosDeCatalogo(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/catalogos/:id
router.delete('/:id', adminOrProjectAdmin, (req, res) => {
  try {
    const grupo = db.prepare('SELECT * FROM grupos_elemento WHERE id = ?').get(req.params.id);
    if (!grupo) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });
    if (!tieneAccesoACatalogo(req, req.params.id)) {
      return res.status(403).json({ success: false, message: 'Sin acceso a este catálogo' });
    }
    db.prepare('DELETE FROM grupos_elemento WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/catalogos/:id/proyectos — proyectos asignados a un catálogo (admin)
router.get('/:id/proyectos', adminOnly, (req, res) => {
  try {
    const grupo = db.prepare('SELECT id FROM grupos_elemento WHERE id = ?').get(req.params.id);
    if (!grupo) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });
    const proyectos = proyectosDeCatalogo(req.params.id);
    res.json({ success: true, data: proyectos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/catalogos/:id/proyectos — reemplaza proyectos asignados (admin)
router.put('/:id/proyectos', adminOnly, (req, res) => {
  try {
    const grupo = db.prepare('SELECT id FROM grupos_elemento WHERE id = ?').get(req.params.id);
    if (!grupo) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });
    const { proyectos: proyectoIds = [] } = req.body;
    db.prepare('DELETE FROM catalogo_proyectos WHERE catalogo_id = ?').run(req.params.id);
    const ins = db.prepare('INSERT OR IGNORE INTO catalogo_proyectos (catalogo_id, proyecto_id) VALUES (?,?)');
    for (const pid of proyectoIds) ins.run(req.params.id, pid);
    res.json({ success: true, data: proyectosDeCatalogo(req.params.id) });
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
router.post('/:grupoId/elementos', adminOrProjectAdmin, (req, res) => {
  try {
    const grupo = db.prepare('SELECT id FROM grupos_elemento WHERE id = ?').get(req.params.grupoId);
    if (!grupo) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });
    if (!tieneAccesoACatalogo(req, req.params.grupoId)) {
      return res.status(403).json({ success: false, message: 'Sin acceso a este catálogo' });
    }
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
router.put('/:grupoId/elementos/:id', adminOrProjectAdmin, (req, res) => {
  try {
    const elemento = db.prepare('SELECT * FROM elementos_grupo WHERE id = ? AND grupo_id = ?').get(req.params.id, req.params.grupoId);
    if (!elemento) return res.status(404).json({ success: false, message: 'Elemento no encontrado' });
    if (!tieneAccesoACatalogo(req, req.params.grupoId)) {
      return res.status(403).json({ success: false, message: 'Sin acceso a este catálogo' });
    }
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
router.delete('/:grupoId/elementos/:id', adminOrProjectAdmin, (req, res) => {
  try {
    const elemento = db.prepare('SELECT * FROM elementos_grupo WHERE id = ? AND grupo_id = ?').get(req.params.id, req.params.grupoId);
    if (!elemento) return res.status(404).json({ success: false, message: 'Elemento no encontrado' });
    if (!tieneAccesoACatalogo(req, req.params.grupoId)) {
      return res.status(403).json({ success: false, message: 'Sin acceso a este catálogo' });
    }
    db.prepare('DELETE FROM elementos_grupo WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
