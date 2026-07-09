'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('usuarios');
    if (!tableDescription.activo) {
      await queryInterface.addColumn('usuarios', 'activo', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        after: 'rol',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('usuarios', 'activo');
  },
};
