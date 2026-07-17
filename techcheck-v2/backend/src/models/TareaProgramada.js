'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TareaProgramada = sequelize.define(
  'TareaProgramada',
  {
    id:            { type: DataTypes.INTEGER,  primaryKey: true, autoIncrement: true },
    equipo_id:     { type: DataTypes.INTEGER,  allowNull: false },
    hora:          { type: DataTypes.TIME,     allowNull: false },
    dias_semana:   { type: DataTypes.JSON,     allowNull: false },
    activa:        { type: DataTypes.BOOLEAN,  allowNull: false, defaultValue: true },
    asignado_a_id: { type: DataTypes.INTEGER,  allowNull: true },
    creado_por_id: { type: DataTypes.INTEGER,  allowNull: true },
    fecha_fin:        { type: DataTypes.DATEONLY, allowNull: true },
    grupo_elemento_id:{ type: DataTypes.INTEGER,  allowNull: true },
  },
  { tableName: 'tareas_programadas', underscored: true }
);

module.exports = TareaProgramada;
