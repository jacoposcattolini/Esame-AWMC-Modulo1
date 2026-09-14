/** MODEL - Prenotazioni. */
const { query } = require('../config/db');

// "iscritti" = organizzatore + chi si e' aggiunto dal post nel feed;
// "partecipanti" resta il numero di posti dichiarato alla prenotazione.
const SELECT_BASE = `
  SELECT b.id, b.user_id, b.data, b.ora, b.partecipanti, b.totale::float AS totale,
         b.pagato::float AS pagato, b.stato, b.created_at,
         v.id AS venue_id, v.nome AS campo, v.immagine, v.indirizzo,
         v.prezzo::float AS prezzo,
         s.nome AS sport, s.slug AS sport_slug, s.max_partecipanti,
         o.nome AS organizzatore,
         -- posti realmente disponibili: il numero dichiarato non puo' superare
         -- il tetto dello sport (utile anche per le prenotazioni gia' salvate
         -- prima che il limite esistesse)
         LEAST(b.partecipanti, s.max_partecipanti)::int AS posti,
         1 + (SELECT COUNT(*)::int FROM booking_participants p WHERE p.booking_id = b.id) AS iscritti
  FROM bookings b
  JOIN venues v ON v.id = b.venue_id
  JOIN sports s ON s.id = v.sport_id
  JOIN users  o ON o.id = b.user_id`;

