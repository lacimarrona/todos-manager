'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('archivos_revision', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      item_rev_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'items_revision', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      url: {
        type: Sequelize.STRING(1000),
        allowNull: false,
      },
      tipo: {
        type: Sequelize.ENUM('imagen', 'video', 'documento'),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('archivos_revision');
  },
};
