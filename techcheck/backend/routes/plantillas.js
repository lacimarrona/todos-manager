const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const JSZip = require('jszip');
const db = require('../db/dataAccess');

const ARCHIVOS_DIR = path.join(__dirname, '../data/archivos');
const INDEX_PATH = path.join(ARCHIVOS_DIR, 'index.json');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

function readArchivoIndex() {
  if (!fs.existsSync(INDEX_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')); } catch { return {}; }
}
function writeArchivoIndex(idx) {
  if (!fs.existsSync(ARCHIVOS_DIR)) fs.mkdirSync(ARCHIVOS_DIR, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(idx, null, 2));
}

// Helpers de acceso por rol y permisos especiales
function proyectosDelUsuario(req) {
  if (req.user.rol === 'tecnico') {
    // Técnico: sus proyectos están en proyecto_permisos
    return db.getPermisosDelTecnico(req.user.sub).map(p => p.proyectoId);
  }
  // project_admin: sus proyectos están en proyecto_asignaciones
  return db.getProyectosDeUsuario(req.user.sub).map(p => p.id);
}
function esTecnicoConPermisoEnPlantilla(req, plantillaId) {
  // Técnico con editar_plantillas: puede editar si la plantilla está en alguno de sus proyectos
  const susProyectos = proyectosDelUsuario(req);
  const proyectosDePlantilla = db.getProyectosDePlantilla(plantillaId);
  return proyectosDePlantilla.some(id => susProyectos.includes(id));
}

// GET /api/plantillas — admin ve todas; project_admin y técnico ven solo las de sus proyectos
router.get('/', (req, res) => {
  try {
    let plantillas;
    if (req.user.rol === 'admin') {
      plantillas = db.getPlantillas();
    } else {
      const proyectoIds = proyectosDelUsuario(req);
      plantillas = db.getPlantillasParaProyectos(proyectoIds);
    }
    res.json({ success: true, data: db.augmentarPlantillasConProyectos(plantillas) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/plantillas/por-proyecto/:proyectoId — plantillas de un proyecto (para el form de equipos)
// IMPORTANTE: esta ruta debe ir antes de /:id para no ser capturada por el parámetro
router.get('/por-proyecto/:proyectoId', (req, res) => {
  try {
    const plantillas = db.getPlantillasDeProyecto(req.params.proyectoId);
    res.json({ success: true, data: plantillas });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const p = db.getPlantillaById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    res.json({ success: true, data: p });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/plantillas/:id/proyectos — proyectos asociados a una plantilla
router.get('/:id/proyectos', (req, res) => {
  try {
    const p = db.getPlantillaById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    const proyectoIds = db.getProyectosDePlantilla(req.params.id);
    res.json({ success: true, data: proyectoIds });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/plantillas/:id/proyectos — establece proyectos asociados a una plantilla
router.put('/:id/proyectos', (req, res) => {
  try {
    const plantilla = db.getPlantillaById(req.params.id);
    if (!plantilla) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    if (req.user.rol === 'project_admin' && plantilla.creadoPor !== req.user.sub) {
      return res.status(403).json({ success: false, message: 'Solo puedes gestionar proyectos de tus propias plantillas' });
    }
    let proyectoIds = req.body.proyectoIds || [];
    if (req.user.rol === 'project_admin') {
      const susProyectos = db.getProyectosDeUsuario(req.user.sub).map(p => p.id);
      proyectoIds = proyectoIds.filter(id => susProyectos.includes(id));
    }
    db.setProyectosDePlantilla(req.params.id, proyectoIds);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { nombre, descripcion, items, proyectoIds } = req.body;
    if (!nombre || !items?.length)
      return res.status(400).json({ success: false, message: 'Nombre e ítems son requeridos' });

    let finalProyectoIds = proyectoIds || [];
    if (req.user.rol === 'project_admin') {
      const susProyectos = db.getProyectosDeUsuario(req.user.sub).map(p => p.id);
      finalProyectoIds = finalProyectoIds.filter(id => susProyectos.includes(id));
    }

    const nueva = {
      id: uuidv4(),
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || '',
      items,
      creadoPor: req.user.sub,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };
    const creada = db.createPlantilla(nueva);
    if (finalProyectoIds.length) {
      db.setProyectosDePlantilla(creada.id, finalProyectoIds);
    }
    res.status(201).json({ success: true, data: { ...creada, proyectoIds: finalProyectoIds } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/plantillas/:id/equipos — equipos vinculados a esta plantilla
router.get('/:id/equipos', (req, res) => {
  try {
    const plantilla = db.getPlantillaById(req.params.id);
    if (!plantilla) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    const equipos = db.getEquipos().filter(e => e.plantillaId === plantilla.id && !e.archivado);
    res.json({ success: true, data: equipos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/plantillas/:id/sincronizar-equipos
router.post('/:id/sincronizar-equipos', (req, res) => {
  try {
    const plantilla = db.getPlantillaById(req.params.id);
    if (!plantilla) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });

    const { equipoIds } = req.body;
    const equipos = db.getEquipos().filter(e =>
      e.plantillaId === plantilla.id &&
      !e.archivado &&
      (!equipoIds || equipoIds.includes(e.id))
    );
    let equiposActualizados = 0;
    let itemsAgregados = 0;
    let itemsActualizados = 0;

    for (const equipo of equipos) {
      const itemsEquipo = [...equipo.items];
      let modificado = false;

      for (const itemPlantilla of plantilla.items) {
        const idx = itemsEquipo.findIndex(i => i.label === itemPlantilla.label);
        if (idx === -1) {
          itemsEquipo.push({ ...itemPlantilla });
          itemsAgregados++;
          modificado = true;
        } else {
          const itemExistente = itemsEquipo[idx];
          const guiaDistinta = itemExistente.observacionGuia !== itemPlantilla.observacionGuia;
          const archivosDistintos = JSON.stringify(itemExistente.archivosGuia) !== JSON.stringify(itemPlantilla.archivosGuia);
          if (guiaDistinta || archivosDistintos) {
            itemsEquipo[idx] = { ...itemExistente, observacionGuia: itemPlantilla.observacionGuia, archivosGuia: itemPlantilla.archivosGuia };
            itemsActualizados++;
            modificado = true;
          }
        }
      }

      if (modificado) {
        db.updateEquipo(equipo.id, { items: itemsEquipo });
        equiposActualizados++;
      }
    }

    res.json({
      success: true,
      data: {
        totalEquipos: equipos.length,
        equiposActualizados,
        itemsAgregados,
        itemsActualizados,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const plantilla = db.getPlantillaById(req.params.id);
    if (!plantilla) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    if (req.user.rol === 'project_admin') {
      if (!esTecnicoConPermisoEnPlantilla(req, req.params.id)) {
        return res.status(403).json({ success: false, message: 'No tienes acceso para editar esta plantilla' });
      }
    } else if (req.user.rol === 'tecnico') {
      if (!db.tienePemisoEspecial(req.user.sub, 'editar_plantillas') || !esTecnicoConPermisoEnPlantilla(req, req.params.id)) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para editar plantillas' });
      }
    }
    const { nombre, descripcion, items, proyectoIds } = req.body;
    const actualizada = db.updatePlantilla(req.params.id, { nombre, descripcion, items });

    if (proyectoIds !== undefined) {
      let finalProyectoIds = proyectoIds || [];
      if (req.user.rol === 'project_admin') {
        const susProyectos = db.getProyectosDeUsuario(req.user.sub).map(p => p.id);
        finalProyectoIds = finalProyectoIds.filter(id => susProyectos.includes(id));
      }
      db.setProyectosDePlantilla(req.params.id, finalProyectoIds);
    }

    res.json({ success: true, data: actualizada });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const plantilla = db.getPlantillaById(req.params.id);
    if (!plantilla) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    if (req.user.rol === 'project_admin') {
      if (!esTecnicoConPermisoEnPlantilla(req, req.params.id)) {
        return res.status(403).json({ success: false, message: 'No tienes acceso para eliminar esta plantilla' });
      }
    } else if (req.user.rol === 'tecnico') {
      if (!db.tienePemisoEspecial(req.user.sub, 'eliminar_plantillas') || !esTecnicoConPermisoEnPlantilla(req, req.params.id)) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para eliminar plantillas' });
      }
    }
    db.deletePlantilla(req.params.id);
    res.json({ success: true, message: 'Plantilla eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/plantillas/:id/exportar-zip
router.get('/:id/exportar-zip', async (req, res) => {
  try {
    const plantilla = db.getPlantillaById(req.params.id);
    if (!plantilla) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });

    const zip = new JSZip();
    zip.file('plantilla.json', JSON.stringify(plantilla, null, 2));

    const subpaths = db.collectArchivoHashes({ items: plantilla.items });
    const archivoIndex = readArchivoIndex();
    const indexExportado = {};

    for (const subpath of subpaths) {
      const filePath = path.join(ARCHIVOS_DIR, subpath);
      if (fs.existsSync(filePath)) {
        zip.file(`archivos/${subpath}`, fs.readFileSync(filePath));
        const hash = subpath.split('/').pop();
        if (archivoIndex[hash]) indexExportado[hash] = archivoIndex[hash];
      }
    }

    if (Object.keys(indexExportado).length > 0) {
      zip.file('archivos/index.json', JSON.stringify(indexExportado, null, 2));
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const nombre = `${plantilla.nombre.replace(/[^a-zA-Z0-9_\-]/g, '_')}_plantilla.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/plantillas/importar-zip
router.post('/importar-zip', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió ningún archivo' });

    const zip = await JSZip.loadAsync(req.file.buffer);

    const plantillaFile = zip.file('plantilla.json');
    if (!plantillaFile) return res.status(400).json({ success: false, message: 'ZIP inválido: falta plantilla.json' });

    const plantilla = JSON.parse(await plantillaFile.async('string'));
    if (!plantilla || !plantilla.nombre || !plantilla.items)
      return res.status(400).json({ success: false, message: 'plantilla.json inválido' });

    const archivoIndex = readArchivoIndex();
    const zipIndexFile = zip.file('archivos/index.json');
    const zipIndex = zipIndexFile ? JSON.parse(await zipIndexFile.async('string')) : {};
    let indexActualizado = false;

    if (!fs.existsSync(ARCHIVOS_DIR)) fs.mkdirSync(ARCHIVOS_DIR, { recursive: true });

    const archivosFolder = zip.folder('archivos');
    if (archivosFolder) {
      const archivosFiles = [];
      archivosFolder.forEach((relPath, file) => {
        if (relPath !== 'index.json' && !file.dir) archivosFiles.push({ relPath, file });
      });
      for (const { relPath, file } of archivosFiles) {
        const hash = relPath.split('/').pop();
        if (!/^[a-f0-9]{64}$/.test(hash)) continue;
        const destPath = path.join(ARCHIVOS_DIR, relPath);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        if (!fs.existsSync(destPath)) {
          const buffer = await file.async('nodebuffer');
          const realHash = crypto.createHash('sha256').update(buffer).digest('hex');
          if (realHash !== hash) continue;
          fs.writeFileSync(destPath, buffer);
        }
        if (!archivoIndex[hash]) {
          archivoIndex[hash] = zipIndex[hash] || { nombre: hash, tipo: 'application/octet-stream' };
          indexActualizado = true;
        }
      }
      if (indexActualizado) writeArchivoIndex(archivoIndex);
    }

    const nueva = {
      ...plantilla,
      id: uuidv4(),
      creadoPor: req.user.sub,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };
    res.status(201).json({ success: true, data: db.createPlantilla(nueva) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
