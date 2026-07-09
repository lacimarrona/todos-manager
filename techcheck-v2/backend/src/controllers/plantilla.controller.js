'use strict';

const ExcelJS = require('exceljs');
const { Plantilla, ItemPlantilla, ItemEquipo, Equipo, Proyecto, Workspace } = require('../models');

function wsId(req) {
  return req.user.rol === 'superadmin'
    ? (req.query.workspace_id ? parseInt(req.query.workspace_id) : null)
    : req.user.workspace_id;
}

async function findPlantillaConAcceso(id, workspaceId) {
  const where = { id };
  if (workspaceId) where.workspace_id = workspaceId;
  return Plantilla.findOne({ where });
}

const plantillaIncludes = [
  {
    model: ItemPlantilla,
    as: 'items',
    separate: true,
    order: [['orden', 'ASC']],
  },
  { model: Workspace, as: 'workspace', attributes: ['id', 'nombre'] },
];

// ── Parser Excel ─────────────────────────────────────────────────────────────
// Detecta si la primera fila es encabezado y extrae las etiquetas de la columna correcta
const HEADER_WORDS = ['item', 'ítem', 'label', 'tarea', 'descripcion', 'descripción', 'nombre', 'actividad', 'checklist'];

function parseExcelItems(rows) {
  if (!rows.length) return [];

  const firstRow = rows[0].map(c => String(c ?? '').toLowerCase().trim());
  const headerIdx = firstRow.findIndex(c => HEADER_WORDS.some(w => c.includes(w)));
  const startRow  = headerIdx >= 0 ? 1 : 0;
  const labelCol  = headerIdx >= 0 ? headerIdx : 0;

  return rows
    .slice(startRow)
    .map(row => String(row[labelCol] ?? '').trim())
    .filter(label => label.length > 0);
}

