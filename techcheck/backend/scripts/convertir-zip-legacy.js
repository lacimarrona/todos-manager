/**
 * Convierte un ZIP de proyecto legacy (proyecto.json + archivos/)
 * al formato de backup JSON v2.0 con imágenes embebidas en base64.
 *
 * Uso:
 *   node scripts/convertir-zip-legacy.js <ruta-al-zip> [salida.json]
 *
 * El JSON resultante se importa desde Exportar → Importar backup JSON
 * (modo "agregar"). Las imágenes quedan embebidas como data URLs,
 * sin depender del servidor de archivos.
 */

'use strict';

const JSZip  = require('jszip');
const fs     = require('fs');
const path   = require('path');
const { v4: uuidv4 } = require('uuid');

const zipPath = process.argv[2];
const outPath = process.argv[3] || 'backup-convertido.json';

if (!zipPath) {
  console.error('Uso: node scripts/convertir-zip-legacy.js <archivo.zip> [salida.json]');
  process.exit(1);
}

(async () => {
  const buf = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(buf);

  const proyectoFile = zip.file('proyecto.json');
  if (!proyectoFile) {
    console.error('ZIP inválido: no contiene proyecto.json');
    process.exit(1);
  }

  const datos = JSON.parse(await proyectoFile.async('string'));
  const { proyecto, equipos = [], revisiones = [], tecnicos = [] } = datos;

  // Leer index.json si existe (tiene nombre real y tipo MIME)
  const idxFile = zip.file('archivos/index.json');
  const archivoIndex = idxFile ? JSON.parse(await idxFile.async('string')) : {};

  // Construir mapa hash → { base64DataUrl, nombre, tipo }
  console.log('Leyendo archivos físicos del ZIP...');
  const archivoMap = {};
  zip.forEach((relPath, file) => {
    if (file.dir) return;
    if (relPath === 'archivos/index.json') return;
    if (!relPath.startsWith('archivos/')) return;
    const hash = relPath.split('/').pop();
    if (!/^[a-f0-9]{60,64}$/.test(hash)) return; // hashes SHA-256
    archivoMap[hash] = file; // se leerá en async más adelante
  });

  // Función para reemplazar referencias URL por base64 en un array de archivos
  async function embedArchivos(archivos) {
    if (!Array.isArray(archivos) || archivos.length === 0) return archivos;
    return Promise.all(archivos.map(async (a) => {
      if (typeof a === 'string') return a;
      const hash = a.id || (a.url ? a.url.split('/').pop() : null);
      if (!hash || !archivoMap[hash]) return a;
      const buffer = await archivoMap[hash].async('nodebuffer');
      const meta   = archivoIndex[hash] || {};
      const tipo   = a.tipo || meta.tipo || 'application/octet-stream';
      const nombre = a.nombre || meta.nombre || hash;
      const b64    = buffer.toString('base64');
      return { ...a, nombre, tipo, data: `data:${tipo};base64,${b64}`, url: undefined };
    }));
  }

  // Embeber imágenes en items de revisiones
  console.log(`Procesando ${revisiones.length} revisiones...`);
  const revisionesProcesadas = await Promise.all(revisiones.map(async (r) => {
    const itemsProcesados = await Promise.all((r.items || []).map(async (item) => ({
      ...item,
      archivos:      await embedArchivos(item.archivos),
      archivosGuia:  await embedArchivos(item.archivosGuia),
    })));
    const fotos = await embedArchivos(r.fotos);
    return { ...r, items: itemsProcesados, fotos };
  }));

  // Generar IDs nuevos para proyecto y equipos (evita colisiones)
  const nuevoProyectoId = uuidv4();
  const equipoIdMap = {};
  const equiposNuevos = equipos.map((e) => {
    const nuevoId = uuidv4();
    equipoIdMap[e.id] = nuevoId;
    return {
      id:               nuevoId,
      proyecto_id:      nuevoProyectoId,
      nombre:           e.nombre,
      descripcion:      e.descripcion || '',
      items:            JSON.stringify(e.items || []),
      plantilla_id:     null,
      tecnico_asignado_id: null,
      archivado:        0,
      creado_en:        e.creadoEn || new Date().toISOString(),
      actualizado_en:   e.actualizadoEn || new Date().toISOString(),
    };
  });

  const revisionesNuevas = revisionesProcesadas
    .filter((r) => equipoIdMap[r.equipoId])
    .map((r) => ({
      id:                  uuidv4(),
      equipo_id:           equipoIdMap[r.equipoId],
      tecnico_id:          null,
      tecnico_nombre:      r.tecnicoNombre || '',
      estado:              r.estado,
      items:               JSON.stringify(r.items || []),
      observacion_general: r.observacionGeneral || '',
      fotos:               JSON.stringify(r.fotos || []),
      creado_en:           r.creadoEn || new Date().toISOString(),
      actualizado_en:      r.actualizadoEn || new Date().toISOString(),
    }));

  const backup = {
    version:     '2.0',
    exportadoEn: new Date().toISOString(),
    proyectos: [{
      id:            nuevoProyectoId,
      nombre:        proyecto.nombre,
      descripcion:   proyecto.descripcion || '',
      restringido:   0,
      creado_en:     proyecto.creadoEn || new Date().toISOString(),
      actualizado_en: proyecto.actualizadoEn || new Date().toISOString(),
    }],
    equipos:              equiposNuevos,
    revisiones:           revisionesNuevas,
    plantillas:           [],
    tareas:               [],
    usuarios:             [],
    proyectoAsignaciones: [],
    proyectoPermisos:     [],
    tecnicoSupervisores:  [],
    plantillaProyectos:   [],
    gruposElemento:       [],
    elementosGrupo:       [],
    usuarioPermisos:      [],
    tecnicos:             [],
  };

  fs.writeFileSync(outPath, JSON.stringify(backup));
  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n✓ Backup generado: ${outPath} (${sizeMB} MB)`);
  console.log(`  Proyecto : ${proyecto.nombre}`);
  console.log(`  Equipos  : ${equiposNuevos.length}`);
  console.log(`  Revisiones: ${revisionesNuevas.length}`);
  console.log(`\nImportalo desde: Exportar → Importar backup JSON → modo "agregar"`);
})();
