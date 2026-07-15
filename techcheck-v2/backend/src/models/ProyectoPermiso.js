'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProyectoPermiso = sequelize.define(
  'ProyectoPermiso',
  {
    id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    proyecto_id: { type: DataTypes.INTEGER, allowNull: false },
    usuario_id:  { type: DataTypes.INTEGER, allowNull: false },
    nivel:       { type: DataTypes.ENUM('ver', 'editar'), allowNull: false, defaultValue: 'ver' },
  },
  { tableName: 'proyecto_permisos', underscored: true }
);

module.exports = ProyectoPermiso;
