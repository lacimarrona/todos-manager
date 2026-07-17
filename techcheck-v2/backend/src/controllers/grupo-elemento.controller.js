'use strict';

const { GrupoElemento, ElementoGrupo } = require('../models');
const { wsId } = require('../middleware/auth');

// ── Grupos ────────────────────────────────────────────────────────────────────

exports.listGrupos = async (req, res) => {
  const ws = wsId(req);
  const grupos = await GrupoElemento.findAll({
    where: { workspace_id: ws },
    include: [{ model: ElementoGrupo, as: 'elementos', where: { activo: true }, required: false }],
    order: [['nombre', 'ASC'], [{ model: ElementoGrupo, as: 'elementos' }, 'valor', 'ASC']],
  });
  res.json(grupos);
};

exports.getGrupo = async (req, res) => {
  const ws = wsId(req);
  const grupo = await GrupoElemento.findOne({
    where: { id: req.params.id, workspace_id: ws },
    include: [{ model: ElementoGrupo, as: 'elementos', order: [['valor', 'ASC']] }],
  });
  if (!grupo) return res.status(404).json({ message: 'Grupo no encontrado' });
  res.json(grupo);
};

exports.createGrupo = async (req, res) => {
  const ws = wsId(req);
  const { nombre, descripcion } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ message: 'El nombre es requerido' });
  const grupo = await GrupoElemento.create({ workspace_id: ws, nombre: nombre.trim(), descripcion });
  res.status(201).json(grupo);
};

exports.updateGrupo = async (req, res) => {
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
};

exports.deleteGrupo = async (req, res) => {
  const ws = wsId(req);
  const grupo = await GrupoElemento.findOne({ where: { id: req.params.id, workspace_id: ws } });
  if (!grupo) return res.status(404).json({ message: 'Grupo no encontrado' });
  await grupo.destroy();
  res.status(204).end();
};

// ── Elementos ─────────────────────────────────────────────────────────────────

async function resolveGrupo(req, res) {
  const ws = wsId(req);
  const grupo = await GrupoElemento.findOne({ where: { id: req.params.grupoId, workspace_id: ws } });
  if (!grupo) { res.status(404).json({ message: 'Grupo no encontrado' }); return null; }
  return grupo;
}

exports.listElementos = async (req, res) => {
  const grupo = await resolveGrupo(req, res);
  if (!grupo) return;
  const elementos = await ElementoGrupo.findAll({
    where: { grupo_id: grupo.id },
    order: [['valor', 'ASC']],
  });
  res.json(elementos);
};

exports.createElemento = async (req, res) => {
  const grupo = await resolveGrupo(req, res);
  if (!grupo) return;
  const { valor, descripcion } = req.body;
  if (!valor?.trim()) return res.status(400).json({ message: 'El valor es requerido' });
  const elemento = await ElementoGrupo.create({ grupo_id: grupo.id, valor: valor.trim(), descripcion });
  res.status(201).json(elemento);
};

exports.updateElemento = async (req, res) => {
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
};

exports.deleteElemento = async (req, res) => {
  const grupo = await resolveGrupo(req, res);
  if (!grupo) return;
  const elemento = await ElementoGrupo.findOne({ where: { id: req.params.id, grupo_id: grupo.id } });
  if (!elemento) return res.status(404).json({ message: 'Elemento no encontrado' });
  await elemento.destroy();
  res.status(204).end();
};
