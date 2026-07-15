'use strict';

const MIMES_IMAGEN    = /^data:image\/(jpeg|png|webp|gif);base64,/;
const MIMES_DOCUMENTO = /^data:application\/(pdf|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation));base64,/;
const MAX_ARCHIVOS_POR_ITEM = 5;

function validarDataUrl(url, tipo) {
  if (tipo === 'imagen')    return MIMES_IMAGEN.test(url);
  if (tipo === 'documento') return MIMES_DOCUMENTO.test(url);
  return false;
}

const { sequelize } = require('../config/database');
const { Revision, ItemRevision, ArchivoRevision, ArchivoObsGeneral, Equipo, Proyecto, ProyectoPermiso, ItemEquipo, Usuario, ItemPlantilla } = require('../models');
const { wsId } = require('../utils/workspace');

// Verifica acceso al proyecto incluyendo la restricción de proyecto_permisos
// (misma lógica que findProyectoConAcceso en proyecto.controller.js)
async function findProyectoConAcceso(id, workspaceId, userId, rol) {
  const where = { id };
  if (workspaceId) where.workspace_id = workspaceId;
  const proyecto = await Proyecto.findOne({ where });
  if (!proyecto) return null;
  if (rol === 'usuario' && proyecto.restringido) {
    const permiso = await ProyectoPermiso.findOne({ where: { proyecto_id: id, usuario_id: userId } });
    if (!permiso) return null;
  }
  return proyecto;
}

// Verifica que el técnico (si viene informado) pertenece al workspace del usuario
async function tecnicoValido(tecnicoId, workspaceId) {
  if (!tecnicoId) return true;
  const usuario = await Usuario.findOne({
    where: { id: tecnicoId, ...(workspaceId ? { workspace_id: workspaceId } : {}) },
  });
  return !!usuario;
}

// Includes estándar para una revisión completa
function buildRevisionIncludes() {
  return [
    {
      model: ItemRevision,
      as: 'items',
      separate: true,
      order: [['id', 'ASC']],
      include: [{ model: ArchivoRevision, as: 'archivos', required: false }],
    },
    {
      model: ArchivoObsGeneral,
      as: 'archivos_obs',
      required: false,
    },
    {
      model: Usuario,
      as: 'tecnico',
      attributes: ['id', 'nombre', 'email'],
      required: false,
    },
    {
      model: Equipo,
      as: 'equipo',
      attributes: ['id', 'nombre'],
      include: [{ model: Proyecto, as: 'proyecto', attributes: ['id', 'nombre', 'workspace_id'] }],
    },
  ];
}

// Carga la revisión verificando que pertenece al workspace del usuario
async function findRevisionConAcceso(revisionId, workspaceId) {
  const revision = await Revision.findByPk(revisionId, {
    include: [{
      model: Equipo,
      as: 'equipo',
      include: [{ model: Proyecto, as: 'proyecto', attributes: ['id', 'workspace_id'] }],
    }],
  });
  if (!revision) return null;
  if (workspaceId && revision.equipo.proyecto.workspace_id !== workspaceId) return null;
  return revision;
}

