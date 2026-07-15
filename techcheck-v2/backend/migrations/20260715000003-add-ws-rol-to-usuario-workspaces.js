'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('usuario_workspaces', 'ws_rol', {
      type: Sequelize.ENUM('admin', 'usuario'),
      allowNull: false,
      defaultValue: 'usuario',
      after: 'workspace_id',
    });

    // Migrar datos existentes: usar el rol global del usuario como ws_rol inicial
    await queryInterface.sequelize.query(`
      UPDATE usuario_workspaces uw
      JOIN usuarios u ON uw.usuario_id = u.id
      SET uw.ws_rol = u.rol
      WHERE u.rol IN ('admin', 'usuario')
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('usuario_workspaces', 'ws_rol');
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS enum_usuario_workspaces_ws_rol`);
  },
};
