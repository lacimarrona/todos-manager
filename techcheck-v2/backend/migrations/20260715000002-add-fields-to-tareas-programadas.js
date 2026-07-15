'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tareas_programadas', 'asignado_a_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'activa',
      references: { model: 'usuarios', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('tareas_programadas', 'creado_por_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'asignado_a_id',
      references: { model: 'usuarios', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('tareas_programadas', 'fecha_fin', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      after: 'creado_por_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tareas_programadas', 'fecha_fin');
    await queryInterface.removeColumn('tareas_programadas', 'creado_por_id');
    await queryInterface.removeColumn('tareas_programadas', 'asignado_a_id');
  },
};
