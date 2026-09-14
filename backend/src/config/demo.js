/**
 * ACCOUNT DEMO ("utenteprova@gmail.com").
 *
 * E' l'account che si apre dalla schermata di accesso con il bottone
 * "Entra con l'account DEMO". E' un account "a perdere":
 *   - non ha password: si entra dal bottone dedicato (o scrivendo solo la
 *     sua email), mai digitando una chiave;
 *   - non puo' essere eliminato (vedi socialController.eliminaProfilo e il
 *     pannello di controllo);
 *   - a ogni uscita torna allo stato iniziale (ripristina()).
 *
 * Qui stanno sia i dati di partenza sia la procedura di ripristino, cosi'
 * definizione e reset non possono divergere. Il modulo dipende solo da db.js
 * e hash.js: lo possono usare i Model, i Controller e la migrazione.
 */
const crypto = require('crypto');
const { pool, query } = require('./db');
const { hashPassword } = require('./hash');

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'utenteprova@gmail.com';

/**
 * L'account DEMO non ha una password.
 * La colonna users.password_hash e' NOT NULL, quindi ci finisce comunque un
 * hash: e' pero' l'hash di un valore casuale che non conosce nessuno, cosi'
 * nessuna password puo' funzionare e l'unico accesso resta quello diretto.
 */
function hashSenzaPassword() {
  return hashPassword(crypto.randomBytes(24).toString('hex'));
}

/** Profilo di partenza dell'account DEMO. */
const PROFILO = {
  // nome generico: l'account non e' di nessuno in particolare
  nome: 'Utente',
  avatar: '/img/avatar-lorenzo.jpg',
  sport: 'Calcetto, Basket, Tennis, Padel',
  data_nascita: '2000-01-01',
  comune: 'Camerino (MC)',
  bio: 'Non so scegliere uno sport quindi li faccio tutti: Tennis, basket, calcetto, padel. Cerco compagni per qualsiasi disciplina',
};

/** Amicizie di partenza (valgono in entrambe le direzioni). */
const AMICI = ['mariorossi@gmail.com', 'francototti@gmail.com', 'andreaarrigo@gmail.com'];

// "minuti" sono i minuti nel passato: distribuiscono le notifiche fra "Oggi",
// "Ultimi 7 giorni" e "Precedenti". "dove" indica la schermata che si apre
// toccando la notifica ('utente', 'chat' oppure 'prenotazioni').
const NOTIFICHE = [
  { titolo: 'Mario Rossi', testo: 'Ha iniziato a seguirti', avatar: '/img/avatar-mario.jpg', tipo: 'social', minuti: 25, da: 'mariorossi@gmail.com', dove: 'utente' },
  { titolo: 'Mario Rossi', testo: 'Ha accettato la tua richiesta', avatar: '/img/avatar-mario.jpg', tipo: 'social', minuti: 240, da: 'mariorossi@gmail.com', dove: 'utente' },
  { titolo: 'Prenotazione', testo: 'La tua prenotazione è stata confermata', avatar: '', tipo: 'prenotazione', minuti: 1500, dove: 'prenotazioni' },
  { titolo: 'Andrea Arrigo', testo: 'Ha accettato la tua richiesta', avatar: '/img/avatar-andrea.jpg', tipo: 'social', minuti: 4320, da: 'andreaarrigo@gmail.com', dove: 'utente' },
  { titolo: 'Andrea Arrigo', testo: 'Ha iniziato a seguirti', avatar: '/img/avatar-andrea.jpg', tipo: 'social', minuti: 17280, da: 'andreaarrigo@gmail.com', dove: 'utente' },
];

