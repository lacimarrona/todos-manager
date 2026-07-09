'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ItemEquipo = sequelize.define(
  'ItemEquipo',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    equipo_id: { type: DataTypes.INTEGER, allowNull: false },
    label: { type: DataTypes.STRING(500), allowNull: false },
    observacion_guia: { type: DataTypes.TEXT, allowNull: true },
    orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { tableName: 'items_equipo', underscored: true }
);

module.exports = ItemEquipo;
