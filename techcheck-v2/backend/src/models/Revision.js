'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Revision = sequelize.define(
  'Revision',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    equipo_id: { type: DataTypes.INTEGER, allowNull: false },
    tecnico_id: { type: DataTypes.INTEGER, allowNull: true },
    estado: {
      type: DataTypes.ENUM('pendiente', 'en_proceso', 'terminado'),
      allowNull: false,
      defaultValue: 'pendiente',
    },
    observacion_general: { type: DataTypes.TEXT, allowNull: true },
    estado_calidad: {
      type: DataTypes.ENUM('ok', 'observacion', 'problema'),
      allowNull: true,
      defaultValue: null,
    },
  },
  { tableName: 'revisiones', underscored: true }
);

module.exports = Revision;
