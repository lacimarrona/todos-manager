'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UsuarioWorkspace = sequelize.define(
  'UsuarioWorkspace',
  {
    id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuario_id:   { type: DataTypes.INTEGER, allowNull: false },
    workspace_id: { type: DataTypes.INTEGER, allowNull: false },
    ws_rol:       { type: DataTypes.ENUM('admin', 'usuario'), allowNull: false, defaultValue: 'usuario' },
  },
  { tableName: 'usuario_workspaces', underscored: true }
);

module.exports = UsuarioWorkspace;
