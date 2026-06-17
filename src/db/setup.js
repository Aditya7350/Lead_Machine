import { setupDatabase } from '../config/db.js';

setupDatabase()
  .then(() => {
    console.log('[Setup] Database ready!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Setup] Failed:', err.message);
    process.exit(1);
  });
