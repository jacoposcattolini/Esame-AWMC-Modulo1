/** MODEL - Notifiche. */
const { query } = require('../config/db');

async function perUtente(userId) {
  const { rows } = await query(
    `SELECT id, titolo, testo, avatar, tipo, link, letta, created_at
     FROM notifications WHERE user_id = $1
     ORDER BY created_at DESC, id DESC`,
    [userId]
  );
  return rows;
}

/**
 * "link" e' la schermata dell'app da aprire quando la notifica viene toccata.
 * "autoreId" e' l'utente che l'ha provocata (assente per quelle di sistema).
 */
async function crea({ userId, titolo, testo, avatar = '', tipo = 'social', link = '', autoreId = null }) {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, titolo, testo, avatar, tipo, link, autore_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, titolo, testo, avatar, tipo, link, letta, created_at`,
    [userId, titolo, testo, avatar, tipo, link, autoreId]
  );
  return rows[0];
}

/**
 * Toglie una notifica gia' recapitata: la usa l'annullamento della richiesta
 * di amicizia, perche' chi la riceve non deve continuare a vedere l'avviso di
 * una richiesta che non esiste piu'.
 */
async function elimina({ userId, autoreId, testo }) {
  const { rowCount } = await query(
    `DELETE FROM notifications
     WHERE user_id = $1 AND autore_id = $2 AND testo = $3`,
    [userId, autoreId, testo]
  );
  return rowCount;
}

async function segnaLette(userId) {
  await query('UPDATE notifications SET letta = true WHERE user_id = $1', [userId]);
  return true;
}

module.exports = { perUtente, crea, elimina, segnaLette };
