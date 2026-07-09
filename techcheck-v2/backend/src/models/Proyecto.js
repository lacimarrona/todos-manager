'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Proyecto = sequelize.define(
  'Proyecto',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workspace_id: { type: DataTypes.INTEGER, allowNull: false },
    nombre: { type: DataTypes.STRING(255), allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    creado_por: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: 'proyectos', underscored: true }
);

module.exports = Proyecto;
