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

router.get('/', (req, res) => {
  try {
    res.json({ success: true, data: db.getPlantillas() });
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

router.post('/', (req, res) => {
  try {
    const { nombre, descripcion, items } = req.body;
    if (!nombre || !items?.length)
      return res.status(400).json({ success: false, message: 'Nombre e ítems son requeridos' });
    const nueva = {
      id: uuidv4(),
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || '',
      items,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };
    res.status(201).json({ success: true, data: db.createPlantilla(nueva) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/plantillas/:id/sincronizar-equipos
router.post('/:id/sincronizar-equipos', (req, res) => {
  try {
    const plantilla = db.getPlantillaById(req.params.id);
    if (!plantilla) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });

    const equipos = db.getEquipos().filter(e => e.plantillaId === plantilla.id && !e.archivado);
    let equiposActualizados = 0;
    let itemsAgregados = 0;
    let itemsActualizados = 0;

    for (const equipo of equipos) {
      const itemsEquipo = [...equipo.items];
      let modificado = false;

      for (const itemPlantilla of plantilla.items) {
        const idx = itemsEquipo.findIndex(i => i.label === itemPlantilla.label);
        if (idx === -1) {
          // ítem nuevo: agregar
          itemsEquipo.push({ ...itemPlantilla });
          itemsAgregados++;
          modificado = true;
        } else {
          // ítem existente: actualizar observacionGuia y archivosGuia si cambiaron
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
    const { nombre, descripcion, items } = req.body;
    const actualizada = db.updatePlantilla(req.params.id, { nombre, descripcion, items });
    if (!actualizada) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    res.json({ success: true, data: actualizada });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const eliminada = db.deletePlantilla(req.params.id);
    if (!eliminada) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    res.json({ success: true, message: 'Plantilla eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/plantillas/:id/exportar-zip — descarga una plantilla con sus imágenes de guía
router.get('/:id/exportar-zip', async (req, res) => {
  try {
    const plantilla = db.getPlantillaById(req.params.id);
    if (!plantilla) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });

    const zip = new JSZip();
    zip.file('plantilla.json', JSON.stringify(plantilla, null, 2));

    // Recoger subpaths de imágenes de guía referenciadas en los ítems
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

// POST /api/plantillas/importar-zip — importa una plantilla desde ZIP con sus imágenes
router.post('/importar-zip', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió ningún archivo' });

    const zip = await JSZip.loadAsync(req.file.buffer);

    const plantillaFile = zip.file('plantilla.json');
    if (!plantillaFile) return res.status(400).json({ success: false, message: 'ZIP inválido: falta plantilla.json' });

    const plantilla = JSON.parse(await plantillaFile.async('string'));
    if (!plantilla || !plantilla.nombre || !plantilla.items)
      return res.status(400).json({ success: false, message: 'plantilla.json inválido' });

    // Extraer imágenes de guía
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

    // Crear la plantilla con nuevo ID para evitar conflictos
    const nueva = {
      ...plantilla,
      id: uuidv4(),
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };
    res.status(201).json({ success: true, data: db.createPlantilla(nueva) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
