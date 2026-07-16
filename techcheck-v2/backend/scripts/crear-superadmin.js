'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');
const { Usuario } = require('../src/models');

async function main() {
  const [,, email, password, nombre = 'Super Admin'] = process.argv;

  if (!email || !password) {
    console.error('Uso: node scripts/crear-superadmin.js <email> <password> [nombre]');
    console.error('Ej:  node scripts/crear-superadmin.js admin@empresa.com MiClave123 "Admin Principal"');
    process.exit(1);
  }

  const existe = await Usuario.findOne({ where: { email } });
  if (existe) {
    console.error(`Ya existe un usuario con el email: ${email}`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  await Usuario.create({
    nombre,
    email,
    password_hash: hash,
    rol: 'superadmin',
    workspace_id: null,
    activo: true,
  });

  console.log(`Superadmin creado: ${nombre} <${email}>`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
