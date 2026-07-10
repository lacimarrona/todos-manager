-- Crea una base de datos separada para los tests automatizados (Vitest + Supertest),
-- para no correr TRUNCATE/migraciones contra la base de datos de desarrollo.
-- Solo se ejecuta en el PRIMER arranque del volumen de MySQL (comportamiento
-- estándar de la imagen oficial). Si el volumen ya existía, crearla a mano una vez:
--   docker compose exec mysql mysql -uroot -p"$DB_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS techcheck_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON techcheck_test.* TO '$DB_USER'@'%'; FLUSH PRIVILEGES;"

CREATE DATABASE IF NOT EXISTS techcheck_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON techcheck_test.* TO 'techcheck_user'@'%';
FLUSH PRIVILEGES;