const revisionController = {
  // ── CRUD de Revisión ────────────────────────────────────────────────────────

  async listByEquipo(req, res) {
    try {
      // Verificar que el equipo pertenece al workspace
      const equipo = await Equipo.findByPk(req.params.equipoId, {
        include: [{ model: Proyecto, as: 'proyecto', attributes: ['id', 'workspace_id'] }],
      });
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });
      if (wsId(req) && equipo.proyecto.workspace_id !== wsId(req)) {
        return res.status(404).json({ error: 'Equipo no encontrado' });
      }

      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const { count, rows } = await Revision.findAndCountAll({
        where: { equipo_id: equipo.id },
        include: [
          { model: Usuario,     as: 'tecnico', attributes: ['id', 'nombre'], required: false },
          { model: ItemRevision, as: 'items',  attributes: ['id'], required: false },
        ],
        order:  [['id', 'DESC']],
        limit,
        offset,
        distinct: true,
      });
      return res.json({
        data:  rows.map(r => ({ ...r.toJSON(), item_count: r.items?.length ?? 0 })),
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      });
    } catch (err) {
      console.error('[revision/listByEquipo]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async getOne(req, res) {
    try {
      const revision = await findRevisionConAcceso(req.params.id, wsId(req));
      if (!revision) return res.status(404).json({ error: 'Revisión no encontrada' });

      await revision.reload({ include: buildRevisionIncludes() });

      // Si la revisión no está terminada, sincronizar ítems con el equipo actual.
      // Usar transacción para evitar race condition con peticiones concurrentes al mismo GET.
      if (revision.estado !== 'terminado') {
        await sequelize.transaction(async (t) => {
          const itemsEquipo = await ItemEquipo.findAll({
            where: { equipo_id: revision.equipo_id },
            order: [['orden', 'ASC']],
            transaction: t,
          });

          // Re-leer los items actuales dentro de la transacción para evitar duplicados
          const revItems = await ItemRevision.findAll({
            where: { revision_id: revision.id },
            transaction: t,
          });

          const revItemIds   = new Set(revItems.map(i => i.item_id).filter(Boolean));
          const equipoItemIds = new Set(itemsEquipo.map(i => i.id));

          const toAdd = itemsEquipo.filter(i => !revItemIds.has(i.id));
          if (toAdd.length) {
            await ItemRevision.bulkCreate(toAdd.map(item => ({
              revision_id: revision.id,
              item_id:     item.id,
              label:       item.label,
              checked:     false,
              nota:        null,
            })), { transaction: t, ignoreDuplicates: true });
          }

          const toRemove = revItems.filter(
            i => i.item_id && !equipoItemIds.has(i.item_id) && !i.checked
          );
          if (toRemove.length) {
            await ItemRevision.destroy({ where: { id: toRemove.map(i => i.id) }, transaction: t });
          }
        });

        await revision.reload({ include: buildRevisionIncludes() });
      }

      return res.json(revision);
    } catch (err) {
      console.error('[revision/getOne]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Crea una revisión y genera items_revision desde items_equipo (snapshot)
  async create(req, res) {
    try {
      const { equipo_id, tecnico_id, observacion_general } = req.body;
      if (!equipo_id) return res.status(400).json({ error: 'equipo_id es requerido' });

      // Verificar acceso al equipo a través del proyecto
      const equipo = await Equipo.findByPk(equipo_id, {
        include: [{ model: Proyecto, as: 'proyecto', attributes: ['id', 'workspace_id'] }],
      });
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });
      if (wsId(req) && equipo.proyecto.workspace_id !== wsId(req)) {
        return res.status(404).json({ error: 'Equipo no encontrado' });
      }

      if (!(await tecnicoValido(tecnico_id, wsId(req)))) {
        return res.status(404).json({ error: 'Técnico no encontrado' });
      }

      // Obtener ítems actuales del equipo (snapshot en el momento de crear la revisión)
      const itemsEquipo = await ItemEquipo.findAll({
        where: { equipo_id },
        order: [['orden', 'ASC']],
      });

      const revision = await Revision.create({
        equipo_id,
        tecnico_id: tecnico_id || null,
        observacion_general: observacion_general || null,
        estado: 'pendiente',
      });

      if (itemsEquipo.length) {
        await ItemRevision.bulkCreate(
          itemsEquipo.map(item => ({
            revision_id: revision.id,
            item_id: item.id,
            label: item.label,
            checked: false,
            nota: null,
          }))
        );
      }

      await revision.reload({ include: buildRevisionIncludes() });
      return res.status(201).json(revision);
    } catch (err) {
      console.error('[revision/create]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // Actualiza estado y/u observación general de la revisión
  async update(req, res) {
    try {
      const revision = await findRevisionConAcceso(req.params.id, wsId(req));
      if (!revision) return res.status(404).json({ error: 'Revisión no encontrada' });

      const ESTADOS = ['pendiente', 'en_proceso', 'terminado'];
      const { estado, observacion_general, tecnico_id, estado_calidad } = req.body;

      if (estado && !ESTADOS.includes(estado)) {
        return res.status(400).json({ error: `estado debe ser: ${ESTADOS.join(', ')}` });
      }
      const CALIDADES = ['ok', 'observacion', 'problema'];
      if (estado_calidad && !CALIDADES.includes(estado_calidad)) {
        return res.status(400).json({ error: `estado_calidad debe ser: ${CALIDADES.join(', ')}` });
      }

      // Validar que todos los ítems estén chequeados antes de marcar como terminado
      if (estado === 'terminado') {
        const items = await ItemRevision.findAll({ where: { revision_id: revision.id } });
        const sinChequear = items.filter(i => !i.checked);
        if (sinChequear.length > 0) {
          return res.status(400).json({
            error: `No puedes terminar la revisión: faltan ${sinChequear.length} ítem(s) por revisar.`,
          });
        }
      }

      if (!(await tecnicoValido(tecnico_id, wsId(req)))) {
        return res.status(404).json({ error: 'Técnico no encontrado' });
      }

      await revision.update({ estado, observacion_general, tecnico_id, estado_calidad });
      await revision.reload({ include: buildRevisionIncludes() });
      return res.json(revision);
    } catch (err) {
      console.error('[revision/update]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async remove(req, res) {
    try {
      const revision = await findRevisionConAcceso(req.params.id, wsId(req));
      if (!revision) return res.status(404).json({ error: 'Revisión no encontrada' });

      await revision.destroy();
      return res.json({ message: 'Revisión eliminada correctamente' });
    } catch (err) {
      console.error('[revision/remove]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ── Items de revisión ────────────────────────────────────────────────────────

  // PUT /api/revisiones/:id/items/:itemRevId
  // El técnico marca completado, agrega nota
  async updateItem(req, res) {
    try {
      const revision = await findRevisionConAcceso(req.params.id, wsId(req));
      if (!revision) return res.status(404).json({ error: 'Revisión no encontrada' });

      if (revision.estado === 'terminado') {
        return res.status(409).json({ error: 'No se puede modificar una revisión terminada' });
      }

      const item = await ItemRevision.findOne({
        where: { id: req.params.itemRevId, revision_id: revision.id },
        include: [{ model: ArchivoRevision, as: 'archivos', required: false }],
      });
      if (!item) return res.status(404).json({ error: 'Ítem de revisión no encontrado' });

      const { checked, nota } = req.body;
      await item.update({
        checked: checked !== undefined ? checked : item.checked,
        nota: nota !== undefined ? nota : item.nota,
      });

      // Avanzar el estado de la revisión: pendiente→en_proceso cuando hay ítems chequeados.
      // El estado 'terminado' solo se asigna explícitamente desde update() con estado_calidad.
      if (checked !== undefined && revision.estado === 'pendiente') {
        const anyChecked = (await ItemRevision.findAll({ where: { revision_id: revision.id } })).some(i => i.checked);
        if (anyChecked) await revision.update({ estado: 'en_proceso' });
      }

      await item.reload({ include: [{ model: ArchivoRevision, as: 'archivos' }] });
      return res.json(item);
    } catch (err) {
      console.error('[revision/updateItem]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ── Archivos de evidencia ────────────────────────────────────────────────────

  async addArchivo(req, res) {
    try {
      const revision = await findRevisionConAcceso(req.params.id, wsId(req));
      if (!revision) return res.status(404).json({ error: 'Revisión no encontrada' });

      if (revision.estado === 'terminado') {
        return res.status(409).json({ error: 'No se puede modificar una revisión terminada' });
      }

      const item = await ItemRevision.findOne({
        where: { id: req.params.itemRevId, revision_id: revision.id },
      });
      if (!item) return res.status(404).json({ error: 'Ítem de revisión no encontrado' });

      const { url, tipo } = req.body;
      if (!url || !tipo) return res.status(400).json({ error: 'url y tipo son requeridos' });

      if (!validarDataUrl(url, tipo)) {
        return res.status(400).json({ error: 'Tipo de archivo no permitido o formato de Data URL inválido' });
      }

      const count = await ArchivoRevision.count({ where: { item_rev_id: item.id } });
      if (count >= MAX_ARCHIVOS_POR_ITEM) {
        return res.status(400).json({ error: `Máximo ${MAX_ARCHIVOS_POR_ITEM} archivos por ítem` });
      }

      const archivo = await ArchivoRevision.create({ item_rev_id: item.id, url, tipo });
      return res.status(201).json(archivo);
    } catch (err) {
      console.error('[revision/addArchivo]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // GET /api/revisiones?proyecto_id=X&estado=terminado&calidad=ok&texto=...
  async listByProyecto(req, res) {
    try {
      const { proyecto_id, estado, calidad, texto } = req.query;
      if (!proyecto_id) return res.status(400).json({ error: 'proyecto_id es requerido' });

      // Verificar acceso al proyecto (incluyendo proyectos restringidos)
      const proyecto = await findProyectoConAcceso(proyecto_id, wsId(req), req.user.sub, req.user.rol);
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

      const equipos = await Equipo.findAll({
        where: { proyecto_id },
        attributes: ['id', 'nombre'],
      });
      if (!equipos.length) return res.json([]);

      const where = { equipo_id: equipos.map(e => e.id) };
      if (estado) where.estado = estado;
      if (calidad) where.estado_calidad = calidad;

      const revisiones = await Revision.findAll({
        where,
        include: [
          {
            model: ItemRevision,
            as: 'items',
            separate: true,
            order: [['id', 'ASC']],
            include: [{ model: ArchivoRevision, as: 'archivos', required: false }],
          },
          { model: Usuario, as: 'tecnico', attributes: ['id', 'nombre', 'email'], required: false },
          { model: Equipo, as: 'equipo', attributes: ['id', 'nombre'] },
        ],
        order: [['createdAt', 'DESC']],
      });

      let result = revisiones.map(r => r.toJSON());

      if (texto) {
        const q = texto.toLowerCase();
        result = result.filter(r =>
          r.equipo?.nombre?.toLowerCase().includes(q) ||
          r.tecnico?.nombre?.toLowerCase().includes(q)
        );
      }

      return res.json(result);
    } catch (err) {
      console.error('[revision/listByProyecto]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ── Archivos de observación general ─────────────────────────────────────────

  async addArchivoObs(req, res) {
    try {
      const revision = await findRevisionConAcceso(req.params.id, wsId(req));
      if (!revision) return res.status(404).json({ error: 'Revisión no encontrada' });
      if (revision.estado === 'terminado') {
        return res.status(409).json({ error: 'No se puede modificar una revisión terminada' });
      }

      const { url, tipo } = req.body;
      if (!url || !tipo) return res.status(400).json({ error: 'url y tipo son requeridos' });

      if (!validarDataUrl(url, tipo)) {
        return res.status(400).json({ error: 'Tipo de archivo no permitido o formato de Data URL inválido' });
      }

      const archivo = await ArchivoObsGeneral.create({ revision_id: revision.id, url, tipo });
      return res.status(201).json(archivo);
    } catch (err) {
      console.error('[revision/addArchivoObs]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async removeArchivoObs(req, res) {
    try {
      const revision = await findRevisionConAcceso(req.params.id, wsId(req));
      if (!revision) return res.status(404).json({ error: 'Revisión no encontrada' });
      if (revision.estado === 'terminado') {
        return res.status(409).json({ error: 'No se puede modificar una revisión terminada' });
      }

      const archivo = await ArchivoObsGeneral.findOne({
        where: { id: req.params.archivoId, revision_id: revision.id },
      });
      if (!archivo) return res.status(404).json({ error: 'Archivo no encontrado' });

      await archivo.destroy();
      return res.json({ message: 'Archivo eliminado correctamente' });
    } catch (err) {
      console.error('[revision/removeArchivoObs]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async removeArchivo(req, res) {
    try {
      const revision = await findRevisionConAcceso(req.params.id, wsId(req));
      if (!revision) return res.status(404).json({ error: 'Revisión no encontrada' });

      if (revision.estado === 'terminado') {
        return res.status(409).json({ error: 'No se puede modificar una revisión terminada' });
      }

      const item = await ItemRevision.findOne({
        where: { id: req.params.itemRevId, revision_id: revision.id },
      });
      if (!item) return res.status(404).json({ error: 'Ítem de revisión no encontrado' });

      const archivo = await ArchivoRevision.findOne({
        where: { id: req.params.archivoId, item_rev_id: item.id },
      });
      if (!archivo) return res.status(404).json({ error: 'Archivo no encontrado' });

      await archivo.destroy();
      return res.json({ message: 'Archivo eliminado correctamente' });
    } catch (err) {
      console.error('[revision/removeArchivo]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = revisionController;
