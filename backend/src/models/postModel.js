/** MODEL - Post del feed (con l'eventuale prenotazione allegata). */
const { query } = require('../config/db');

/**
 * Ogni post porta con se' i dati della prenotazione allegata (se c'e'):
 * servono a mostrare la scheda nel feed, ad aprire la schermata del campo
 * e a sapere se chi guarda si e' gia' aggiunto.
 *
 * La prenotazione annullata NON viene piu' esclusa dalla join: il post la
 * mostra come "annullata" invece di perdere la scheda senza spiegazioni.
 * Se invece la prenotazione e' stata proprio cancellata, resta il flag
 * p.prenotazione_rimossa (lo imposta il trigger sul database).
 */
const SELECT_BASE = `
  SELECT p.id, p.contenuto, p.created_at, p.prenotazione_rimossa,
         u.id AS user_id, u.nome AS autore, u.avatar,
         b.id AS booking_id, b.data AS booking_data, b.ora AS booking_ora,
         LEAST(b.partecipanti, s.max_partecipanti)::int AS booking_posti,
         b.stato AS booking_stato,
         v.id AS venue_id, v.nome AS booking_campo, v.indirizzo AS booking_indirizzo,
         v.prezzo::float AS booking_prezzo,
         s.nome AS booking_sport,
         CASE WHEN b.id IS NULL THEN 0
              ELSE 1 + (SELECT COUNT(*)::int FROM booking_participants bp
                        WHERE bp.booking_id = b.id) END AS booking_iscritti,
         CASE WHEN b.id IS NULL THEN false
              ELSE (b.user_id = $1 OR EXISTS (SELECT 1 FROM booking_participants bp
                    WHERE bp.booking_id = b.id AND bp.user_id = $1)) END AS booking_partecipo
  FROM posts p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN bookings b ON b.id = p.booking_id
  LEFT JOIN venues  v ON v.id = b.venue_id
  LEFT JOIN sports  s ON s.id = v.sport_id`;

async function elenco(utenteId, limite = 50) {
  const { rows } = await query(
    `${SELECT_BASE}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $2`,
    [utenteId, limite]
  );
  return rows;
}

async function perId(id, utenteId) {
  const { rows } = await query(`${SELECT_BASE} WHERE p.id = $2`, [utenteId, id]);
  return rows[0] || null;
}

async function crea(userId, contenuto, bookingId = null) {
  const { rows } = await query(
    'INSERT INTO posts (user_id, contenuto, booking_id) VALUES ($1,$2,$3) RETURNING id',
    [userId, contenuto, bookingId]
  );
  return perId(rows[0].id, userId);
}

async function elimina(id, userId) {
  const { rowCount } = await query('DELETE FROM posts WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
}

async function conta() {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM posts');
  return rows[0].n;
}

/* --- funzioni usate solo dal pannello di controllo (nessun vincolo di utente) --- */

/** Tutti i post, dal piu' recente: al pannello serve anche l'autore. */
async function tutti(limite = 200) {
  const { rows } = await query(
    `SELECT p.id, p.contenuto, p.created_at, p.prenotazione_rimossa,
            u.id AS user_id, u.nome AS autore, u.avatar,
            b.id AS booking_id, b.data AS booking_data, b.ora AS booking_ora,
            v.nome AS booking_campo, s.nome AS booking_sport
     FROM posts p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN bookings b ON b.id = p.booking_id
     LEFT JOIN venues   v ON v.id = b.venue_id
     LEFT JOIN sports   s ON s.id = v.sport_id
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $1`,
    [limite]
  );
  return rows;
}

/** Cancella un post qualsiasi (solo pannello di controllo). */
async function eliminaAdmin(id) {
  const { rowCount } = await query('DELETE FROM posts WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { elenco, perId, crea, elimina, conta, tutti, eliminaAdmin };
