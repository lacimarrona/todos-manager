'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GrupoElemento = sequelize.define(
  'GrupoElemento',
  {
    id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workspace_id: { type: DataTypes.INTEGER, allowNull: false },
    nombre:       { type: DataTypes.STRING(120), allowNull: false },
    descripcion:  { type: DataTypes.STRING(255), allowNull: true },
    activo:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: 'grupos_elementos', underscored: true }
);

module.exports = GrupoElemento;
