'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ItemRevision = sequelize.define(
  'ItemRevision',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    revision_id: { type: DataTypes.INTEGER, allowNull: false },
    item_id: { type: DataTypes.INTEGER, allowNull: false },
    label: { type: DataTypes.STRING(500), allowNull: false },
    checked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    nota: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: 'items_revision', underscored: true }
);

module.exports = ItemRevision;
