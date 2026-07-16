'use strict';

const ExcelJS  = require('exceljs');
const { Equipo, ItemEquipo, ArchivoGuia, Proyecto, Usuario, Revision, ItemRevision, ProyectoPermiso } = require('../models');
const { wsId } = require('../utils/workspace');
const { csvRow } = require('../utils/csv');

// Carga el equipo verificando workspace y, si el proyecto es restringido,
// que el usuario tenga permiso explícito (misma lógica que findProyectoConAcceso).
async function findEquipoConAcceso(equipoId, workspaceId, userId, rol) {
  const equipo = await Equipo.findByPk(equipoId, {
    include: [{ model: Proyecto, as: 'proyecto', attributes: ['id', 'workspace_id', 'restringido'] }],
  });
  if (!equipo) return null;
  if (workspaceId && equipo.proyecto.workspace_id !== workspaceId) return null;

  if (rol === 'usuario' && equipo.proyecto.restringido) {
    const permiso = await ProyectoPermiso.findOne({
      where: { proyecto_id: equipo.proyecto.id, usuario_id: userId },
    });
    if (!permiso) return null;
  }
  return equipo;
}

// Verifica que el técnico asignado (si viene informado) pertenece al workspace del usuario
async function tecnicoValido(tecnicoId, workspaceId) {
  if (!tecnicoId) return true;
  const usuario = await Usuario.findOne({
    where: { id: tecnicoId, ...(workspaceId ? { workspace_id: workspaceId } : {}) },
  });
  return !!usuario;
}

// Includes estándar para un equipo completo
const equipoIncludes = [
  {
    model: ItemEquipo,
    as: 'items',
    required: false,
    include: [{ model: ArchivoGuia, as: 'archivos', required: false }],
    order: [['orden', 'ASC']],
  },
  {
    model: Usuario,
    as: 'tecnico_asignado',
    attributes: ['id', 'nombre', 'email'],
    required: false,
  },
  {
    model: Proyecto,
    as: 'proyecto',
    attributes: ['id', 'nombre', 'workspace_id'],
  },
];

