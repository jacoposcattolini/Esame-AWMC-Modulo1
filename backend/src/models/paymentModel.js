/**
 * MODEL - Metodi di pagamento dell'utente.
 *
 * Del numero della carta si conservano SOLO le ultime quattro cifre: il numero
 * completo non arriva mai al server (lo si vede solo nel form del browser) e
 * quindi non e' salvato da nessuna parte. Non essendoci un gateway di
 * pagamento vero, questi dati servono a riconoscere la carta, non a incassare.
 */
const { query } = require('../config/db');

const CAMPI = `id, circuito, intestatario, ultime4, scadenza_mese, scadenza_anno,
  predefinito, created_at`;

async function elenco(userId) {
  const { rows } = await query(
    `SELECT ${CAMPI} FROM payment_methods WHERE user_id = $1
     ORDER BY predefinito DESC, created_at DESC`,
    [userId]
  );
  return rows;
}

async function perId(id, userId) {
  const { rows } = await query(
    `SELECT ${CAMPI} FROM payment_methods WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}

async function conta(userId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS n FROM payment_methods WHERE user_id = $1',
    [userId]
  );
  return rows[0].n;
}

/** Lascia una sola carta predefinita per utente. */
async function soloUnPredefinito(userId, id) {
  await query(
    'UPDATE payment_methods SET predefinito = (id = $2) WHERE user_id = $1',
    [userId, id]
  );
}

async function crea(userId, dati) {
  // la prima carta salvata diventa automaticamente quella predefinita
  const prima = (await conta(userId)) === 0;
  const { rows } = await query(
    `INSERT INTO payment_methods
       (user_id, circuito, intestatario, ultime4, scadenza_mese, scadenza_anno, predefinito)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING ${CAMPI}`,
    [userId, dati.circuito, dati.intestatario, dati.ultime4,
     dati.scadenza_mese, dati.scadenza_anno, prima || !!dati.predefinito]
  );
  const carta = rows[0];
  if (carta.predefinito) await soloUnPredefinito(userId, carta.id);
  return perId(carta.id, userId);
}

/** Aggiorna i campi passati; quelli assenti restano com'erano. */
async function aggiorna(id, userId, dati) {
  const consentiti = ['circuito', 'intestatario', 'ultime4', 'scadenza_mese', 'scadenza_anno'];
  const set = [];
  const valori = [];
  for (const campo of consentiti) {
    if (dati[campo] !== undefined) {
      valori.push(dati[campo]);
      set.push(`${campo} = $${valori.length}`);
    }
  }

  if (set.length > 0) {
    valori.push(id, userId);
    const { rowCount } = await query(
      `UPDATE payment_methods SET ${set.join(', ')}
       WHERE id = $${valori.length - 1} AND user_id = $${valori.length}`,
      valori
    );
    if (rowCount === 0) return null;
  }

  // il predefinito si gestisce a parte: cambiarlo tocca anche le altre carte
  if (dati.predefinito === true) {
    const mia = await perId(id, userId);
    if (!mia) return null;
    await soloUnPredefinito(userId, id);
  }

  return perId(id, userId);
}

/**
 * Cancella una carta. Se era la predefinita, il ruolo passa alla piu' recente
 * fra quelle rimaste, cosi' l'utente ne ha sempre una pronta.
 */
async function elimina(id, userId) {
  const { rows } = await query(
    'DELETE FROM payment_methods WHERE id = $1 AND user_id = $2 RETURNING predefinito',
    [id, userId]
  );
  if (rows.length === 0) return false;

  if (rows[0].predefinito) {
    await query(
      `UPDATE payment_methods SET predefinito = true
       WHERE id = (SELECT id FROM payment_methods WHERE user_id = $1
                   ORDER BY created_at DESC LIMIT 1)`,
      [userId]
    );
  }
  return true;
}

module.exports = { elenco, perId, crea, aggiorna, elimina, conta };
