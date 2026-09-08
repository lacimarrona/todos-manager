'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('items_revision', 'estado_calidad', {
      type: Sequelize.ENUM('ok', 'observacion', 'problema'),
      allowNull: true,
      defaultValue: null,
      after: 'nota',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('items_revision', 'estado_calidad');
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS enum_items_revision_estado_calidad;").catch(() => {});
  },
};
