'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Plantilla = sequelize.define(
  'Plantilla',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workspace_id: { type: DataTypes.INTEGER, allowNull: false },
    nombre: { type: DataTypes.STRING(255), allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: 'plantillas', underscored: true }
);

module.exports = Plantilla;
