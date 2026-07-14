'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { TareaProgramada, Equipo, ItemEquipo, Revision, ItemRevision } = require('../models');

const isProd = process.env.NODE_ENV === 'production';
const log   = (...args) => { if (!isProd) console.log(...args); };

// Normaliza el valor TIME que MySQL puede devolver como string o Date
function horaString(valor) {
  if (!valor) return '';
  // Si es un objeto Date (algunos drivers lo convierten)
  if (valor instanceof Date) {
    const hh = String(valor.getUTCHours()).padStart(2, '0');
    const mm = String(valor.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  // Si es string "HH:MM:SS" → tomar solo "HH:MM"
  return String(valor).slice(0, 5);
}

async function procesarTareasProgramadas() {
  // node-cron fires at the right Bogotá minute, but new Date() is UTC.
  // Convert explicitly so the hour/day comparison matches stored values.
  const ahoraBogota = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const hh = String(ahoraBogota.getHours()).padStart(2, '0');
  const mm = String(ahoraBogota.getMinutes()).padStart(2, '0');
  const horaActual = `${hh}:${mm}`;
  const diaActual  = ahoraBogota.getDay(); // 0=dom, 1=lun … 6=sáb

  try {
    const tareas = await TareaProgramada.findAll({
      where: { activa: true },
      include: [{
        model: Equipo,
        as: 'equipo',
        attributes: ['id', 'nombre', 'tecnico_asignado_id'],
      }],
    });

    // Filtrar por hora y día en memoria (evita función SQL sobre JSON)
    const coinciden = tareas.filter(t => {
      if (horaString(t.hora) !== horaActual) return false;
      const dias = Array.isArray(t.dias_semana) ? t.dias_semana : [];
      return dias.includes(diaActual);
    });

    if (!coinciden.length) return;

    log(`[cron ${horaActual}] ${coinciden.length} tarea(s) a procesar`);

    for (const tarea of coinciden) {
      // Guardia: no crear si ya hay una revisión activa (pendiente o en_proceso)
      const activa = await Revision.findOne({
        where: {
          equipo_id: tarea.equipo_id,
          estado: { [Op.not]: 'terminado' },
        },
      });
      if (activa) {
        log(`[cron] Equipo ${tarea.equipo_id}: revisión activa (id=${activa.id}, estado=${activa.estado}), omitiendo`);
        continue;
      }

      // Crear revisión + ítems en una sola transacción para evitar revisiones huérfanas
      let revisionId;
      let itemCount;
      await sequelize.transaction(async (t) => {
        const items = await ItemEquipo.findAll({
          where: { equipo_id: tarea.equipo_id },
          order: [['orden', 'ASC']],
          transaction: t,
        });

        const revision = await Revision.create({
          equipo_id:  tarea.equipo_id,
          tecnico_id: tarea.equipo.tecnico_asignado_id || null,
          estado:     'pendiente',
        }, { transaction: t });

        if (items.length) {
          await ItemRevision.bulkCreate(
            items.map(item => ({
              revision_id: revision.id,
              item_id:     item.id,
              label:       item.label,
              checked:     false,
              nota:        null,
            })),
            { transaction: t }
          );
        }

        revisionId = revision.id;
        itemCount  = items.length;
      });

      log(`[cron] Revisión ${revisionId} creada — equipo "${tarea.equipo.nombre}" (${itemCount} ítems)`);
    }
  } catch (err) {
    console.error('[cron] Error al procesar tareas programadas:', err.message);
  }
}

function iniciarCron() {
  // Se ejecuta al inicio de cada minuto
  cron.schedule('* * * * *', procesarTareasProgramadas, { timezone: 'America/Bogota' });
  log('[cron] Tareas programadas activas (cada minuto, zona: America/Bogota)');
}

module.exports = { iniciarCron, procesarTareasProgramadas };
