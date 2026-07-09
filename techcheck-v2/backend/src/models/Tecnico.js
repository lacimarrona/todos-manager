'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Tecnico = sequelize.define(
  'Tecnico',
  {
    id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workspace_id: { type: DataTypes.INTEGER, allowNull: false },
    nombre:       { type: DataTypes.STRING(255), allowNull: false },
    email:        { type: DataTypes.STRING(255), allowNull: true },
    activo:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: 'tecnicos', underscored: true }
);

module.exports = Tecnico;
