'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('items_plantilla', 'observacion_guia', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      after: 'label',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('items_plantilla', 'observacion_guia');
  },
};
