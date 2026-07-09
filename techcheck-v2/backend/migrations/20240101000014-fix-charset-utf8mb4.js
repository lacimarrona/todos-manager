'use strict';

const TABLES = [
  'workspaces',
  'plantillas',
  'items_plantilla',
  'usuarios',
  'proyectos',
  'equipos',
  'items_equipo',
  'archivos_guia',
  'revisiones',
  'items_revision',
  'archivos_revision',
  'tareas_programadas',
  'refresh_tokens',
];

module.exports = {
  async up(queryInterface) {
    const db = queryInterface.sequelize.config.database;

    await queryInterface.sequelize.query(
      `ALTER DATABASE \`${db}\` CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci`
    );

    for (const table of TABLES) {
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
    }
  },

  async down() {
    // charset changes are not reversible without data loss risk
  },
};
