'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tareas_programadas', 'grupo_elemento_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'fecha_fin',
      references: { model: 'grupos_elementos', key: 'id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tareas_programadas', 'grupo_elemento_id');
  },
};