async function crea({ userId, venueId, data, ora, partecipanti, totale, stato = 'confermata' }) {
  const { rows } = await query(
    `INSERT INTO bookings (user_id, venue_id, data, ora, partecipanti, totale, stato)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [userId, venueId, data, ora, partecipanti, totale, stato]
  );
  return perId(rows[0].id);
}

/**
 * Dentro una transazione va passato il client (`esegui`): con la connessione
 * globale si rileggerebbe lo stato precedente, perche' le modifiche non sono
 * ancora state confermate.
 */
async function perId(id, esegui = query) {
  const { rows } = await esegui(`${SELECT_BASE} WHERE b.id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Prenotazioni dell'utente: quelle che ha creato lui e quelle a cui si e'
 * aggiunto dal feed. Il campo "mio" distingue le une dalle altre (solo
 * l'organizzatore puo' annullare).
 */
async function perUtente(userId) {
  const { rows } = await query(
    `SELECT p.*, (p.user_id = $1) AS mio
     FROM (${SELECT_BASE}) p
     WHERE p.user_id = $1
        OR EXISTS (SELECT 1 FROM booking_participants bp
                   WHERE bp.booking_id = p.id AND bp.user_id = $1)
     ORDER BY p.data DESC, p.ora DESC`,
    [userId]
  );
  return rows;
}

/**
 * Prenotazioni ancora aperte organizzate da un utente: non annullate e non
 * passate. Le usa il profilo altrui per far aggiungere chi le guarda.
 * `chiGuarda` serve a sapere se e' gia' iscritto.
 */
async function aperteDi(userId, chiGuarda, dalGiorno) {
  const { rows } = await query(
    `SELECT p.*,
            EXISTS (SELECT 1 FROM booking_participants bp
                    WHERE bp.booking_id = p.id AND bp.user_id = $2) AS partecipo
     FROM (${SELECT_BASE}) p
     WHERE p.user_id = $1 AND p.stato <> 'annullata' AND p.data >= $3::date
     ORDER BY p.data, p.ora`,
    [userId, chiGuarda, dalGiorno]
  );
  return rows;
}

/** Aggiunge l'utente a una prenotazione altrui. false se era gia' iscritto. */
async function aggiungiPartecipante(bookingId, userId, pagato = 0, esegui = query) {
  const { rowCount } = await esegui(
    `INSERT INTO booking_participants (booking_id, user_id, pagato) VALUES ($1,$2,$3)
     ON CONFLICT DO NOTHING`,
    [bookingId, userId, pagato]
  );
  return rowCount > 0;
}

/** Quanto ha versato un partecipante (0 se non e' iscritto). */
async function quotaPartecipante(bookingId, userId, esegui = query) {
  const { rows } = await esegui(
    'SELECT pagato::float AS pagato FROM booking_participants WHERE booking_id = $1 AND user_id = $2',
    [bookingId, userId]
  );
  return rows[0] ? rows[0].pagato : 0;
}

/** Partecipanti che hanno versato qualcosa: serve a rimborsarli in blocco. */
async function partecipantiDaRimborsare(bookingId, esegui = query) {
  const { rows } = await esegui(
    'SELECT user_id, pagato::float AS pagato FROM booking_participants WHERE booking_id = $1 AND pagato > 0',
    [bookingId]
  );
  return rows;
}

/** Azzera le quote versate dopo averle rimborsate. */
async function azzeraQuote(bookingId, esegui = query) {
  await esegui('UPDATE booking_participants SET pagato = 0 WHERE booking_id = $1', [bookingId]);
}

/** Registra quanto e' stato versato dall'organizzatore. */
async function segnaPagata(id, importo, esegui = query) {
  await esegui('UPDATE bookings SET pagato = $1 WHERE id = $2', [importo, id]);
}

async function rimuoviPartecipante(bookingId, userId, esegui = query) {
  const { rowCount } = await esegui(
    'DELETE FROM booking_participants WHERE booking_id = $1 AND user_id = $2',
    [bookingId, userId]
  );
  return rowCount > 0;
}

/* ------------------------------- INVITI ------------------------------- */

/**
 * Registra (o rinnova) l'invito per un gruppo di persone.
 * Un invito non occupa un posto: serve a ricordare chi e' stato chiamato e
 * cosa ha risposto, cosi' la scheda in chat sa cosa mostrare.
 */
async function creaInviti(bookingId, utenti, esegui = query) {
  for (const userId of utenti) {
    await esegui(
      `INSERT INTO booking_invites (booking_id, user_id) VALUES ($1,$2)
       ON CONFLICT (booking_id, user_id)
         DO UPDATE SET stato = 'in_attesa', created_at = now()
       WHERE booking_invites.stato = 'rifiutato'`,
      [bookingId, userId]
    );
  }
  return utenti.length;
}

/** Segna la risposta a un invito ('accettato' | 'rifiutato'). */
async function rispondiInvito(bookingId, userId, stato, esegui = query) {
  const { rowCount } = await esegui(
    'UPDATE booking_invites SET stato = $3 WHERE booking_id = $1 AND user_id = $2',
    [bookingId, userId, stato]
  );
  return rowCount > 0;
}

/** true se l'utente e' l'organizzatore oppure si e' gia' aggiunto. */
async function partecipa(bookingId, userId) {
  const { rows } = await query(
    `SELECT 1 FROM bookings WHERE id = $1 AND user_id = $2
     UNION ALL
     SELECT 1 FROM booking_participants WHERE booking_id = $1 AND user_id = $2`,
    [bookingId, userId]
  );
  return rows.length > 0;
}

async function aggiornaStato(id, userId, stato, esegui = query) {
  const { rows } = await esegui(
    'UPDATE bookings SET stato = $1 WHERE id = $2 AND user_id = $3 RETURNING id',
    [stato, id, userId]
  );
  return rows[0] ? perId(id, esegui) : null;
}

async function elimina(id, userId) {
  const { rowCount } = await query('DELETE FROM bookings WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
}

/* --- funzioni usate solo dal pannello di controllo (nessun vincolo di utente) --- */

/** Tutte le prenotazioni, dalla piu' recente. */
async function tutte(limite = 200) {
  const { rows } = await query(
    `${SELECT_BASE} ORDER BY b.data DESC, b.ora DESC, b.id DESC LIMIT $1`,
    [limite]
  );
  return rows;
}

/** Cambia stato a una prenotazione qualsiasi (solo pannello di controllo). */
async function cambiaStatoAdmin(id, stato) {
  const { rows } = await query(
    'UPDATE bookings SET stato = $1 WHERE id = $2 RETURNING id',
    [stato, id]
  );
  return rows[0] ? perId(id) : null;
}

/** Cancella una prenotazione qualsiasi (solo pannello di controllo). */
async function eliminaAdmin(id) {
  const { rowCount } = await query('DELETE FROM bookings WHERE id = $1', [id]);
  return rowCount > 0;
}

/** Orari gia occupati per un campo in una data (per disabilitarli nella UI). */
async function orariOccupati(venueId, data) {
  const { rows } = await query(
    `SELECT ora FROM bookings WHERE venue_id = $1 AND data = $2 AND stato <> 'annullata'`,
    [venueId, data]
  );
  return rows.map((r) => r.ora);
}

async function conta() {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM bookings');
  return rows[0].n;
}

async function ultime(limite = 10) {
  const { rows } = await query(
    `${SELECT_BASE} ORDER BY b.created_at DESC LIMIT $1`,
    [limite]
  );
  return rows;
}

module.exports = {
  crea, perId, perUtente, aggiornaStato, elimina, orariOccupati, conta, ultime,
  aggiungiPartecipante, rimuoviPartecipante, partecipa,
  tutte, cambiaStatoAdmin, eliminaAdmin,
  quotaPartecipante, partecipantiDaRimborsare, azzeraQuote, segnaPagata,
  creaInviti, rispondiInvito,
  aperteDi,
};