// Chat di esempio: [email mittente, minuti nel passato, testo]
const CHAT_DIRETTE = {
  'mariorossi@gmail.com': [
    ['mariorossi@gmail.com', 2880, 'Ciao! Ho visto che giochi a tennis, ti va una partita?'],
    [DEMO_EMAIL, 2820, 'Volentieri, io sono libero giovedì sera'],
    ['mariorossi@gmail.com', 2760, 'Perfetto, prenoto io il campo Torresi alle 21'],
    [DEMO_EMAIL, 120, 'Confermato, ci vediamo lì'],
  ],
  'francototti@gmail.com': [
    ['francototti@gmail.com', 1440, 'Domenica organizziamo un calcetto, ci sei?'],
    [DEMO_EMAIL, 1380, 'Ci sono, a che ora?'],
    ['francototti@gmail.com', 1320, 'Alle 18 a Collevario, siamo già in otto'],
  ],
  'andreaarrigo@gmail.com': [
    [DEMO_EMAIL, 600, 'Stasera basket a Corneto?'],
    ['andreaarrigo@gmail.com', 540, 'Sì dai, porto io il pallone'],
  ],
};

const CHAT_GRUPPI = {
  Calcetto: [
    ['giacomo@gmail.com', 900, 'Ragazzi manca ancora uno per sabato'],
    ['tommaso@gmail.com', 840, 'Io ci sono, segnatemi'],
    [DEMO_EMAIL, 300, 'Allora siamo al completo, prenoto il campo'],
  ],
  Basket: [
    ['andreaverdi@gmail.com', 2000, 'Campo Corneto libero domani alle 19'],
    ['andreaarrigo@gmail.com', 1900, 'Perfetto, ci sono'],
  ],
  'Amici Stretti': [
    [DEMO_EMAIL, 60, 'Chi viene a vedere la partita stasera?'],
  ],
};

/** true se l'email indicata e' quella dell'account DEMO. */
function eDemo(email) {
  return String(email || '').toLowerCase().trim() === DEMO_EMAIL.toLowerCase();
}

/** Momento nel passato, espresso in minuti, come timestamp SQL. */
function minutiFa(minuti) {
  return new Date(Date.now() - minuti * 60000).toISOString();
}

async function idDi(esegui, email) {
  const { rows } = await esegui('SELECT id FROM users WHERE email = $1', [email]);
  return rows[0] ? rows[0].id : null;
}

/**
 * Cancella tutto cio' che l'account DEMO ha prodotto: post,
 * prenotazioni (proprie e altrui a cui si e' aggiunto), amicizie, gruppi,
 * swipe, messaggi e notifiche. Vengono tolte anche le notifiche che le sue
 * azioni hanno lasciato agli altri utenti, cosi' non restano riferimenti
 * a una sessione che non esiste piu'.
 */
async function svuotaDatiDemo(esegui, me) {
  const proprie = [
    'DELETE FROM payment_methods      WHERE user_id = $1',
    'DELETE FROM posts                WHERE user_id = $1',
    'DELETE FROM bookings             WHERE user_id = $1',
    'DELETE FROM booking_participants WHERE user_id = $1',
    'DELETE FROM friendships          WHERE user_id = $1 OR friend_id = $1',
    'DELETE FROM group_members        WHERE user_id = $1',
    'DELETE FROM swipes               WHERE user_id = $1 OR target_id = $1',
    'DELETE FROM messages             WHERE mittente_id = $1 OR destinatario_id = $1',
    'DELETE FROM notifications        WHERE user_id = $1',
  ];
  for (const sql of proprie) await esegui(sql, [me]);

  // le notifiche che le azioni dell'account demo hanno lasciato agli altri:
  // si riconoscono dall'autore (o, per quelle piu' vecchie, dal collegamento)
  await esegui(
    `DELETE FROM notifications
     WHERE user_id <> $1
       AND (autore_id = $1 OR link IN ('/utente/' || $1, '/chat/utente/' || $1))`,
    [me]
  );
}

