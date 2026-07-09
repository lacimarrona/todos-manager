'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ArchivoRevision = sequelize.define(
  'ArchivoRevision',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    item_rev_id: { type: DataTypes.INTEGER, allowNull: false },
    url: { type: DataTypes.STRING(1000), allowNull: false },
    tipo: {
      type: DataTypes.ENUM('imagen', 'video', 'documento'),
      allowNull: false,
    },
  },
  { tableName: 'archivos_revision', underscored: true }
);

module.exports = ArchivoRevision;
