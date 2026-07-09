'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Equipo = sequelize.define(
  'Equipo',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    proyecto_id: { type: DataTypes.INTEGER, allowNull: false },
    nombre: { type: DataTypes.STRING(255), allowNull: false },
    plantilla_id: { type: DataTypes.INTEGER, allowNull: true },
    tecnico_asignado_id: { type: DataTypes.INTEGER, allowNull: true },
    tiempo_limite: { type: DataTypes.INTEGER, allowNull: true }, // minutos
    archivado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { tableName: 'equipos', underscored: true }
);

module.exports = Equipo;
