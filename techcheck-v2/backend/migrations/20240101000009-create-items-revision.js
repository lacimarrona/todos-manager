'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('items_revision', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      revision_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'revisiones', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'items_equipo', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      label: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      checked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      nota: {
        type: Sequelize.TEXT,
        allowNull: true,
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
    await queryInterface.dropTable('items_revision');
  },
};
