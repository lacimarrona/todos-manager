'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ArchivoGuia = sequelize.define(
  'ArchivoGuia',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    item_id: { type: DataTypes.INTEGER, allowNull: false },
    url: { type: DataTypes.TEXT, allowNull: false },
    tipo: {
      type: DataTypes.ENUM('imagen', 'video', 'documento'),
      allowNull: false,
    },
  },
  { tableName: 'archivos_guia', underscored: true }
);

module.exports = ArchivoGuia;
