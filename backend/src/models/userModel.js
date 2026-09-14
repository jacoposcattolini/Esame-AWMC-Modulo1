/**
 * MODEL - Utenti. Qui stanno tutte le query sulla tabella users: i controller
 * non scrivono SQL.
 */
const { query } = require('../config/db');
const { DEMO_EMAIL } = require('../config/demo');

// l'email dell'account DEMO come letterale SQL (e' una costante
// dell'applicazione, non un dato in arrivo dal client)
const EMAIL_DEMO = `'${String(DEMO_EMAIL).replace(/'/g, "''")}'`;

// campi restituiti al client: mai la password_hash.
// L'eta' non viene piu' chiesta all'utente: si calcola dalla data di nascita
// (la colonna eta resta come ripiego per i profili senza data).
// "demo" segnala l'account DEMO: non e' eliminabile e si azzera all'uscita.
const CAMPI_PUBBLICI = `id, nome, email, bio, data_nascita, comune, sport,
  COALESCE(EXTRACT(YEAR FROM age(data_nascita))::int, eta) AS eta,
  avatar, saldo::float AS saldo, created_at, (email = ${EMAIL_DEMO}) AS demo`;

/** Anni compiuti alla data odierna, oppure null se la data non e' valida. */
function calcolaEta(dataNascita) {
  if (!dataNascita) return null;
  const nascita = new Date(dataNascita);
  if (Number.isNaN(nascita.getTime())) return null;
  const oggi = new Date();
  let anni = oggi.getFullYear() - nascita.getFullYear();
  const compleannoPassato =
    oggi.getMonth() > nascita.getMonth() ||
    (oggi.getMonth() === nascita.getMonth() && oggi.getDate() >= nascita.getDate());
  if (!compleannoPassato) anni -= 1;
  return anni >= 0 && anni < 120 ? anni : null;
}

async function creaUtente({ nome, email, passwordHash, bio = '', avatar = '/img/avatar-lorenzo.jpg' }) {
  const { rows } = await query(
    `INSERT INTO users (nome, email, password_hash, bio, avatar)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${CAMPI_PUBBLICI}`,
    [nome, email.toLowerCase().trim(), passwordHash, bio, avatar]
  );
  return rows[0];
}

/** Include la password_hash: da usare SOLO nel login. */
async function trovaPerEmailConHash(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  return rows[0] || null;
}

async function trovaPerId(id) {
  const { rows } = await query(`SELECT ${CAMPI_PUBBLICI} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function esisteEmail(email) {
  const { rows } = await query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  return rows.length > 0;
}

async function elenco({ escludiId = null, cerca = '' } = {}) {
  const { rows } = await query(
    `SELECT ${CAMPI_PUBBLICI} FROM users
     WHERE ($1::int IS NULL OR id <> $1)
       AND ($2 = '' OR nome ILIKE '%' || $2 || '%')
     ORDER BY nome`,
    [escludiId, cerca]
  );
  return rows;
}

async function aggiorna(id, dati) {
  // 'eta' non e' modificabile direttamente: viene ricalcolata dalla data di nascita
  const consentiti = ['nome', 'bio', 'data_nascita', 'comune', 'sport', 'avatar'];
  const set = [];
  const valori = [];
  for (const campo of consentiti) {
    if (dati[campo] !== undefined) {
      valori.push(dati[campo] === '' && campo === 'data_nascita' ? null : dati[campo]);
      set.push(`${campo} = $${valori.length}`);
    }
  }
  if (dati.data_nascita !== undefined) {
    valori.push(calcolaEta(dati.data_nascita));
    set.push(`eta = $${valori.length}`);
  }
  if (set.length === 0) return trovaPerId(id);
  valori.push(id);
  const { rows } = await query(
    `UPDATE users SET ${set.join(', ')} WHERE id = $${valori.length} RETURNING ${CAMPI_PUBBLICI}`,
    valori
  );
  return rows[0] || null;
}

/** Cancella l'account: le FK ON DELETE CASCADE ripuliscono tutto il resto. */
async function elimina(id) {
  const { rowCount } = await query('DELETE FROM users WHERE id = $1', [id]);
  return rowCount > 0;
}

async function conta() {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM users');
  return rows[0].n;
}

/* ----------------------------- saldo SportEasy ----------------------------- */

/** Somma un importo al saldo (positivo accredita, negativo addebita). */
async function muoviSaldo(id, importo, esegui = query) {
  if (!importo) return null;
  const { rows } = await esegui(
    'UPDATE users SET saldo = saldo + $1 WHERE id = $2 RETURNING saldo::float AS saldo',
    [importo, id]
  );
  return rows[0] ? rows[0].saldo : null;
}

async function saldoDi(id, esegui = query) {
  const { rows } = await esegui('SELECT saldo::float AS saldo FROM users WHERE id = $1', [id]);
  return rows[0] ? rows[0].saldo : 0;
}

module.exports = {
  creaUtente,
  trovaPerEmailConHash,
  trovaPerId,
  esisteEmail,
  elenco,
  aggiorna,
  elimina,
  conta,
  muoviSaldo,
  saldoDi,
};
