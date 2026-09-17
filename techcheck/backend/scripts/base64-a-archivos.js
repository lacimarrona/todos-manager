'use strict';
const db     = require('../db/sqlite');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const ARCHIVOS_DIR  = path.join(__dirname, '../data/archivos');
const INDEX_PATH    = path.join(ARCHIVOS_DIR, 'index.json');

function readIndex() {
  if (!fs.existsSync(INDEX_PATH)) return {};
  return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
}
function writeIndex(idx) {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(idx, null, 2));
}

function extraerBase64(dataUrl) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) return null;
  return { tipo: m[1], buffer: Buffer.from(m[2], 'base64') };
}

function procesarArchivos(archivos, proyectoId, idx) {
  if (!Array.isArray(archivos)) return { archivos, cambios: 0 };
  let cambios = 0;
  const nuevos = archivos.map(a => {
    if (!a || typeof a !== 'object') return a;
    if (!a.data || !a.data.startsWith('data:')) return a; // ya es URL o está vacío
    const extraido = extraerBase64(a.data);
    if (!extraido) return a;
    const hash = crypto.createHash('sha256').update(extraido.buffer).digest('hex');
    const dir  = path.join(ARCHIVOS_DIR, proyectoId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, hash);
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, extraido.buffer);
    if (!idx[hash]) idx[hash] = { nombre: a.nombre || hash, tipo: extraido.tipo };
    cambios++;
    return { id: hash, nombre: a.nombre || hash, tipo: extraido.tipo, url: `/api/archivos/${proyectoId}/${hash}` };
  });
  return { archivos: nuevos, cambios };
}

function procesarItems(items, proyectoId, idx) {
  if (!Array.isArray(items)) return { items, cambios: 0 };
  let total = 0;
  const nuevos = items.map(item => {
    if (!item) return item;
    const r1 = procesarArchivos(item.archivos, proyectoId, idx);
    const r2 = procesarArchivos(item.archivosGuia, proyectoId, idx);
    total += r1.cambios + r2.cambios;
    return { ...item, archivos: r1.archivos, archivosGuia: r2.archivos };
  });
  return { items: nuevos, cambios: total };
}

(async () => {
  const idx = readIndex();
  let totalCambios = 0;

  const revisiones = db.prepare('SELECT id, equipo_id, items, fotos FROM revisiones').all();
  console.log(`Procesando ${revisiones.length} revisiones...`);

  const updateStmt = db.prepare('UPDATE revisiones SET items = ?, fotos = ? WHERE id = ?');

  for (const rev of revisiones) {
    // Obtener proyecto_id del equipo
    const equipo = db.prepare('SELECT proyecto_id FROM equipos WHERE id = ?').get(rev.equipo_id);
    const proyectoId = equipo ? equipo.proyecto_id : 'global';

    let items, fotos;
    try { items = JSON.parse(rev.items || '[]'); } catch { items = []; }
    try { fotos = JSON.parse(rev.fotos  || '[]'); } catch { fotos = []; }

    const r1 = procesarItems(items, proyectoId, idx);
    const r2 = procesarArchivos(fotos, proyectoId, idx);

    if (r1.cambios + r2.cambios > 0) {
      updateStmt.run(JSON.stringify(r1.items), JSON.stringify(r2.archivos), rev.id);
      totalCambios += r1.cambios + r2.cambios;
      process.stdout.write('.');
    }
  }

  writeIndex(idx);
  console.log(`\n✓ Listo. ${totalCambios} imágenes extraídas a disco.`);
  console.log('Reinicia el servidor para que tome los cambios.');
})();
