'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TareaProgramada = sequelize.define(
  'TareaProgramada',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    equipo_id: { type: DataTypes.INTEGER, allowNull: false },
    hora: { type: DataTypes.TIME, allowNull: false },       // HH:MM:SS
    dias_semana: { type: DataTypes.JSON, allowNull: false }, // [0-6], 0=dom
    activa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: 'tareas_programadas', underscored: true }
);

module.exports = TareaProgramada;
