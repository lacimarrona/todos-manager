'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tareas_programadas', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      equipo_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'equipos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      hora: {
        type: Sequelize.TIME, // formato HH:MM:SS
        allowNull: false,
      },
      dias_semana: {
        type: Sequelize.JSON, // ej: [1,2,3,4,5] — 0=dom, 1=lun, ..., 6=sáb
        allowNull: false,
      },
      activa: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
    await queryInterface.dropTable('tareas_programadas');
  },
};
