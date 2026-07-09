'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Workspace = sequelize.define(
  'Workspace',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(255), allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: 'workspaces',
    underscored: true,
  }
);

module.exports = Workspace;
