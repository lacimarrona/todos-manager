'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('items_plantilla', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      plantilla_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'plantillas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      label: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      orden: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
    await queryInterface.dropTable('items_plantilla');
  },
};
