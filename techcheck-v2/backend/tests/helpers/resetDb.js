const { sequelize } = require('../../src/config/database');

// TRUNCATE de todas las tablas de la BD de test entre tests. Se prefiere sobre
// transacciones con rollback porque los controladores no reciben una transacción
// inyectada (no hay sequelize.useCLS() configurado en la app).
async function resetDb() {
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  const tables = await sequelize.getQueryInterface().showAllTables();
  for (const t of tables.filter((t) => t !== 'SequelizeMeta')) {
    await sequelize.query(`TRUNCATE TABLE \`${t}\``);
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

module.exports = { resetDb };
