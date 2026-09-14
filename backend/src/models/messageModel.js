/**
 * MODEL - Messaggi delle chat.
 * Due tipi di conversazione sulla stessa tabella:
 *   - diretta: mittente_id -> destinatario_id
 *   - di gruppo: mittente_id -> group_id
 *
 * Un messaggio puo' avere una prenotazione allegata (messages.booking_id):
 * e' l'invito che la chat mostra come scheda con i tasti per partecipare o
 * rifiutare. Ogni query porta con se' i dati della prenotazione e lo stato
 * dell'invito PER CHI LEGGE (primo parametro di tutte le query): nella chat
 * di gruppo la stessa scheda risulta accettata per uno e in attesa per un
 * altro.
 */
const { query } = require('../config/db');

const SELECT_BASE = `
  SELECT m.id, m.testo, m.created_at, m.mittente_id,
         u.nome AS mittente, u.avatar AS mittente_avatar,
         b.id AS booking_id, b.data AS booking_data, b.ora AS booking_ora,
         b.stato AS booking_stato, b.user_id AS booking_user_id,
         o.nome AS booking_organizzatore,
         v.id AS venue_id, v.nome AS booking_campo, v.immagine AS booking_immagine,
         v.prezzo::float AS booking_prezzo,
         s.nome AS booking_sport,
         LEAST(b.partecipanti, s.max_partecipanti)::int AS booking_posti,
         CASE WHEN b.id IS NULL THEN 0
              ELSE 1 + (SELECT COUNT(*)::int FROM booking_participants bp
                        WHERE bp.booking_id = b.id) END AS booking_iscritti,
         CASE WHEN b.id IS NULL THEN false
              ELSE (b.user_id = $1 OR EXISTS (SELECT 1 FROM booking_participants bp
                    WHERE bp.booking_id = b.id AND bp.user_id = $1)) END AS booking_partecipo,
         (SELECT i.stato FROM booking_invites i
          WHERE i.booking_id = b.id AND i.user_id = $1) AS invito_stato
  FROM messages m
  JOIN users u ON u.id = m.mittente_id
  LEFT JOIN bookings b ON b.id = m.booking_id
  LEFT JOIN venues   v ON v.id = b.venue_id
  LEFT JOIN sports   s ON s.id = v.sport_id
  LEFT JOIN users    o ON o.id = b.user_id`;

/* ----------------------------- CHAT DIRETTE ----------------------------- */

/** Conversazione fra due utenti, dal piu' vecchio al piu' recente. */
async function conversazioneDiretta(userId, altroId) {
  const { rows } = await query(
    `${SELECT_BASE}
     WHERE (m.mittente_id = $1 AND m.destinatario_id = $2)
        OR (m.mittente_id = $2 AND m.destinatario_id = $1)
     ORDER BY m.created_at, m.id`,
    [userId, altroId]
  );
  return rows;
}

async function inviaDiretto(mittenteId, destinatarioId, testo, bookingId = null) {
  const { rows } = await query(
    `INSERT INTO messages (mittente_id, destinatario_id, testo, booking_id) VALUES ($1,$2,$3,$4)
     RETURNING id`,
    [mittenteId, destinatarioId, testo, bookingId]
  );
  return perId(rows[0].id, mittenteId);
}

/** Ultimo messaggio scambiato con ogni amico: serve all'anteprima nella lista. */
async function ultimiPerAmici(userId) {
  const { rows } = await query(
    `SELECT DISTINCT ON (altro_id) altro_id, testo, created_at, mittente_id
     FROM (
       SELECT CASE WHEN mittente_id = $1 THEN destinatario_id ELSE mittente_id END AS altro_id,
              testo, created_at, mittente_id
       FROM messages
       WHERE destinatario_id IS NOT NULL AND (mittente_id = $1 OR destinatario_id = $1)
     ) AS conversazioni
     ORDER BY altro_id, created_at DESC`,
    [userId]
  );
  return rows;
}

/* ----------------------------- CHAT DI GRUPPO ---------------------------- */

async function conversazioneGruppo(groupId, lettoreId) {
  const { rows } = await query(
    `${SELECT_BASE} WHERE m.group_id = $2 ORDER BY m.created_at, m.id`,
    [lettoreId, groupId]
  );
  return rows;
}

async function inviaAlGruppo(mittenteId, groupId, testo, bookingId = null) {
  const { rows } = await query(
    'INSERT INTO messages (mittente_id, group_id, testo, booking_id) VALUES ($1,$2,$3,$4) RETURNING id',
    [mittenteId, groupId, testo, bookingId]
  );
  return perId(rows[0].id, mittenteId);
}

/** Ultimo messaggio di ogni gruppo dell'utente: anteprima nella lista gruppi. */
async function ultimiPerGruppi(userId) {
  const { rows } = await query(
    `SELECT DISTINCT ON (m.group_id) m.group_id, m.testo, m.created_at,
            u.nome AS mittente
     FROM messages m
     JOIN users u ON u.id = m.mittente_id
     JOIN group_members gm ON gm.group_id = m.group_id AND gm.user_id = $1
     WHERE m.group_id IS NOT NULL
     ORDER BY m.group_id, m.created_at DESC`,
    [userId]
  );
  return rows;
}

/* --------------------------------- COMUNE -------------------------------- */

/** Un messaggio solo, letto con gli occhi di `lettoreId` (vedi SELECT_BASE). */
async function perId(id, lettoreId) {
  const { rows } = await query(`${SELECT_BASE} WHERE m.id = $2`, [lettoreId, id]);
  return rows[0] || null;
}

module.exports = {
  conversazioneDiretta, inviaDiretto, ultimiPerAmici,
  conversazioneGruppo, inviaAlGruppo, ultimiPerGruppi,
  perId,
};
