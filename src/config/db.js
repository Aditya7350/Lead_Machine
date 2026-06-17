import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Connection Pool ---
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

export const query = (text, params) => pool.query(text, params);

export const getClient = () => pool.connect();

export default pool;

// --- Setup: run schema.sql ---
export async function setupDatabase() {
  const schemaPath = join(__dirname, '..', 'db', 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');
  try {
    await pool.query(sql);
    console.log('[DB] Schema applied successfully');
  } catch (err) {
    console.error('[DB] Schema error:', err.message);
    throw err;
  }
}

// Run directly with: node src/config/db.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setupDatabase()
    .then(() => { console.log('Done'); process.exit(0); })
    .catch(() => process.exit(1));
}
