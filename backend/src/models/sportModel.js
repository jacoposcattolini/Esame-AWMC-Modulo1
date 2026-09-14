/** MODEL - Sport e campi (venues). */
const { query } = require('../config/db');

async function elencoSport() {
  const { rows } = await query(
    'SELECT id, slug, nome, immagine, max_partecipanti FROM sports ORDER BY ordine, id'
  );
  return rows;
}

async function sportPerSlug(slug) {
  const { rows } = await query(
    'SELECT id, slug, nome, immagine, max_partecipanti FROM sports WHERE slug = $1',
    [slug]
  );
  return rows[0] || null;
}

async function campiPerSport(slug) {
  const { rows } = await query(
    `SELECT v.id, v.nome, v.prezzo::float AS prezzo, v.apertura, v.chiusura, v.immagine,
            v.indirizzo, v.lat::float AS lat, v.lng::float AS lng, v.rating,
            s.slug AS sport_slug, s.nome AS sport_nome, s.max_partecipanti
     FROM venues v
     JOIN sports s ON s.id = v.sport_id
     WHERE s.slug = $1
     ORDER BY v.ordine, v.id`,
    [slug]
  );
  return rows;
}

async function campoPerId(id) {
  const { rows } = await query(
    `SELECT v.id, v.nome, v.prezzo::float AS prezzo, v.apertura, v.chiusura, v.immagine,
            v.indirizzo, v.lat::float AS lat, v.lng::float AS lng, v.rating,
            s.slug AS sport_slug, s.nome AS sport_nome, s.max_partecipanti
     FROM venues v
     JOIN sports s ON s.id = v.sport_id
     WHERE v.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function cercaCampi(testo) {
  const { rows } = await query(
    `SELECT v.id, v.nome, v.prezzo::float AS prezzo, v.immagine, s.slug AS sport_slug, s.nome AS sport_nome
     FROM venues v JOIN sports s ON s.id = v.sport_id
     WHERE v.nome ILIKE '%' || $1 || '%' OR s.nome ILIKE '%' || $1 || '%'
     ORDER BY s.ordine, v.id`,
    [testo]
  );
  return rows;
}

async function contaCampi() {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM venues');
  return rows[0].n;
}

/* --- funzioni usate solo dal pannello di controllo --- */

/**
 * Tutti i campi, con lo sport e quante prenotazioni hanno: il conteggio serve
 * ad avvisare prima di cancellarne uno (le prenotazioni se ne andrebbero con
 * lui, per via del vincolo ON DELETE CASCADE).
 */
async function tuttiCampi() {
  const { rows } = await query(
    `SELECT v.id, v.nome, v.prezzo::float AS prezzo, v.apertura, v.chiusura, v.immagine,
            v.indirizzo, v.lat::float AS lat, v.lng::float AS lng, v.rating, v.ordine,
            s.nome AS sport_nome, s.slug AS sport_slug,
            (SELECT COUNT(*)::int FROM bookings b WHERE b.venue_id = v.id) AS prenotazioni
     FROM venues v JOIN sports s ON s.id = v.sport_id
     ORDER BY s.ordine, s.id, v.ordine, v.id`
  );
  return rows;
}

/**
 * Aggiunge un campo. I dati arrivano gia' controllati dal controller: qui si
 * scrive e basta. Restituisce null se lo stesso sport ha gia' un campo con
 * quel nome (vincolo UNIQUE (sport_id, nome)).
 */
async function creaCampo(dati) {
  const { rows } = await query(
    `INSERT INTO venues (sport_id, nome, prezzo, apertura, chiusura, immagine,
                         indirizzo, lat, lng, rating, ordine)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (sport_id, nome) DO NOTHING
     RETURNING id`,
    [dati.sport_id, dati.nome, dati.prezzo, dati.apertura, dati.chiusura, dati.immagine,
     dati.indirizzo, dati.lat, dati.lng, dati.rating, dati.ordine]
  );
  return rows[0] ? campoPerId(rows[0].id) : null;
}

/** Cancella un campo (e, a cascata, le sue prenotazioni). */
async function eliminaCampo(id) {
  const { rowCount } = await query('DELETE FROM venues WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  elencoSport, sportPerSlug, campiPerSport, campoPerId, cercaCampi, contaCampi,
  tuttiCampi, creaCampo, eliminaCampo,
};
