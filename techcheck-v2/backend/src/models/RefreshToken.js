'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RefreshToken = sequelize.define(
  'RefreshToken',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: false },
    token_hash: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    user_agent: { type: DataTypes.STRING(500), allowNull: true },
    ip: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    tableName: 'refresh_tokens',
    underscored: true,
  }
);

module.exports = RefreshToken;
