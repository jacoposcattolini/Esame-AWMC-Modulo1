/** Avvio del server: prima migrazione/seed del DB, poi ascolto HTTP. */
require('dotenv').config();
const app = require('./app');
const { migrate } = require('./config/migrate');

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await migrate();
  } catch (err) {
    console.error('[server] migrazione fallita:', err.message);
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] SportEasy API in ascolto su http://localhost:${PORT}/api`);
    console.log('[server] nessuna interfaccia grafica: il pannello di controllo sta nel frontend');
  });
})();
