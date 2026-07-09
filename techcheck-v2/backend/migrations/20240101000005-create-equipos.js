'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('equipos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      proyecto_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'proyectos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      nombre: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      plantilla_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'plantillas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      tecnico_asignado_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      tiempo_limite: {
        type: Sequelize.INTEGER, // minutos para completar la revisión
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
    await queryInterface.dropTable('equipos');
  },
};
