'use strict';

const { GrupoElemento, ElementoGrupo } = require('../models');
const { wsId } = require('../utils/workspace');

// ── Grupos ────────────────────────────────────────────────────────────────────

exports.listGrupos = async (req, res) => {
  try {
    const ws = wsId(req);
    const grupos = await GrupoElemento.findAll({
      where: { workspace_id: ws },
      include: [{ model: ElementoGrupo, as: 'elementos', where: { activo: true }, required: false }],
      order: [['nombre', 'ASC'], [{ model: ElementoGrupo, as: 'elementos' }, 'valor', 'ASC']],
    });
    res.json(grupos);
  } catch (err) {
    console.error('[grupo-elemento/listGrupos]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.getGrupo = async (req, res) => {
  try {
    const ws = wsId(req);
    const grupo = await GrupoElemento.findOne({
      where: { id: req.params.id, workspace_id: ws },
      include: [{ model: ElementoGrupo, as: 'elementos' }],
      order: [[{ model: ElementoGrupo, as: 'elementos' }, 'valor', 'ASC']],
    });
    if (!grupo) return res.status(404).json({ message: 'Grupo no encontrado' });
    res.json(grupo);
  } catch (err) {
    console.error('[grupo-elemento/getGrupo]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.createGrupo = async (req, res) => {
  try {
    const ws = wsId(req);
    const { nombre, descripcion } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ message: 'El nombre es requerido' });
    const grupo = await GrupoElemento.create({ workspace_id: ws, nombre: nombre.trim(), descripcion });
    res.status(201).json(grupo);
  } catch (err) {
    console.error('[grupo-elemento/createGrupo]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.updateGrupo = async (req, res) => {
  try {
    const ws = wsId(req);
    const grupo = await GrupoElemento.findOne({ where: { id: req.params.id, workspace_id: ws } });
    if (!grupo) return res.status(404).json({ message: 'Grupo no encontrado' });
    const { nombre, descripcion, activo } = req.body;
    if (nombre !== undefined && !nombre.trim()) return res.status(400).json({ message: 'El nombre es requerido' });
    await grupo.update({
      ...(nombre      !== undefined && { nombre: nombre.trim() }),
      ...(descripcion !== undefined && { descripcion }),
      ...(activo      !== undefined && { activo }),
    });
    res.json(grupo);
  } catch (err) {
    console.error('[grupo-elemento/updateGrupo]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.deleteGrupo = async (req, res) => {
  try {
    const ws = wsId(req);
    const grupo = await GrupoElemento.findOne({ where: { id: req.params.id, workspace_id: ws } });
    if (!grupo) return res.status(404).json({ message: 'Grupo no encontrado' });
    await grupo.destroy();
    res.status(204).end();
  } catch (err) {
    console.error('[grupo-elemento/deleteGrupo]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ── Elementos ─────────────────────────────────────────────────────────────────

async function resolveGrupo(req, res) {
  const ws = wsId(req);
  const grupo = await GrupoElemento.findOne({ where: { id: req.params.grupoId, workspace_id: ws } });
  if (!grupo) { res.status(404).json({ message: 'Grupo no encontrado' }); return null; }
  return grupo;
}

exports.listElementos = async (req, res) => {
  try {
    const grupo = await resolveGrupo(req, res);
    if (!grupo) return;
    const elementos = await ElementoGrupo.findAll({
      where: { grupo_id: grupo.id },
      order: [['valor', 'ASC']],
    });
    res.json(elementos);
  } catch (err) {
    console.error('[grupo-elemento/listElementos]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.createElemento = async (req, res) => {
  try {
    const grupo = await resolveGrupo(req, res);
    if (!grupo) return;
    const { valor, descripcion } = req.body;
    if (!valor?.trim()) return res.status(400).json({ message: 'El valor es requerido' });
    const elemento = await ElementoGrupo.create({ grupo_id: grupo.id, valor: valor.trim(), descripcion });
    res.status(201).json(elemento);
  } catch (err) {
    console.error('[grupo-elemento/createElemento]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.updateElemento = async (req, res) => {
  try {
    const grupo = await resolveGrupo(req, res);
    if (!grupo) return;
    const elemento = await ElementoGrupo.findOne({ where: { id: req.params.id, grupo_id: grupo.id } });
    if (!elemento) return res.status(404).json({ message: 'Elemento no encontrado' });
    const { valor, descripcion, activo } = req.body;
    if (valor !== undefined && !valor.trim()) return res.status(400).json({ message: 'El valor es requerido' });
    await elemento.update({
      ...(valor       !== undefined && { valor: valor.trim() }),
      ...(descripcion !== undefined && { descripcion }),
      ...(activo      !== undefined && { activo }),
    });
    res.json(elemento);
  } catch (err) {
    console.error('[grupo-elemento/updateElemento]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.deleteElemento = async (req, res) => {
  try {
    const grupo = await resolveGrupo(req, res);
    if (!grupo) return;
    const elemento = await ElementoGrupo.findOne({ where: { id: req.params.id, grupo_id: grupo.id } });
    if (!elemento) return res.status(404).json({ message: 'Elemento no encontrado' });
    await elemento.destroy();
    res.status(204).end();
  } catch (err) {
    console.error('[grupo-elemento/deleteElemento]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
