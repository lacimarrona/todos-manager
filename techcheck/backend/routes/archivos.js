const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ARCHIVOS_DIR = path.join(__dirname, '../data/archivos');
const INDEX_PATH = path.join(ARCHIVOS_DIR, 'index.json');

if (!fs.existsSync(ARCHIVOS_DIR)) fs.mkdirSync(ARCHIVOS_DIR, { recursive: true });

function readIndex() {
  if (!fs.existsSync(INDEX_PATH)) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify({}));
    return {};
  }
  return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
}

function writeIndex(data) {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(data, null, 2));
}

// POST /api/archivos — sube archivo con deduplicación por hash SHA-256
// Body: { nombre, tipo, data, proyectoId? }
// Si se proporciona proyectoId, almacena en data/archivos/{proyectoId}/{hash}
// y devuelve url /api/archivos/{proyectoId}/{hash}.
// Sin proyectoId (plantillas globales) almacena en data/archivos/{hash}.
router.post('/', (req, res) => {
  try {
    const { nombre, tipo, data, proyectoId } = req.body;
    if (!data) return res.status(400).json({ success: false, message: 'Datos del archivo requeridos' });

    const matches = data.match(/^data:([^;]+);base64,(.+)$/s);
    if (!matches) return res.status(400).json({ success: false, message: 'Formato de archivo invalido (se esperaba data URL base64)' });

    const mimeType = tipo || matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    const index = readIndex();

    if (proyectoId) {
      const proyectoDir = path.join(ARCHIVOS_DIR, proyectoId);
      if (!fs.existsSync(proyectoDir)) fs.mkdirSync(proyectoDir, { recursive: true });
      const filePath = path.join(proyectoDir, hash);
      if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, buffer);
      if (!index[hash]) {
        index[hash] = { nombre: nombre || 'archivo_adjunto', tipo: mimeType };
        writeIndex(index);
      }
      return res.json({
        success: true,
        data: {
          id: hash,
          nombre: index[hash].nombre,
          tipo: index[hash].tipo,
          url: `/api/archivos/${proyectoId}/${hash}`,
        }
      });
    }

    // Sin proyectoId: almacenamiento global (plantillas)
    if (!index[hash]) {
      fs.writeFileSync(path.join(ARCHIVOS_DIR, hash), buffer);
      index[hash] = { nombre: nombre || 'archivo_adjunto', tipo: mimeType };
      writeIndex(index);
    }

    res.json({
      success: true,
      data: {
        id: hash,
        nombre: index[hash].nombre,
        tipo: index[hash].tipo,
        url: `/api/archivos/${hash}`,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/archivos/:proyectoId/:hash — sirve archivo de un proyecto específico
router.get('/:proyectoId/:hash', (req, res) => {
  try {
    const { proyectoId, hash } = req.params;
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      return res.status(400).json({ success: false, message: 'Hash invalido' });
    }

    const filePath = path.join(ARCHIVOS_DIR, proyectoId, hash);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Archivo no encontrado' });

    const index = readIndex();
    const meta = index[hash] || { nombre: hash, tipo: 'application/octet-stream' };

    res.setHeader('Content-Type', meta.tipo);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.nombre)}"`);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/archivos/:hash — sirve archivo global (plantillas, datos previos)
router.get('/:hash', (req, res) => {
  try {
    const { hash } = req.params;
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      return res.status(400).json({ success: false, message: 'Hash invalido' });
    }

    const index = readIndex();
    const meta = index[hash];
    if (!meta) return res.status(404).json({ success: false, message: 'Archivo no encontrado' });

    const filePath = path.join(ARCHIVOS_DIR, hash);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Archivo no encontrado en disco' });

    res.setHeader('Content-Type', meta.tipo);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.nombre)}"`);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
