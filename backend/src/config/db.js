/**
 * Connessione a PostgreSQL (pool condiviso).
 * Tutti i Model del backend passano da qui: e' l'unico punto che parla col DBMS.
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://sporteasy:sporteasy@localhost:5432/sporteasy',
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[db] errore inatteso sul client inattivo:', err.message);
});

/** Esegue una query parametrica (protetta da SQL injection). */
async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

/** Aspetta che il DBMS sia pronto (utile con Docker: Postgres parte dopo). */
async function waitForDatabase(retries = 30, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (err) {
      console.log(`[db] Postgres non pronto (tentativo ${i}/${retries}): ${err.code || err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Impossibile connettersi a PostgreSQL');
}

module.exports = { pool, query, waitForDatabase };