const equipoController = {
  // ── Equipo CRUD ─────────────────────────────────────────────────────────────

  async getOne(req, res) {
    try {
      const equipo = await findEquipoConAcceso(req.params.id, wsId(req), req.user.sub, req.user.rol);
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

      await equipo.reload({ include: equipoIncludes });
      return res.json(equipo);
    } catch (err) {
      console.error('[equipo/getOne]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async create(req, res) {
    try {
      const { proyecto_id, nombre, plantilla_id, tecnico_asignado_id, tiempo_limite, items } = req.body;
      if (!proyecto_id || !nombre) {
        return res.status(400).json({ error: 'proyecto_id y nombre son requeridos' });
      }

      // Verificar que el proyecto pertenece al workspace
      const proyecto = await Proyecto.findOne({
        where: {
          id: proyecto_id,
          ...(wsId(req) ? { workspace_id: wsId(req) } : {}),
        },
      });
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

      if (!(await tecnicoValido(tecnico_asignado_id, wsId(req)))) {
        return res.status(404).json({ error: 'Técnico asignado no encontrado' });
      }

      const equipo = await Equipo.create({
        proyecto_id,
        nombre,
        plantilla_id: plantilla_id || null,
        tecnico_asignado_id: tecnico_asignado_id || null,
        tiempo_limite: tiempo_limite || null,
      });

      // Crear ítems si vienen en el body
      if (Array.isArray(items) && items.length) {
        await ItemEquipo.bulkCreate(
          items.map((item, i) => ({
            equipo_id: equipo.id,
            label: item.label,
            observacion_guia: item.observacion_guia || null,
            orden: item.orden ?? i,
          }))
        );
      }

      await equipo.reload({ include: equipoIncludes });
      return res.status(201).json(equipo);
    } catch (err) {
      console.error('[equipo/create]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async update(req, res) {
    try {
      const equipo = await findEquipoConAcceso(req.params.id, wsId(req), req.user.sub, req.user.rol);
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

      const { nombre, plantilla_id, tecnico_asignado_id, tiempo_limite } = req.body;
      if (!(await tecnicoValido(tecnico_asignado_id, wsId(req)))) {
        return res.status(404).json({ error: 'Técnico asignado no encontrado' });
      }
      await equipo.update({ nombre, plantilla_id, tecnico_asignado_id, tiempo_limite });
      await equipo.reload({ include: equipoIncludes });
      return res.json(equipo);
    } catch (err) {
      console.error('[equipo/update]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async remove(req, res) {
    try {
      const equipo = await findEquipoConAcceso(req.params.id, wsId(req), req.user.sub, req.user.rol);
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

      await equipo.destroy();
      return res.json({ message: 'Equipo eliminado correctamente' });
    } catch (err) {
      console.error('[equipo/remove]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // POST /api/equipos/:id/clonar
  async clonar(req, res) {
    try {
      const equipo = await findEquipoConAcceso(req.params.id, wsId(req), req.user.sub, req.user.rol);
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

      const { proyecto_id, nombre } = req.body;
      const targetProyectoId = proyecto_id || equipo.proyecto_id;

      // Si se indica otro proyecto, verificar que pertenece al mismo workspace
      if (proyecto_id && proyecto_id !== equipo.proyecto_id) {
        const targetProyecto = await Proyecto.findOne({
          where: {
            id: proyecto_id,
            ...(wsId(req) ? { workspace_id: wsId(req) } : {}),
          },
        });
        if (!targetProyecto) {
          return res.status(404).json({ error: 'Proyecto destino no encontrado' });
        }
      }

      // Clonar equipo
      const clon = await Equipo.create({
        proyecto_id: targetProyectoId,
        nombre: nombre || `${equipo.nombre} (copia)`,
        plantilla_id: equipo.plantilla_id,
        tecnico_asignado_id: equipo.tecnico_asignado_id,
        tiempo_limite: equipo.tiempo_limite,
      });

      // Clonar ítems y sus archivos guía
      const items = await ItemEquipo.findAll({
        where: { equipo_id: equipo.id },
        include: [{ model: ArchivoGuia, as: 'archivos' }],
        order: [['orden', 'ASC']],
      });

      for (const item of items) {
        const nuevoItem = await ItemEquipo.create({
          equipo_id: clon.id,
          label: item.label,
          observacion_guia: item.observacion_guia,
          orden: item.orden,
        });
        if (item.archivos?.length) {
          await ArchivoGuia.bulkCreate(
            item.archivos.map(a => ({ item_id: nuevoItem.id, url: a.url, tipo: a.tipo }))
          );
        }
      }

      await clon.reload({ include: equipoIncludes });
      return res.status(201).json(clon);
    } catch (err) {
      console.error('[equipo/clonar]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ── Items CRUD ───────────────────────────────────────────────────────────────

  async listItems(req, res) {
    try {
      const equipo = await findEquipoConAcceso(req.params.id, wsId(req), req.user.sub, req.user.rol);
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

      const items = await ItemEquipo.findAll({
        where: { equipo_id: equipo.id },
        include: [{ model: ArchivoGuia, as: 'archivos', required: false }],
        order: [['orden', 'ASC']],
      });
      return res.json(items);
    } catch (err) {
      console.error('[equipo/listItems]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async addItem(req, res) {
    try {
      const equipo = await findEquipoConAcceso(req.params.id, wsId(req), req.user.sub, req.user.rol);
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

      const { label, observacion_guia, orden } = req.body;
      if (!label) return res.status(400).json({ error: 'label es requerido' });

      // Orden por defecto: al final
      const ordenFinal = orden ?? (await ItemEquipo.count({ where: { equipo_id: equipo.id } }));

      const item = await ItemEquipo.create({
        equipo_id: equipo.id,
        label,
        observacion_guia: observacion_guia || null,
        orden: ordenFinal,
      });
      return res.status(201).json(item);
    } catch (err) {
      console.error('[equipo/addItem]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async updateItem(req, res) {
    try {
      const equipo = await findEquipoConAcceso(req.params.id, wsId(req), req.user.sub, req.user.rol);
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

      const item = await ItemEquipo.findOne({
        where: { id: req.params.itemId, equipo_id: equipo.id },
      });
      if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });

      const { label, observacion_guia, orden } = req.body;
      await item.update({ label, observacion_guia, orden });
      return res.json(item);
    } catch (err) {
      console.error('[equipo/updateItem]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async removeItem(req, res) {
    try {
      const equipo = await findEquipoConAcceso(req.params.id, wsId(req), req.user.sub, req.user.rol);
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

      const item = await ItemEquipo.findOne({
        where: { id: req.params.itemId, equipo_id: equipo.id },
      });
      if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });

      await item.destroy();
      return res.json({ message: 'Ítem eliminado correctamente' });
    } catch (err) {
      console.error('[equipo/removeItem]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ── Archivos guía CRUD ───────────────────────────────────────────────────────

  async addArchivoGuia(req, res) {
    try {
      const equipo = await findEquipoConAcceso(req.params.id, wsId(req), req.user.sub, req.user.rol);
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

      const item = await ItemEquipo.findOne({
        where: { id: req.params.itemId, equipo_id: equipo.id },
      });
      if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });

      const { url, tipo } = req.body;
      if (!url || !tipo) return res.status(400).json({ error: 'url y tipo son requeridos' });

      const MIME_IMAGEN    = /^data:image\/(jpeg|png|webp|gif);base64,/;
      const MIME_DOCUMENTO = /^data:application\/(pdf|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation));base64,/;
      const esValido = (tipo === 'imagen' && MIME_IMAGEN.test(url)) || (tipo === 'documento' && MIME_DOCUMENTO.test(url));
      if (!esValido) return res.status(400).json({ error: 'Tipo de archivo no permitido o formato de Data URL inválido' });

      const archivo = await ArchivoGuia.create({ item_id: item.id, url, tipo });
      return res.status(201).json(archivo);
    } catch (err) {
      console.error('[equipo/addArchivoGuia]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ── Archivar equipo ──────────────────────────────────────────────────────────

  async archivar(req, res) {
    try {
      const equipo = await findEquipoConAcceso(req.params.id, wsId(req), req.user.sub, req.user.rol);
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });
      if (equipo.archivado) return res.status(400).json({ error: 'El equipo ya está archivado' });

      await equipo.update({ archivado: true });
      return res.json({ message: 'Equipo archivado correctamente' });
    } catch (err) {
      console.error('[equipo/archivar]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // GET /api/equipos/plantilla-excel → devuelve un .xlsx con la estructura de importación
  async descargarPlantillaExcel(req, res) {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Equipos');
      sheet.columns = [{ header: 'nombre', key: 'nombre', width: 30 }];
      sheet.addRow(['PC-Recepcion-01']);
      sheet.addRow(['Servidor-NAS-02']);
      sheet.addRow(['Laptop-Gerencia-03']);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="plantilla_importar_equipos.xlsx"');
      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('[equipo/descargarPlantillaExcel]', err);
      return res.status(500).json({ error: 'Error al generar la plantilla' });
    }
  },

  // POST /api/equipos/importar-excel-nombres
  // Recibe un archivo .xlsx vía multipart y devuelve { equipos: [{nombre}] }
  async importarExcelNombres(req, res) {
    try {
      if (!req.file) return res.status(400).json({ error: 'Se requiere un archivo Excel' });

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) return res.status(400).json({ error: 'El archivo Excel está vacío' });

      const equipos = [];
      sheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
        if (rowIndex === 1) return; // saltar encabezado
        const cell = row.getCell(1);
        let nombre = '';
        if (cell.value == null) return;
        if (typeof cell.value === 'object') {
          nombre = String(cell.value.text ?? cell.value.result ?? '').trim();
        } else {
          nombre = String(cell.value).trim();
        }
        if (nombre) equipos.push({ nombre });
      });

      if (!equipos.length) {
        return res.status(422).json({ error: 'No se encontraron equipos. Asegúrate de que la columna A tenga los nombres.' });
      }

      return res.json({ equipos });
    } catch (err) {
      console.error('[equipo/importarExcelNombres]', err);
      return res.status(500).json({ error: 'Error al leer el archivo Excel' });
    }
  },

  // POST /api/equipos/:proyectoId/importar-masivo  (se monta en equipo.routes)
  async importarMasivo(req, res) {
    try {
      const { proyecto_id, equipos: lista, plantilla_id, tecnico_asignado_id } = req.body;
      if (!proyecto_id || !Array.isArray(lista) || !lista.length) {
        return res.status(400).json({ error: 'proyecto_id y equipos[] son requeridos' });
      }
      if (lista.length > 500) {
        return res.status(400).json({ error: 'No se pueden importar más de 500 equipos a la vez' });
      }

      const proyecto = await Proyecto.findOne({
        where: { id: proyecto_id, ...(wsId(req) ? { workspace_id: wsId(req) } : {}) },
      });
      if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

      if (!(await tecnicoValido(tecnico_asignado_id, wsId(req)))) {
        return res.status(404).json({ error: 'Técnico asignado no encontrado' });
      }

      let itemsBase = [];
      if (plantilla_id) {
        const { Plantilla, ItemPlantilla } = require('../models');
        const plantilla = await Plantilla.findOne({
          where: { id: plantilla_id, ...(wsId(req) ? { workspace_id: wsId(req) } : {}) },
        });
        if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });

        itemsBase = await ItemPlantilla.findAll({
          where: { plantilla_id },
          order: [['orden', 'ASC']],
        });
      }

      const creados = [];
      for (const row of lista) {
        if (!row.nombre?.trim()) continue;
        const eq = await Equipo.create({
          proyecto_id,
          nombre: row.nombre.trim(),
          plantilla_id: plantilla_id || null,
          tecnico_asignado_id: tecnico_asignado_id || null,
          tiempo_limite: null,
        });
        if (itemsBase.length) {
          await ItemEquipo.bulkCreate(
            itemsBase.map((it, i) => ({
              equipo_id: eq.id,
              label: it.label,
              observacion_guia: it.observacion_guia || null,
              orden: i,
            }))
          );
        }
        creados.push(eq.id);
      }

      return res.status(201).json({ message: `${creados.length} equipo(s) creados`, ids: creados });
    } catch (err) {
      console.error('[equipo/importarMasivo]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  // ── Exportar equipo ──────────────────────────────────────────────────────────

  async exportarJSON(req, res) {
    try {
      const equipo = await findEquipoConAcceso(req.params.id, wsId(req), req.user.sub, req.user.rol);
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

      await equipo.reload({ include: equipoIncludes });
      const revisiones = await Revision.findAll({
        where: { equipo_id: equipo.id },
        include: [
          {
            model: ItemRevision,
            as: 'items',
            separate: true,
            order: [['id', 'ASC']],
          },
          { model: Usuario, as: 'tecnico', attributes: ['id', 'nombre', 'email'], required: false },
        ],
        order: [['id', 'DESC']],
      });

      return res.json({ equipo: equipo.toJSON(), revisiones: revisiones.map(r => r.toJSON()) });
    } catch (err) {
      console.error('[equipo/exportarJSON]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async exportarCSV(req, res) {
    try {
      const equipo = await findEquipoConAcceso(req.params.id, wsId(req), req.user.sub, req.user.rol);
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

      await equipo.reload({ include: equipoIncludes });
      const revisiones = await Revision.findAll({
        where: { equipo_id: equipo.id },
        include: [
          { model: ItemRevision, as: 'items', separate: true, order: [['id', 'ASC']] },
          { model: Usuario, as: 'tecnico', attributes: ['nombre'], required: false },
        ],
        order: [['id', 'ASC']],
      });

      const fmtDate = d => d ? new Date(d).toLocaleString('es-ES') : '';
      const estadoMap = { ok: 'OK', observacion: 'Con observaciones', problema: 'Con problemas' };

      const HEADERS = ['Equipo', 'Técnico Asignado', 'Nº Rev', 'Fecha', 'Técnico Rev', 'Estado', 'Calidad', 'Ítem', 'Completado', 'Nota'];
      const lines = [HEADERS.join(',')];
      const tecnicoAsig = equipo.tecnico_asignado?.nombre || '';

      if (!revisiones.length) {
        (equipo.items?.length ? equipo.items : [null]).forEach(it => {
          lines.push(csvRow([equipo.nombre, tecnicoAsig, '', '', '', '', '', it?.label || '', '', '']));
        });
      } else {
        revisiones.forEach(rev => {
          const tecnicoRev = rev.tecnico?.nombre || '';
          (rev.items || []).forEach(it => {
            lines.push(csvRow([
              equipo.nombre, tecnicoAsig, rev.id, fmtDate(rev.createdAt),
              tecnicoRev, rev.estado, estadoMap[rev.estado_calidad] || '',
              it.label, it.checked ? 'Sí' : 'No', it.nota || '',
            ]));
          });
        });
      }

      const csv = '﻿' + lines.join('\r\n');
      const safeNombre = equipo.nombre.replace(/[^\w\-\.]/g, '_');
      const filename = `${safeNombre}_equipo_techcheck.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      return res.send(csv);
    } catch (err) {
      console.error('[equipo/exportarCSV]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },

  async removeArchivoGuia(req, res) {
    try {
      const equipo = await findEquipoConAcceso(req.params.id, wsId(req), req.user.sub, req.user.rol);
      if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

      const item = await ItemEquipo.findOne({
        where: { id: req.params.itemId, equipo_id: equipo.id },
      });
      if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });

      const archivo = await ArchivoGuia.findOne({
        where: { id: req.params.archivoId, item_id: item.id },
      });
      if (!archivo) return res.status(404).json({ error: 'Archivo no encontrado' });

      await archivo.destroy();
      return res.json({ message: 'Archivo eliminado correctamente' });
    } catch (err) {
      console.error('[equipo/removeArchivoGuia]', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = equipoController;
