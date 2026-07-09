'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface) {
    const email = process.env.SUPERADMIN_EMAIL || 'admin@techcheck.com';
    const password = process.env.SUPERADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(password, 10);

    await queryInterface.bulkInsert(
      'usuarios',
      [
        {
          nombre: 'Super Admin',
          email,
          password_hash: hash,
          rol: 'superadmin',
          workspace_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    const email = process.env.SUPERADMIN_EMAIL || 'admin@techcheck.com';
    await queryInterface.bulkDelete('usuarios', { email }, {});
  },
};
