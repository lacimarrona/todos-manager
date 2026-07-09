'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Usuario = sequelize.define(
  'Usuario',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workspace_id: { type: DataTypes.INTEGER, allowNull: true },
    nombre: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    rol: {
      type: DataTypes.ENUM('superadmin', 'admin', 'usuario'),
      allowNull: false,
    },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: 'usuarios',
    underscored: true,
  }
);

module.exports = Usuario;
