const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/dataAccess');
const sqliteDb = require('../db/sqlite');

const TIMEZONE = 'America/Bogota';

function ahora() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

function registrarTareaPerdida(tarea, equipo, fecha, hora) {
  const tecnico = tarea.tecnicoId ? db.getTecnicoById(tarea.tecnicoId) : null;
  const proyectoId = equipo.proyectoId || equipo.proyectoIds?.[0] || '';
  try {
    const result = sqliteDb.prepare(`
      INSERT OR IGNORE INTO tareas_no_cumplidas
        (id, tarea_id, equipo_id, equipo_nombre, proyecto_id, fecha, hora, tecnico_id, tecnico_nombre, registrado_en)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      uuidv4(),
      tarea.id,
      tarea.equipoId,
      equipo.nombre,
      proyectoId,
      fecha,
      hora,
      tarea.tecnicoId || null,
      tecnico?.nombre || '',
      new Date().toISOString(),
    );
    if (result.changes > 0) {
      console.log(`[cron] No cumplida registrada: "${equipo.nombre}" fecha ${fecha}`);
    } else {
      console.log(`[cron] No cumplida ya existía: "${equipo.nombre}" fecha ${fecha}`);
    }
  } catch (err) {
    console.error(`[cron] Error registrando no cumplida para "${equipo.nombre}":`, err.message);
  }
}

function calcVencimiento(tarea) {
  if (!tarea.fechaEspecifica) return null;
  const plazo = tarea.plazo ?? 1;
  const d = new Date(tarea.fechaEspecifica + 'T00:00:00');
  d.setDate(d.getDate() + plazo - 1);
  return d.toISOString().slice(0, 10);
}

function procesarTareasProgramadas() {
  const now = ahora();
  const horaNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const diaNow = now.getDay(); // 0=domingo … 6=sábado
  const fechaHoy = now.toISOString().slice(0, 10);

  const tareas = db.getTareasActivas();

  for (const tarea of tareas) {
    // Verificar vigencia (solo recurrentes con fechaFin)
    if (tarea.tipo !== 'fecha_especifica' && tarea.fechaFin) {
      const fin = new Date(tarea.fechaFin + 'T23:59:59');
      if (now > fin) continue;
    }

    const equipo = db.getEquipoById(tarea.equipoId);
    if (!equipo || equipo.archivado) continue;

    const revisiones = db.getRevisiones({ equipoId: tarea.equipoId });

    // ── Fecha específica ──
    if (tarea.tipo === 'fecha_especifica') {
      const fe = tarea.fechaEspecifica;
      if (!fe) continue;

      // Si el plazo venció → registrar como no cumplida y desactivar
      const venc = calcVencimiento(tarea);
      if (venc && venc < fechaHoy) {
        const hayRevision = revisiones.some(r => r.creadoEn.slice(0, 10) >= fe && r.creadoEn.slice(0, 10) <= venc);
        if (!hayRevision) registrarTareaPerdida(tarea, equipo, fe, tarea.hora);
        db.updateTarea(tarea.id, { activa: false });
        continue;
      }

      // Si es hoy y llega la hora → crear revisión automática
      if (fe === fechaHoy && tarea.hora === horaNow) {
        const yaExiste = revisiones.some(r => r.creadoEn.slice(0, 10) === fechaHoy);
        if (!yaExiste) {
          const tecnico = tarea.tecnicoId ? db.getTecnicoById(tarea.tecnicoId) : null;
          const items = equipo.items.map(i => ({
            label: typeof i === 'string' ? i : i.label,
            checked: false, nota: '', estado: null, archivos: [],
            observacionGuia: typeof i === 'string' ? '' : (i.observacionGuia || ''),
            archivosGuia: typeof i === 'string' ? [] : (i.archivosGuia || []),
          }));
          try {
            db.createRevision({
              id: uuidv4(), equipoId: tarea.equipoId,
              tecnicoId: tarea.tecnicoId || null, tecnicoNombre: tecnico?.nombre || '',
              estado: 'en_proceso', items,
              observacionGeneral: 'Revisión automática — tarea programada (fecha específica)', fotos: [],
            });
            console.log(`[cron] Revisión creada para equipo "${equipo.nombre}" (fecha específica ${fe})`);
          } catch (err) {
            console.error(`[cron] Error creando revisión para tarea ${tarea.id}:`, err.message);
          }
        }
      }
      continue; // fecha_especifica procesada, pasar a la siguiente tarea
    }

    // ── Recurrente ──
    // Detectar auto-revisiones de días anteriores no completadas
    const autoPendientes = revisiones.filter(r =>
      r.creadoEn.slice(0, 10) < fechaHoy &&
      r.estado === 'en_proceso' &&
      r.observacionGeneral?.startsWith('Revisión automática')
    );
    for (const rev of autoPendientes) {
      registrarTareaPerdida(tarea, equipo, rev.creadoEn.slice(0, 10), tarea.hora);
    }

    // Ejecutar tarea si corresponde ahora
    if (!tarea.diasSemana.includes(diaNow)) continue;
    if (tarea.hora !== horaNow) continue;

    const yaExiste = revisiones.some(r => r.creadoEn.slice(0, 10) === fechaHoy);
    if (yaExiste) continue;

    const tecnico = tarea.tecnicoId ? db.getTecnicoById(tarea.tecnicoId) : null;
    const items = equipo.items.map(i => ({
      label: typeof i === 'string' ? i : i.label,
      checked: false,
      nota: '',
      estado: null,
      archivos: [],
      observacionGuia: typeof i === 'string' ? '' : (i.observacionGuia || ''),
      archivosGuia: typeof i === 'string' ? [] : (i.archivosGuia || []),
    }));

    try {
      db.createRevision({
        id: uuidv4(),
        equipoId: tarea.equipoId,
        tecnicoId: tarea.tecnicoId || null,
        tecnicoNombre: tecnico?.nombre || '',
        estado: 'en_proceso',
        items,
        observacionGeneral: 'Revisión automática — tarea programada',
        fotos: [],
      });
      console.log(`[cron] Revisión creada para equipo "${equipo.nombre}" (tarea ${tarea.id})`);
    } catch (err) {
      console.error(`[cron] Error creando revisión para tarea ${tarea.id}:`, err.message);
    }
  }
}

function escanearRecuperacion() {
  const now = ahora();
  const fechaHoy = now.toISOString().slice(0, 10);
  const tareas = db.getTareasActivas();
  let recuperadas = 0;

  for (const tarea of tareas) {
    const equipo = db.getEquipoById(tarea.equipoId);
    if (!equipo || equipo.archivado) continue;

    const revisiones = db.getRevisiones({ equipoId: tarea.equipoId });
    const fechasConRevision = new Set(revisiones.map(r => r.creadoEn.slice(0, 10)));

    // ── Fecha específica: si ya pasó sin revisión → registrar como no cumplida ──
    if (tarea.tipo === 'fecha_especifica') {
      const fe = tarea.fechaEspecifica;
      console.log(`[startup] Fecha específica: "${equipo.nombre}" fe=${fe} hoy=${fechaHoy} hayRev=${fechasConRevision.has(fe)}`);
      const venc = calcVencimiento(tarea);
      if (venc && venc < fechaHoy) {
        const hayRevision = [...fechasConRevision].some(f => f >= fe && f <= venc);
        if (!hayRevision) registrarTareaPerdida(tarea, equipo, fe, tarea.hora);
        db.updateTarea(tarea.id, { activa: false });
      }
      continue;
    }

    // ── Recurrente: recuperar revisiones perdidas por downtime ──
    if (tarea.fechaFin && new Date(tarea.fechaFin + 'T23:59:59') < now) continue;

    // Si ya hay revisión hoy, no crear otra
    if (fechasConRevision.has(fechaHoy)) continue;

    // Buscar la fecha más reciente (hasta 7 días atrás) donde debía ejecutarse y no hay revisión
    let fechaRecuperar = null;
    for (let d = 1; d <= 7; d++) {
      const dia = new Date(now);
      dia.setDate(dia.getDate() - d);
      const fechaStr = dia.toISOString().slice(0, 10);
      const diaSemana = dia.getDay();

      if (!tarea.diasSemana.includes(diaSemana)) continue;
      if (fechasConRevision.has(fechaStr)) continue;

      fechaRecuperar = fechaStr;
      break;
    }

    if (!fechaRecuperar) continue;

    const tecnico = tarea.tecnicoId ? db.getTecnicoById(tarea.tecnicoId) : null;
    const items = equipo.items.map(i => ({
      label: typeof i === 'string' ? i : i.label,
      checked: false, nota: '', estado: null, archivos: [],
      observacionGuia: typeof i === 'string' ? '' : (i.observacionGuia || ''),
      archivosGuia: typeof i === 'string' ? [] : (i.archivosGuia || []),
    }));

    try {
      db.createRevision({
        id: uuidv4(),
        equipoId: tarea.equipoId,
        tecnicoId: tarea.tecnicoId || null,
        tecnicoNombre: tecnico?.nombre || '',
        estado: 'en_proceso',
        items,
        observacionGeneral: `Revisión automática — recuperación por servidor caído (programada: ${fechaRecuperar} ${tarea.hora})`,
        fotos: [],
      });
      recuperadas++;
      console.log(`[startup] Recuperación: revisión creada para "${equipo.nombre}" (programada: ${fechaRecuperar} ${tarea.hora})`);
    } catch (err) {
      console.error(`[startup] Error en recuperación para tarea ${tarea.id}:`, err.message);
    }
  }

  if (recuperadas > 0) {
    console.log(`[startup] ${recuperadas} revisión(es) recuperada(s) por downtime del servidor`);
  }
}

function iniciarCron() {
  escanearRecuperacion();
  cron.schedule('* * * * *', procesarTareasProgramadas, {
    timezone: TIMEZONE,
  });
  console.log('[cron] Tareas programadas activadas (cada minuto, zona: America/Bogota)');
}

module.exports = { iniciarCron };