const plantillaController = {
  // ── CRUD Plantilla ───────────────────────────────────────────────────────────

  async list(req, res) {
    try {
      const where = {};
      const ws = wsId(req);
      if (ws) where.workspace_id = ws;

      const plantillas = await Plantilla.findAll({
        where,
        include: [
          { model: ItemPlantilla, as: 'items', separate: true, order: [['orden', 'ASC']] },
          { model: Workspace, as: 'workspace', attributes: ['id', 'nombre'] },
        ],
        order: [['nombre', 'ASC']],
      });
      return res.json(plantillas);
    } catch (err) {
      console.error('[plantilla/list]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async getOne(req, res) {
    try {
      const plantilla = await findPlantillaConAcceso(req.params.id, wsId(req));
      if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });

      await plantilla.reload({ include: plantillaIncludes });
      return res.json(plantilla);
    } catch (err) {
      console.error('[plantilla/getOne]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async create(req, res) {
    try {
      const { nombre, descripcion, workspace_id, items } = req.body;
      if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

      const workspaceId = req.user.rol === 'superadmin' ? workspace_id : req.user.workspace_id;
      if (!workspaceId) return res.status(400).json({ error: 'workspace_id es requerido' });

      const plantilla = await Plantilla.create({ workspace_id: workspaceId, nombre, descripcion });

      if (Array.isArray(items) && items.length) {
        await ItemPlantilla.bulkCreate(
          items.map((item, i) => ({
            plantilla_id: plantilla.id,
            label: item.label,
            observacion_guia: item.observacion_guia || null,
            orden: item.orden ?? i,
          }))
        );
      }

      await plantilla.reload({ include: plantillaIncludes });
      return res.status(201).json(plantilla);
    } catch (err) {
      console.error('[plantilla/create]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async update(req, res) {
    try {
      const plantilla = await findPlantillaConAcceso(req.params.id, wsId(req));
      if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });

      const { nombre, descripcion } = req.body;
      await plantilla.update({ nombre, descripcion });
      await plantilla.reload({ include: plantillaIncludes });
      return res.json(plantilla);
    } catch (err) {
      console.error('[plantilla/update]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async remove(req, res) {
    try {
      const plantilla = await findPlantillaConAcceso(req.params.id, wsId(req));
      if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });

      await plantilla.destroy();
      return res.json({ message: 'Plantilla eliminada correctamente' });
    } catch (err) {
      console.error('[plantilla/remove]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ── CRUD Ítems ───────────────────────────────────────────────────────────────

  async listItems(req, res) {
    try {
      const plantilla = await findPlantillaConAcceso(req.params.id, wsId(req));
      if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });

      const items = await ItemPlantilla.findAll({
        where: { plantilla_id: plantilla.id },
        order: [['orden', 'ASC']],
      });
      return res.json(items);
    } catch (err) {
      console.error('[plantilla/listItems]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async addItem(req, res) {
    try {
      const plantilla = await findPlantillaConAcceso(req.params.id, wsId(req));
      if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });

      const { label, observacion_guia, orden } = req.body;
      if (!label) return res.status(400).json({ error: 'label es requerido' });

      const ordenFinal = orden ?? await ItemPlantilla.count({ where: { plantilla_id: plantilla.id } });
      const item = await ItemPlantilla.create({ plantilla_id: plantilla.id, label, observacion_guia: observacion_guia || null, orden: ordenFinal });
      return res.status(201).json(item);
    } catch (err) {
      console.error('[plantilla/addItem]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async updateItem(req, res) {
    try {
      const plantilla = await findPlantillaConAcceso(req.params.id, wsId(req));
      if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });

      const item = await ItemPlantilla.findOne({
        where: { id: req.params.itemId, plantilla_id: plantilla.id },
      });
      if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });

      const { label, observacion_guia, orden } = req.body;
      await item.update({ label, observacion_guia, orden });
      return res.json(item);
    } catch (err) {
      console.error('[plantilla/updateItem]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async removeItem(req, res) {
    try {
      const plantilla = await findPlantillaConAcceso(req.params.id, wsId(req));
      if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });

      const item = await ItemPlantilla.findOne({
        where: { id: req.params.itemId, plantilla_id: plantilla.id },
      });
      if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });

      await item.destroy();
      return res.json({ message: 'Ítem eliminado correctamente' });
    } catch (err) {
      console.error('[plantilla/removeItem]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ── Importar Excel ───────────────────────────────────────────────────────────
  // POST /api/plantillas/importar-excel  (multipart/form-data)
  // Campos: archivo (file), nombre (string), descripcion (string, opcional)
  // Formato Excel: una columna con los labels. Encabezado opcional y auto-detectado.

  async importarExcel(req, res) {
    try {
      if (!req.file) return res.status(400).json({ error: 'Se requiere un archivo Excel' });

      const { nombre, descripcion, workspace_id } = req.body;
      if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

      const workspaceId = req.user.rol === 'superadmin' ? workspace_id : req.user.workspace_id;
      if (!workspaceId) return res.status(400).json({ error: 'workspace_id es requerido' });

      // Parsear Excel desde buffer en memoria con ExcelJS
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) return res.status(400).json({ error: 'El archivo Excel está vacío' });

      const rows = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        // row.values es 1-indexado en ExcelJS; slice(1) elimina el índice 0 vacío
        const vals = row.values.slice(1).map(v => {
          if (v == null) return '';
          if (typeof v === 'object') return String(v.text ?? v.result ?? '');
          return String(v);
        });
        rows.push(vals);
      });

      const labels = parseExcelItems(rows);
      if (!labels.length) {
        return res.status(400).json({ error: 'No se encontraron ítems válidos en el Excel' });
      }

      // Crear plantilla e ítems
      const plantilla = await Plantilla.create({ workspace_id: workspaceId, nombre, descripcion });
      await ItemPlantilla.bulkCreate(
        labels.map((label, i) => ({ plantilla_id: plantilla.id, label, orden: i }))
      );

      await plantilla.reload({ include: plantillaIncludes });
      return res.status(201).json({ ...plantilla.toJSON(), total_items: labels.length });
    } catch (err) {
      console.error('[plantilla/importarExcel]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ── Aplicar plantilla a un equipo ────────────────────────────────────────────
  // POST /api/plantillas/:id/aplicar
  // Body: { equipo_id, modo: 'reemplazar' | 'agregar' }
  // modo reemplazar (default): borra items_equipo existentes antes de copiar
  // modo agregar: agrega los ítems de la plantilla al final de los existentes

  async aplicarAEquipo(req, res) {
    try {
      const plantilla = await findPlantillaConAcceso(req.params.id, wsId(req));
      if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });

      const { equipo_id, modo } = req.body;
      if (!equipo_id) return res.status(400).json({ error: 'equipo_id es requerido' });

      const modoFinal = modo === 'agregar' ? 'agregar' : 'reemplazar';

      // Verificar que el equipo pertenece al mismo workspace
      const equipo = await Equipo.findByPk(equipo_id, {
        include: [{ model: Proyecto, as: 'proyecto', attributes: ['id', 'workspace_id'] }],
      });
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });
      if (wsId(req) && equipo.proyecto.workspace_id !== wsId(req)) {
        return res.status(404).json({ error: 'Equipo no encontrado' });
      }

      // Ítems de la plantilla ordenados
      const templateItems = await ItemPlantilla.findAll({
        where: { plantilla_id: plantilla.id },
        order: [['orden', 'ASC']],
      });
      if (!templateItems.length) {
        return res.status(400).json({ error: 'La plantilla no tiene ítems' });
      }

      if (modoFinal === 'reemplazar') {
        await ItemEquipo.destroy({ where: { equipo_id } });
      }

      const offset = modoFinal === 'agregar'
        ? await ItemEquipo.count({ where: { equipo_id } })
        : 0;

      await ItemEquipo.bulkCreate(
        templateItems.map((item, i) => ({
          equipo_id,
          label: item.label,
          observacion_guia: item.observacion_guia || null,
          orden: offset + i,
        }))
      );

      // Vincular equipo a la plantilla y devolver equipo actualizado
      await equipo.update({ plantilla_id: plantilla.id });
      await equipo.reload({
        include: [
          { model: ItemEquipo, as: 'items', separate: true, order: [['orden', 'ASC']] },
          { model: Proyecto,   as: 'proyecto', attributes: ['id', 'nombre'] },
          { model: Plantilla,  as: 'plantilla', attributes: ['id', 'nombre'] },
        ],
      });

      return res.json({
        message: `Plantilla aplicada en modo "${modoFinal}" — ${templateItems.length} ítems copiados`,
        equipo,
      });
    } catch (err) {
      console.error('[plantilla/aplicarAEquipo]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = plantillaController;
