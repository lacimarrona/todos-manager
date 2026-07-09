'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // archivos_revision.url — fotos de evidencia en revisiones (base64 de cámara)
    await queryInterface.changeColumn('archivos_revision', 'url', {
      type: Sequelize.TEXT('long'),
      allowNull: false,
    });
    // archivos_guia.url — fotos guía en ítems de equipo
    await queryInterface.changeColumn('archivos_guia', 'url', {
      type: Sequelize.TEXT('long'),
      allowNull: false,
    });
    // archivos_obs_general.url — fotos en observación general
    await queryInterface.changeColumn('archivos_obs_general', 'url', {
      type: Sequelize.TEXT('long'),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('archivos_revision', 'url', {
      type: Sequelize.STRING(500),
      allowNull: false,
    });
    await queryInterface.changeColumn('archivos_guia', 'url', {
      type: Sequelize.STRING(500),
      allowNull: false,
    });
    await queryInterface.changeColumn('archivos_obs_general', 'url', {
      type: Sequelize.STRING(500),
      allowNull: false,
    });
  },
};
