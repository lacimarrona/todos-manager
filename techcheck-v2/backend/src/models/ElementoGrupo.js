'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ElementoGrupo = sequelize.define(
  'ElementoGrupo',
  {
    id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    grupo_id:    { type: DataTypes.INTEGER, allowNull: false },
    valor:       { type: DataTypes.STRING(200), allowNull: false },
    descripcion: { type: DataTypes.STRING(255), allowNull: true },
    activo:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: 'elementos_grupo', underscored: true }
);

module.exports = ElementoGrupo;
