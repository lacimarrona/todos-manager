'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('elementos_grupo', {
      id:       { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      grupo_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'grupos_elementos', key: 'id' }, onDelete: 'CASCADE',
      },
      valor:       { type: Sequelize.STRING(200), allowNull: false },
      descripcion: { type: Sequelize.STRING(255), allowNull: true },
      activo:      { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at:  { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at:  { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('elementos_grupo');
  },
};
