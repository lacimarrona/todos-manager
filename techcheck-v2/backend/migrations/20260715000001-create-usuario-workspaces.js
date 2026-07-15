'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('usuario_workspaces', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'CASCADE',
      },
      workspace_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'workspaces', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('usuario_workspaces', ['usuario_id', 'workspace_id'], {
      unique: true,
      name: 'uw_unique_usuario_workspace',
    });

    // Migrar membresías existentes desde usuarios.workspace_id
    await queryInterface.sequelize.query(`
      INSERT IGNORE INTO usuario_workspaces (usuario_id, workspace_id, created_at, updated_at)
      SELECT id, workspace_id, NOW(), NOW()
      FROM usuarios
      WHERE workspace_id IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('usuario_workspaces');
  },
};
