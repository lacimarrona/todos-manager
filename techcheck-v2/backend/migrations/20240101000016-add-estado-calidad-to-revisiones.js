'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('revisiones', 'estado_calidad', {
      type: Sequelize.ENUM('ok', 'observacion', 'problema'),
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('revisiones', 'estado_calidad');
  },
};
