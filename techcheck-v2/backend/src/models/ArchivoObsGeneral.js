'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ArchivoObsGeneral = sequelize.define(
  'ArchivoObsGeneral',
  {
    id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    revision_id: { type: DataTypes.INTEGER, allowNull: false },
    url:         { type: DataTypes.TEXT, allowNull: false },
    tipo:        { type: DataTypes.ENUM('imagen', 'documento'), allowNull: false, defaultValue: 'imagen' },
  },
  { tableName: 'archivos_obs_general', underscored: true }
);

module.exports = ArchivoObsGeneral;
