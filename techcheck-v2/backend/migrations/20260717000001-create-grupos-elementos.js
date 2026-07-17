'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('grupos_elementos', {
      id:           { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      workspace_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'workspaces', key: 'id' }, onDelete: 'CASCADE',
      },
      nombre:      { type: Sequelize.STRING(120), allowNull: false },
      descripcion: { type: Sequelize.STRING(255), allowNull: true },
      activo:      { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at:  { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at:  { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('grupos_elementos');
  },
};
