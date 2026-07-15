'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Flag restringido en proyectos
    await queryInterface.addColumn('proyectos', 'restringido', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'creado_por',
    });

    // Tabla de permisos por proyecto
    await queryInterface.createTable('proyecto_permisos', {
      id:          { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      proyecto_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'proyectos', key: 'id' }, onDelete: 'CASCADE' },
      usuario_id:  { type: Sequelize.INTEGER, allowNull: false, references: { model: 'usuarios', key: 'id' }, onDelete: 'CASCADE' },
      nivel:       { type: Sequelize.ENUM('ver', 'editar'), allowNull: false, defaultValue: 'ver' },
      created_at:  { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at:  { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('proyecto_permisos', ['proyecto_id', 'usuario_id'], { unique: true, name: 'idx_proyecto_permisos_unique' });
    await queryInterface.addIndex('proyecto_permisos', ['usuario_id'], { name: 'idx_proyecto_permisos_usuario' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('proyecto_permisos');
    await queryInterface.removeColumn('proyectos', 'restringido');
  },
};
