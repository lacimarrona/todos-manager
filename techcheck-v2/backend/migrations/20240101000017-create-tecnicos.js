'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tecnicos', {
      id:           { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      workspace_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'workspaces', key: 'id' }, onDelete: 'CASCADE' },
      nombre:       { type: Sequelize.STRING(255), allowNull: false },
      email:        { type: Sequelize.STRING(255), allowNull: true },
      activo:       { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at:   { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at:   { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('tecnicos', ['workspace_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('tecnicos');
  },
};
