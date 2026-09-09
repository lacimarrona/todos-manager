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
const ARCHIVOS_INDEX_PATH = path.join(ARCHIVOS_DIR, 'index.json');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

function readArchivoIndex() {
  if (!fs.existsSync(ARCHIVOS_INDEX_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(ARCHIVOS_INDEX_PATH, 'utf-8')); } catch { return {}; }
}
function writeArchivoIndex(idx) {
  if (!fs.existsSync(ARCHIVOS_DIR)) fs.mkdirSync(ARCHIVOS_DIR, { recursive: true });
  fs.writeFileSync(ARCHIVOS_INDEX_PATH, JSON.stringify(idx, null, 2));
}

router.get('/', (req, res) => {
  try {
    const proyectos = db.getProyectos();
    const equipos = db.getEquipos();
    const enriquecidos = proyectos.map(p => ({
      ...p,
      totalEquipos: equipos.filter(e => e.proyectoIds && e.proyectoIds.includes(p.id)).length
    }));
    res.json({ success: true, data: enriquecidos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Solo equipos pendientes (sin revision completa)
router.get('/:id/equipos', (req, res) => {
  try {
    const proyecto = db.getProyectoById(req.params.id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    const equipos = db.getEquipos().filter(e => e.proyectoIds && e.proyectoIds.includes(req.params.id));
    const revisiones = db.getRevisiones();
    const enriquecidos = equipos.map(e => {
      const revsEquipo = revisiones.filter(r => r.equipoId === e.id);
      const ultima = revsEquipo.length > 0
        ? revsEquipo.reduce((a, b) => new Date(a.creadoEn) > new Date(b.creadoEn) ? a : b)
        : null;
      const tecnico = e.tecnicoAsignadoId ? db.getTecnicoById(e.tecnicoAsignadoId) : null;
      return { ...e, ultimaRevision: ultima, totalRevisiones: revsEquipo.length, tecnicoAsignadoNombre: tecnico?.nombre || '' };
    });

    const filtro = req.query.estado;
    let resultado = enriquecidos;

    if (filtro === 'archivado') {
      resultado = enriquecidos.filter(e => e.archivado === true);
    } else if (filtro === 'pendiente') {
      resultado = enriquecidos.filter(e => !e.archivado && !e.ultimaRevision);
    } else if (filtro === 'en_proceso') {
      resultado = enriquecidos.filter(e => {
        if (e.archivado) return false;
        if (!e.ultimaRevision) return false;
        const total = e.items.length;
        if (total === 0) return false;
        const completados = e.ultimaRevision.items.filter(i => i.checked).length;
        return completados > 0 && completados < total;
      });
    } else if (filtro === 'terminado') {
      resultado = enriquecidos.filter(e => {
        if (e.archivado) return false;
        if (!e.ultimaRevision) return false;
        const total = e.items.length;
        if (total === 0) return false;
        const completados = e.ultimaRevision.items.filter(i => i.checked).length;
        return completados === total;
      });
    }

    res.json({ success: true, data: resultado });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Todos los equipos sin filtrar (para historial)
router.get('/:id/todos-equipos', (req, res) => {
  try {
    const proyecto = db.getProyectoById(req.params.id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    const equipos = db.getEquipos().filter(e => e.proyectoIds && e.proyectoIds.includes(req.params.id));
    res.json({ success: true, data: equipos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const proyecto = db.getProyectoById(req.params.id);
    if (!proyecto) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    res.json({ success: true, data: proyecto });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre) return res.status(400).json({ success: false, message: 'El nombre es requerido' });
    const nuevo = {
      id: uuidv4(),
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || '',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };
    res.status(201).json({ success: true, data: db.createProyecto(nuevo) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    const actualizado = db.updateProyecto(req.params.id, { nombre, descripcion });
    if (!actualizado) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    res.json({ success: true, data: actualizado });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const eliminado = db.deleteProyecto(req.params.id);
    if (!eliminado) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    res.json({ success: true, message: 'Proyecto eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Exportar proyecto como JSON
router.get('/:id/exportar', (req, res) => {
  try {
    const datos = db.exportarProyecto(req.params.id);
    if (!datos) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    res.json({ success: true, data: datos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Migrar imágenes existentes al almacenamiento por proyecto
// Mueve URLs /api/archivos/{hash} → /api/archivos/{proyectoId}/{hash} en todos los proyectos.
// Operación idempotente: si el archivo ya está en la carpeta del proyecto, no lo vuelve a copiar.
router.post('/migrar-archivos', (req, res) => {
  try {
    const g = db.readGlobal();
    let archivosCopiados = 0;
    const proyectosMigrados = [];

    function migrateValue(val, proyectoId) {
      if (Array.isArray(val)) return val.map(item => migrateValue(item, proyectoId));
      if (val && typeof val === 'object') {
        const result = {};
        for (const [k, v] of Object.entries(val)) {
          if (k === 'url' && typeof v === 'string' && v.startsWith('/api/archivos/')) {
            const subpath = v.replace('/api/archivos/', '');
            const segments = subpath.split('/');
            if (segments.length === 1 && /^[a-f0-9]{64}$/.test(segments[0])) {
              // URL antigua de un solo segmento → migrar
              const hash = segments[0];
              const srcPath = path.join(ARCHIVOS_DIR, hash);
              const destDir = path.join(ARCHIVOS_DIR, proyectoId);
              const destPath = path.join(destDir, hash);
              if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
                if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
                fs.copyFileSync(srcPath, destPath);
                archivosCopiados++;
              }
              result[k] = `/api/archivos/${proyectoId}/${hash}`;
            } else {
              result[k] = v; // ya tiene proyectoId o no es hash — no tocar
            }
          } else {
            result[k] = migrateValue(v, proyectoId);
          }
        }
        return result;
      }
      return val;
    }

    for (const proyecto of g.proyectos) {
      const data = db.readProyectoData(proyecto.id);
      const updatedData = migrateValue(data, proyecto.id);
      if (JSON.stringify(data) !== JSON.stringify(updatedData)) {
        db.writeProyectoData(proyecto.id, updatedData);
        proyectosMigrados.push(proyecto.nombre);
      }
    }

    res.json({
      success: true,
      data: {
        archivosCopiados,
        proyectosMigrados,
        mensaje: proyectosMigrados.length
          ? `Migración completada: ${archivosCopiados} archivo(s) copiado(s) en ${proyectosMigrados.length} proyecto(s)`
          : 'No había archivos que migrar',
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Importar proyecto desde JSON
router.post('/importar', (req, res) => {
  try {
    const datos = req.body;
    if (!datos || !datos.proyecto) return res.status(400).json({ success: false, message: 'Datos invalidos' });
    const nuevo = db.importarProyecto(datos);
    res.status(201).json({ success: true, data: nuevo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Exportar proyecto como ZIP (JSON + archivos físicos)
router.get('/:id/exportar-zip', async (req, res) => {
  try {
    const datos = db.exportarProyecto(req.params.id);
    if (!datos) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

    const zip = new JSZip();
    zip.file('proyecto.json', JSON.stringify(datos, null, 2));

    // Recoger todos los subpaths referenciados en el proyecto
    // subpath puede ser "{hash}" (global) o "{proyectoId}/{hash}" (por proyecto)
    const subpaths = db.collectArchivoHashes({ equipos: datos.equipos, revisiones: datos.revisiones });
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
    const nombre = `${datos.proyecto.nombre.replace(/[^a-zA-Z0-9_\-]/g, '_')}_techcheck.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Importar proyecto desde ZIP
router.post('/importar-zip', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió ningún archivo' });

    const zip = await JSZip.loadAsync(req.file.buffer);

    // Extraer proyecto.json
    const proyectoFile = zip.file('proyecto.json');
    if (!proyectoFile) return res.status(400).json({ success: false, message: 'ZIP inválido: falta proyecto.json' });
    const datos = JSON.parse(await proyectoFile.async('string'));
    if (!datos || !datos.proyecto) return res.status(400).json({ success: false, message: 'proyecto.json inválido' });

    // Extraer archivos físicos y actualizar el índice
    const archivoIndex = readArchivoIndex();
    let indexActualizado = false;

    // Leer index.json del ZIP si existe
    const zipIndexFile = zip.file('archivos/index.json');
    const zipIndex = zipIndexFile ? JSON.parse(await zipIndexFile.async('string')) : {};

    if (!fs.existsSync(ARCHIVOS_DIR)) fs.mkdirSync(ARCHIVOS_DIR, { recursive: true });

    const archivosFolder = zip.folder('archivos');
    const archivosFiles = [];
    archivosFolder.forEach((relPath, file) => {
      if (relPath !== 'index.json' && !file.dir) archivosFiles.push({ relPath, file });
    });

    for (const { relPath, file } of archivosFiles) {
      // relPath puede ser "{hash}" (global) o "{proyectoId}/{hash}" (por proyecto)
      const hash = relPath.split('/').pop();
      if (!/^[a-f0-9]{64}$/.test(hash)) continue;
      const destPath = path.join(ARCHIVOS_DIR, relPath);
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      if (!fs.existsSync(destPath)) {
        const buffer = await file.async('nodebuffer');
        // Verificar integridad
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

    const nuevo = db.importarProyecto(datos);
    res.status(201).json({ success: true, data: nuevo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Restaurar backup completo del servidor (ZIP con data/global.json + data/proyectos/ + data/archivos/)
router.post('/restaurar-backup', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió ningún archivo' });

    const zip = await JSZip.loadAsync(req.file.buffer);

    const globalFile = zip.file('data/global.json');
    if (!globalFile) return res.status(400).json({ success: false, message: 'ZIP inválido: falta data/global.json. Asegúrate de que es un backup del servidor.' });

    const globalData = JSON.parse(await globalFile.async('string'));
    const { proyectos = [], tecnicos = [], plantillas = [] } = globalData;

    // Copiar archivos físicos preservando el hash como nombre
    if (!fs.existsSync(ARCHIVOS_DIR)) fs.mkdirSync(ARCHIVOS_DIR, { recursive: true });
    const archivoIndex = readArchivoIndex();
    let archivosImportados = 0;

    const archivosFolder = zip.folder('data/archivos');
    if (archivosFolder) {
      const archivosFiles = [];
      // relPath puede ser "{hash}" (global/antiguo) o "{proyectoId}/{hash}" (por proyecto)
      archivosFolder.forEach((relPath, file) => { if (!file.dir) archivosFiles.push({ relPath, file }); });
      for (const { relPath, file } of archivosFiles) {
        const hash = relPath.split('/').pop();
        if (!/^[a-f0-9]{64}$/.test(hash)) continue;
        const destPath = path.join(ARCHIVOS_DIR, relPath);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        if (!fs.existsSync(destPath)) {
          const buffer = await file.async('nodebuffer');
          fs.writeFileSync(destPath, buffer);
          archivosImportados++;
        }
        if (!archivoIndex[hash]) {
          archivoIndex[hash] = { nombre: hash, tipo: 'application/octet-stream' };
        }
      }
      writeArchivoIndex(archivoIndex);
    }

    // Restaurar tecnicos, plantillas y proyectos preservando IDs originales
    const g = db.readGlobal();

    // Merge tecnicos por ID (preserva referencias de equipos y revisiones)
    const tecnicosIdsExistentes = new Set(g.tecnicos.map(t => t.id));
    for (const tecnico of tecnicos) {
      if (!tecnicosIdsExistentes.has(tecnico.id)) {
        g.tecnicos.push(tecnico);
        tecnicosIdsExistentes.add(tecnico.id);
      }
    }

    // Merge plantillas por nombre
    const plantillasNombresExistentes = new Set(g.plantillas.map(p => p.nombre));
    for (const plantilla of plantillas) {
      if (!plantillasNombresExistentes.has(plantilla.nombre)) {
        g.plantillas.push(plantilla);
        plantillasNombresExistentes.add(plantilla.nombre);
      }
    }

    // Merge proyectos por ID — importa nuevos, actualiza existentes si el backup es más reciente
    let importados = 0;
    let actualizados = 0;
    const proyectosImportados = [];
    const proyectosActualizados = [];

    for (const proyecto of proyectos) {
      const proyectoFile = zip.file(`data/proyectos/${proyecto.id}.json`);
      if (!proyectoFile) continue;
      let proyectoData;
      try { proyectoData = JSON.parse(await proyectoFile.async('string')); } catch { continue; }

      const idxExistente = g.proyectos.findIndex(p => p.id === proyecto.id);

      if (idxExistente === -1) {
        // Proyecto nuevo: agregar
        g.proyectos.push(proyecto);
        db.writeProyectoData(proyecto.id, {
          equipos: proyectoData.equipos || [],
          revisiones: proyectoData.revisiones || []
        });
        importados++;
        proyectosImportados.push(proyecto.nombre);
      } else {
        // Proyecto existente: actualizar solo si el backup es más reciente
        const fechaExistente = new Date(g.proyectos[idxExistente].actualizadoEn || 0);
        const fechaBackup    = new Date(proyecto.actualizadoEn || 0);
        if (fechaBackup > fechaExistente) {
          g.proyectos[idxExistente] = proyecto;
          db.writeProyectoData(proyecto.id, {
            equipos: proyectoData.equipos || [],
            revisiones: proyectoData.revisiones || []
          });
          actualizados++;
          proyectosActualizados.push(proyecto.nombre);
        }
      }
    }

    db.writeGlobal(g);

    const partes = [];
    if (importados)  partes.push(`${importados} proyecto(s) importado(s)`);
    if (actualizados) partes.push(`${actualizados} proyecto(s) actualizado(s)`);
    if (archivosImportados) partes.push(`${archivosImportados} archivo(s) copiado(s)`);
    const mensaje = partes.length ? partes.join(', ') : 'No hubo cambios nuevos que aplicar';

    res.json({
      success: true,
      data: {
        importados,
        actualizados,
        archivosImportados,
        proyectosImportados,
        proyectosActualizados,
        mensaje,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;