import mysql from 'mysql2/promise';
import {
  MYSQL_CONFIG,
  POKEMON_TYPES,
  TOTAL_POKEMON
} from './lib/config.mjs';

const BATCH_SIZE = 500;

async function clearPokemon(connection) {
  await connection.query('DELETE FROM pokemon');
  await connection.query('ALTER TABLE pokemon AUTO_INCREMENT = 1');
}

function buildBatch(startIndex, size) {
  const rows = [];

  for (let i = 0; i < size; i += 1) {
    const id = startIndex + i;
    rows.push([
      `Pokemon-${String(id).padStart(4, '0')}`,
      POKEMON_TYPES[id % POKEMON_TYPES.length]
    ]);
  }

  return rows;
}

async function seedPokemon(connection) {
  for (let offset = 0; offset < TOTAL_POKEMON; offset += BATCH_SIZE) {
    const size = Math.min(BATCH_SIZE, TOTAL_POKEMON - offset);
    const batch = buildBatch(offset + 1, size);

    await connection.query('INSERT INTO pokemon (name, type) VALUES ?', [batch]);

    const inserted = offset + size;
    process.stdout.write(`\rInseridos: ${inserted}/${TOTAL_POKEMON}`);
  }

  console.log('');
}

async function main() {
  console.log('Conectando ao MySQL...');
  console.log(`Host: ${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}`);
  console.log(`Database: ${MYSQL_CONFIG.database}`);

  const connection = await mysql.createConnection(MYSQL_CONFIG);

  try {
    const [[{ total }]] = await connection.query(
      'SELECT COUNT(*) AS total FROM pokemon'
    );

    console.log(`Registros atuais: ${total}`);

    if (Number(total) === TOTAL_POKEMON && !process.argv.includes('--force')) {
      console.log(`Banco já possui ${total} registros (meta: ${TOTAL_POKEMON}).`);
      console.log('Use --force para recriar os dados.');
      return;
    }

    console.log('Limpando tabela pokemon...');
    await clearPokemon(connection);

    console.log(`Populando ${TOTAL_POKEMON} Pokémons...`);
    await seedPokemon(connection);

    const [[{ finalTotal }]] = await connection.query(
      'SELECT COUNT(*) AS finalTotal FROM pokemon'
    );

    console.log(`Seed concluído: ${finalTotal} registros.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('\nErro ao popular o banco:', error.message);
  process.exit(1);
});
