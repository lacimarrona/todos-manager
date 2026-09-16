const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/dataAccess');

const TIMEZONE = 'America/Bogota';

function ahora() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

function procesarTareasProgramadas() {
  const now = ahora();
  const horaNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const diaNow = now.getDay(); // 0=domingo … 6=sábado

  const tareas = db.getTareasActivas();

  for (const tarea of tareas) {
    // Verificar vigencia
    if (tarea.fechaFin) {
      const fin = new Date(tarea.fechaFin + 'T23:59:59');
      if (now > fin) continue;
    }

    // Verificar que corresponde al día y hora actual
    if (!tarea.diasSemana.includes(diaNow)) continue;
    if (tarea.hora !== horaNow) continue;

    // Verificar que no exista ya una revisión creada hoy para este equipo
    const revisiones = db.getRevisiones({ equipoId: tarea.equipoId });
    const hoy = now.toISOString().slice(0, 10);
    const yaExiste = revisiones.some(r => r.creadoEn.slice(0, 10) === hoy);
    if (yaExiste) continue;

    // Obtener equipo para snapshot de ítems
    const equipo = db.getEquipoById(tarea.equipoId);
    if (!equipo || equipo.archivado) continue;

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
        estado: 'ok',
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

function iniciarCron() {
  cron.schedule('* * * * *', procesarTareasProgramadas, {
    timezone: TIMEZONE,
  });
  console.log('[cron] Tareas programadas activadas (cada minuto, zona: America/Bogota)');
}

module.exports = { iniciarCron };