/** Rimette al loro posto amicizie, gruppi, notifiche e chat di partenza. */
async function ripopolaDatiDemo(esegui, me) {
  for (const email of AMICI) {
    const amico = await idDi(esegui, email);
    if (!amico) continue;
    // l'amicizia vale in entrambe le direzioni: cosi' la chat e' aperta da tutti e due
    for (const coppia of [[me, amico], [amico, me]]) {
      await esegui(
        `INSERT INTO friendships (user_id, friend_id, stato) VALUES ($1,$2,'accettata')
         ON CONFLICT DO NOTHING`,
        coppia
      );
    }
  }

  // solo i gruppi di esempio (quelli senza creatore): i gruppi creati dagli
  // utenti non devono comparire nell'account DEMO
  await esegui(
    `INSERT INTO group_members (group_id, user_id)
     SELECT g.id, $1 FROM groups g WHERE g.creatore_id IS NULL ON CONFLICT DO NOTHING`,
    [me]
  );

  for (const n of NOTIFICHE) {
    let link = '';
    let autore = null;
    if (n.dove === 'prenotazioni') {
      link = '/prenotazioni';
    } else if (n.da) {
      autore = await idDi(esegui, n.da);
      if (autore) link = n.dove === 'chat' ? `/chat/utente/${autore}` : `/utente/${autore}`;
    }
    await esegui(
      `INSERT INTO notifications (user_id, titolo, testo, avatar, tipo, link, autore_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [me, n.titolo, n.testo, n.avatar, n.tipo, link, autore, minutiFa(n.minuti)]
    );
  }

  for (const [emailAmico, righe] of Object.entries(CHAT_DIRETTE)) {
    const amico = await idDi(esegui, emailAmico);
    if (!amico) continue;
    for (const [emailMittente, minuti, testo] of righe) {
      const mittente = eDemo(emailMittente) ? me : await idDi(esegui, emailMittente);
      if (!mittente) continue;
      const destinatario = mittente === me ? amico : me;
      await esegui(
        'INSERT INTO messages (mittente_id, destinatario_id, testo, created_at) VALUES ($1,$2,$3,$4)',
        [mittente, destinatario, testo, minutiFa(minuti)]
      );
    }
  }

  // nelle chat di gruppo si rimettono solo i messaggi dell'account
  // dimostrativo: quelli degli altri utenti non vengono toccati
  for (const [nomeGruppo, righe] of Object.entries(CHAT_GRUPPI)) {
    const { rows } = await esegui('SELECT id FROM groups WHERE nome = $1', [nomeGruppo]);
    if (!rows[0]) continue;
    for (const [emailMittente, minuti, testo] of righe) {
      if (!eDemo(emailMittente)) continue;
      await esegui(
        'INSERT INTO messages (mittente_id, group_id, testo, created_at) VALUES ($1,$2,$3,$4)',
        [me, rows[0].id, testo, minutiFa(minuti)]
      );
    }
  }
}

/**
 * Riporta l'account DEMO allo stato iniziale (e lo ricrea se non
 * esiste piu'). Tutto in un'unica transazione: se qualcosa va storto il
 * database resta com'era, senza account a meta'.
 * Restituisce l'id dell'account.
 */
async function ripristina() {
  const client = await pool.connect();
  const esegui = (testo, parametri) => client.query(testo, parametri);
  try {
    await client.query('BEGIN');

    const hash = await hashSenzaPassword();
    const { rows } = await esegui(
      `INSERT INTO users (nome, email, password_hash, bio, data_nascita, comune, sport, eta, avatar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,$8)
       ON CONFLICT (email) DO UPDATE SET
         nome = EXCLUDED.nome, password_hash = EXCLUDED.password_hash, bio = EXCLUDED.bio,
         data_nascita = EXCLUDED.data_nascita, comune = EXCLUDED.comune,
         sport = EXCLUDED.sport, eta = NULL, avatar = EXCLUDED.avatar,
         saldo = 0
       RETURNING id`,
      [PROFILO.nome, DEMO_EMAIL, hash, PROFILO.bio, PROFILO.data_nascita,
       PROFILO.comune, PROFILO.sport, PROFILO.avatar]
    );
    const me = rows[0].id;

    await svuotaDatiDemo(esegui, me);
    await ripopolaDatiDemo(esegui, me);

    await client.query('COMMIT');
    return me;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Ripristina l'account DEMO solo se non esiste piu'. */
async function ripristinaSeMancante() {
  const { rows } = await query('SELECT 1 FROM users WHERE email = $1', [DEMO_EMAIL]);
  if (rows.length > 0) return false;
  await ripristina();
  return true;
}

module.exports = {
  DEMO_EMAIL,
  hashSenzaPassword,
  PROFILO,
  NOTIFICHE,
  CHAT_DIRETTE,
  CHAT_GRUPPI,
  eDemo,
  ripristina,
  ripristinaSeMancante,
};
