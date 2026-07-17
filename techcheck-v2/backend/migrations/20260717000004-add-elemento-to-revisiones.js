'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('revisiones', 'elemento_seleccionado_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'estado_calidad',
      references: { model: 'elementos_grupo', key: 'id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('revisiones', 'elemento_seleccionado_id');
  },
};
