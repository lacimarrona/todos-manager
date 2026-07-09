'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('archivos_obs_general', {
      id:          { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      revision_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'revisiones', key: 'id' }, onDelete: 'CASCADE' },
      url:         { type: Sequelize.TEXT, allowNull: false },
      tipo:        { type: Sequelize.ENUM('imagen', 'documento'), allowNull: false, defaultValue: 'imagen' },
      created_at:  { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at:  { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('archivos_obs_general', ['revision_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('archivos_obs_general');
  },
};
