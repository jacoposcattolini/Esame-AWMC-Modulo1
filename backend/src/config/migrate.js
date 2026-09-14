/**
 * Migrazione + popolamento del database.
 * - esegue db/init/01_schema.sql e db/init/02_seed.sql (idempotenti)
 * - crea gli utenti demo con password cifrate con bcrypt
 * - popola post, amicizie, gruppi, notifiche e chat di esempio (dal design Figma)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, waitForDatabase, pool } = require('./db');
const { hashPassword } = require('./hash');
// definizione e ripristino dell'account DEMO stanno in un modulo a parte
const demo = require('./demo');

const SQL_DIR = process.env.SQL_DIR || path.join(__dirname, '..', '..', '..', 'db', 'init');

// Account dimostrativo dell'app (quello mostrato nella schermata di accesso)
const { DEMO_EMAIL } = demo;
const PASSWORD_UTENTI = 'password';

const UTENTI = [
  // senzaPassword: l'account DEMO si apre dal bottone dedicato, non con una chiave
  { ...demo.PROFILO, email: DEMO_EMAIL, senzaPassword: true },
  {
    nome: 'Mario Rossi', email: 'mariorossi@gmail.com', avatar: '/img/avatar-mario.jpg',
    eta: 22, sport: 'Tennis', data_nascita: '2003-04-12', comune: 'Macerata (MC)',
    bio: 'Cerco compagni di gioco per sudare e ridere. Disponibile la sera e nel weekend',
  },
  {
    nome: 'Franco Totti', email: 'francototti@gmail.com', avatar: '/img/avatar-franco.jpg',
    eta: 27, sport: 'Calcetto', data_nascita: '1998-09-27', comune: 'Macerata (MC)',
    bio: 'Amo le partite tra amici. Cerco compagni per divertirmi',
  },
  {
    nome: 'Andrea Arrigo', email: 'andreaarrigo@gmail.com', avatar: '/img/avatar-andrea.jpg',
    eta: 24, sport: 'Basket', data_nascita: '2001-06-03', comune: 'Macerata (MC)',
    bio: 'Cerco compagni per divertirmi, sudare e provare a fare almeno una schiacciata',
  },
  {
    nome: 'Giacomo Bianchi', email: 'giacomo@gmail.com', avatar: '/img/avatar-giacomo.jpg',
    eta: 23, sport: 'Calcetto', data_nascita: '2002-02-18', comune: 'Macerata (MC)',
    bio: 'Sempre pronto per una partita di calcetto',
  },
  {
    nome: 'Andrea Verdi', email: 'andreaverdi@gmail.com', avatar: '/img/avatar-andrea2.jpg',
    eta: 26, sport: 'Basket', data_nascita: '1999-11-02', comune: 'Macerata (MC)',
    bio: 'Basket a Corneto quasi ogni sera',
  },
  {
    nome: 'Alessandro Neri', email: 'alessandro@gmail.com', avatar: '/img/avatar-alessandro.jpg',
    eta: 28, sport: 'Padel', data_nascita: '1997-05-21', comune: 'Macerata (MC)',
    bio: 'Padel di buon livello, cerco partite combattute',
  },
  {
    nome: 'Tommaso Ricci', email: 'tommaso@gmail.com', avatar: '/img/avatar-tommaso.jpg',
    eta: 21, sport: 'Calciotto', data_nascita: '2004-03-30', comune: 'Macerata (MC)',
    bio: 'Organizzo calciotto a Collevario ogni settimana',
  },
  {
    nome: 'Jacopo Scattolini', email: 'jacoposcattolini@gmail.com', avatar: '/img/avatar-jacopo.jpg',
    eta: 22, sport: 'Calcetto', data_nascita: '2003-07-09', comune: 'Macerata (MC)',
    bio: 'Neofita ma con tanta voglia di divertirsi',
  },
];

// Ogni post puo' avere una prenotazione allegata: e' l'informazione in piu'
// che permette agli altri di aggiungersi con un tocco dal feed.
// La data non e' scritta qui: viene sorteggiata da dataCasualeDeiPost().
const POST = [
  {
    email: 'giacomo@gmail.com',
    testo: 'Ciao a tutti, cerco due persone per un calcetto alle 14 allo stadio Helvia Recina. Non è importante il livello di gioco ma che ci si voglia divertire.',
    prenotazione: { sport: 'calcetto', campo: 'Campo Helvia Recina', ora: '14.00', posti: 10 },
  },
  {
    email: 'andreaverdi@gmail.com',
    testo: 'Sto cercando l’ultimo per una partita a basket a Corneto. Qualcuno di buon livello disponibile?',
    prenotazione: { sport: 'basket', campo: 'Campo Corneto', ora: '19.00', posti: 10 },
  },
  {
    email: 'alessandro@gmail.com',
    testo: 'Ciao, ci servirebbe un duo per una partita di padel ai campi Torresi. Ci riteniamo di buon livello e vorremmo una partita combattuta.',
    prenotazione: { sport: 'padel', campo: 'Campo Torresi', ora: '21.00', posti: 4 },
  },
  {
    email: 'tommaso@gmail.com',
    testo: 'Cerco 4 persone per un calciotto a Collevario alle 18.00. Se tra di voi c’è anche un portiere molto meglio.',
    prenotazione: { sport: 'calciotto', campo: 'Campo Collevario', ora: '18.00', posti: 16 },
  },
  {
    email: 'jacoposcattolini@gmail.com',
    testo: 'Ciao a tutti, cerco il decimo per un calcetto alle 20 allo stadio Helvia Recina. Siamo tutti neofiti ma vogliamo divertirci un po’.',
    prenotazione: { sport: 'calcetto', campo: 'Campo Helvia Recina', ora: '20.00', posti: 10 },
  },
];

// notifiche e chat di esempio dell'account DEMO: la definizione sta
// nel modulo demo, cosi' il seed iniziale e il ripristino usano gli stessi dati
const { NOTIFICHE, CHAT_DIRETTE, CHAT_GRUPPI } = demo;

async function runSqlFile(file) {
  const full = path.join(SQL_DIR, file);
  if (!fs.existsSync(full)) {
    console.warn('[migrate] file SQL non trovato: ' + full);
    return;
  }
  await query(fs.readFileSync(full, 'utf8'));
  console.log('[migrate] eseguito ' + file);
}

async function seedUtenti() {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n > 0) {
    console.log('[migrate] utenti già presenti (' + rows[0].n + '), seed saltato');
    return false;
  }
  for (const u of UTENTI) {
    const hash = u.senzaPassword
      ? await demo.hashSenzaPassword()
      : await hashPassword(u.password || PASSWORD_UTENTI);
    await query(
      `INSERT INTO users (nome, email, password_hash, bio, data_nascita, comune, sport, eta, avatar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (email) DO NOTHING`,
      [u.nome, u.email, hash, u.bio, u.data_nascita, u.comune, u.sport, u.eta, u.avatar]
    );
  }
  console.log(
    '[migrate] creati ' + UTENTI.length + ' utenti demo' +
    ' (account DEMO: ' + DEMO_EMAIL + ' senza password, gli altri: "' + PASSWORD_UTENTI + '")'
  );
  return true;
}

async function idDi(email) {
  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
  return rows[0] && rows[0].id;
}

/** Schermata da aprire toccando una notifica di esempio. */
async function linkNotifica(n) {
  if (n.dove === 'prenotazioni') return '/prenotazioni';
  const id = n.da ? await idDi(n.da) : null;
  if (!id) return '';
  return n.dove === 'chat' ? `/chat/utente/${id}` : `/utente/${id}`;
}

/** Momento nel passato, espresso in minuti, come timestamp SQL. */
function minutiFa(minuti) {
  return new Date(Date.now() - minuti * 60000).toISOString();
}

/**
 * Gli orari dei post sono casuali (ognuno in un momento diverso degli ultimi
 * giorni): l'elenco resta comunque ordinato, perche' le query ordinano sempre
 * per created_at decrescente.
 */
function orariCasualiPost(quantita) {
  const minuti = [];
  while (minuti.length < quantita) {
    const m = 20 + Math.floor(Math.random() * 6 * 24 * 60); // da 20 min a ~6 giorni fa
    if (!minuti.includes(m)) minuti.push(m);
  }
  return minuti;
}

/**
 * Le prenotazioni allegate ai post di esempio cadono in una data casuale
 * DOPO il 15 settembre 2026: ogni post di esempio ha cosi' un giorno diverso,
 * e restano tutte in avanti nel tempo (una partita gia' passata non si puo'
 * piu' prenotare).
 */
const PRIMO_GIORNO_UTILE = '2026-09-16';
const ULTIMO_GIORNO_ESCLUSO = '2026-09-15'; // le date fino a qui vanno spostate
const GIORNI_DI_SCELTA = 45; // dal 16 settembre a fine ottobre

function dataCasualeDeiPost() {
  const inizio = new Date(`${PRIMO_GIORNO_UTILE}T12:00:00Z`);
  inizio.setUTCDate(inizio.getUTCDate() + Math.floor(Math.random() * GIORNI_DI_SCELTA));
  return inizio.toISOString().slice(0, 10);
}

/**
 * Crea la prenotazione allegata a un post di esempio e ne restituisce l'id
 * (null se il campo non esiste).
 */
async function creaPrenotazioneDiEsempio(userId, p) {
  const { rows } = await query(
    `SELECT v.id, v.prezzo FROM venues v JOIN sports s ON s.id = v.sport_id
     WHERE s.slug = $1 AND v.nome = $2 LIMIT 1`,
    [p.sport, p.campo]
  );
  if (!rows[0]) return null;

  const { rows: creata } = await query(
    `INSERT INTO bookings (user_id, venue_id, data, ora, partecipanti, totale, stato)
     VALUES ($1,$2,$3,$4,$5,$6,'confermata') RETURNING id`,
    [userId, rows[0].id, dataCasualeDeiPost(), p.ora, p.posti, Number(rows[0].prezzo) * p.posti]
  );
  return creata[0].id;
}

async function seedContenuti() {
  const me = await idDi(DEMO_EMAIL);
  if (!me) return;

  const minutiPost = orariCasualiPost(POST.length);
  for (let i = 0; i < POST.length; i++) {
    const { email, testo, prenotazione } = POST[i];
    const uid = await idDi(email);
    if (uid) {
      const bookingId = prenotazione ? await creaPrenotazioneDiEsempio(uid, prenotazione) : null;
      await query(
        'INSERT INTO posts (user_id, contenuto, booking_id, created_at) VALUES ($1,$2,$3,$4)',
        [uid, testo, bookingId, minutiFa(minutiPost[i])]
      );
    }
  }

  for (const email of ['mariorossi@gmail.com', 'francototti@gmail.com', 'andreaarrigo@gmail.com']) {
    const uid = await idDi(email);
    if (uid) {
      await query(
        `INSERT INTO friendships (user_id, friend_id, stato) VALUES ($1,$2,'accettata')
         ON CONFLICT DO NOTHING`,
        [me, uid]
      );
      // l'amicizia vale in entrambe le direzioni: cosi' la chat e' aperta da tutti e due
      await query(
        `INSERT INTO friendships (user_id, friend_id, stato) VALUES ($1,$2,'accettata')
         ON CONFLICT DO NOTHING`,
        [uid, me]
      );
    }
  }

  const { rows: gruppi } = await query('SELECT id FROM groups');
  const { rows: utenti } = await query('SELECT id FROM users ORDER BY id LIMIT 5');
  for (const g of gruppi) {
    for (const u of utenti) {
      await query('INSERT INTO group_members (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [g.id, u.id]);
    }
  }

  for (const n of NOTIFICHE) {
    await query(
      `INSERT INTO notifications (user_id, titolo, testo, avatar, tipo, link, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [me, n.titolo, n.testo, n.avatar, n.tipo, await linkNotifica(n), minutiFa(n.minuti)]
    );
  }
  console.log('[migrate] popolati post, amicizie, gruppi e notifiche di esempio');
}

/** Conversazioni di esempio, cosi' le chat non partono vuote. */
async function seedMessaggi() {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM messages');
  if (rows[0].n > 0) return;

  for (const [emailAmico, righe] of Object.entries(CHAT_DIRETTE)) {
    const amico = await idDi(emailAmico);
    if (!amico) continue;
    for (const [emailMittente, minuti, testo] of righe) {
      const mittente = await idDi(emailMittente);
      const destinatario = mittente === amico ? await idDi(DEMO_EMAIL) : amico;
      if (!mittente || !destinatario) continue;
      await query(
        'INSERT INTO messages (mittente_id, destinatario_id, testo, created_at) VALUES ($1,$2,$3,$4)',
        [mittente, destinatario, testo, minutiFa(minuti)]
      );
    }
  }

  for (const [nomeGruppo, righe] of Object.entries(CHAT_GRUPPI)) {
    const { rows: g } = await query('SELECT id FROM groups WHERE nome = $1', [nomeGruppo]);
    if (!g[0]) continue;
    for (const [emailMittente, minuti, testo] of righe) {
      const mittente = await idDi(emailMittente);
      if (!mittente) continue;
      await query(
        'INSERT INTO messages (mittente_id, group_id, testo, created_at) VALUES ($1,$2,$3,$4)',
        [mittente, g[0].id, testo, minutiFa(minuti)]
      );
    }
  }
  console.log('[migrate] popolate le chat di esempio');
}

/**
 * L'account DEMO dev'esserci sempre.
 * - database creati prima di questa versione: si converte il vecchio account
 *   (lorenzomozzoni@gmail.com, poi "admin", poi "provautente") a questa email,
 *   mantenendone i contenuti e togliendogli la password;
 * - se l'account e' stato cancellato, viene ricreato dal modulo demo insieme
 *   ad amicizie, gruppi, notifiche e chat di partenza.
 */
async function assicuraAccountDimostrativo() {
  const { rows } = await query('SELECT id FROM users WHERE email = $1', [DEMO_EMAIL]);
  if (rows.length > 0) return;

  // i nomi che l'account DEMO ha avuto nelle versioni precedenti
  let vecchio = null;
  for (const email of ['provautente', 'admin', 'lorenzomozzoni@gmail.com']) {
    vecchio = await idDi(email);
    if (vecchio) break;
  }

  if (vecchio) {
    const hash = await demo.hashSenzaPassword();
    await query(
      'UPDATE users SET email = $1, nome = $2, password_hash = $3 WHERE id = $4',
      [DEMO_EMAIL, demo.PROFILO.nome, hash, vecchio]
    );
    console.log('[migrate] account DEMO rinominato in ' + DEMO_EMAIL + ' (senza password)');
    return;
  }

  if (await demo.ripristinaSeMancante()) {
    console.log('[migrate] account DEMO ricreato: ' + DEMO_EMAIL + ' (senza password)');
  }
}

/**
 * Pulizia una tantum: "uu" era un gruppo creato per provare la creazione dei
 * gruppi e non deve restare fra i dati dimostrativi. Con lui se ne vanno
 * membri e messaggi (ON DELETE CASCADE).
 */
async function rimuoviGruppiDiProva() {
  const { rowCount } = await query("DELETE FROM groups WHERE lower(nome) = 'uu'");
  if (rowCount > 0) console.log('[migrate] rimosso il gruppo di prova "uu"');
}

/**
 * Database preesistenti: l'account DEMO si chiamava "Prova Utente".
 * Ora il nome mostrato e' quello generico definito in config/demo.js, cosi'
 * nessuna schermata parla piu' di "Prova".
 */
async function assicuraNomeAccountDimostrativo() {
  const { rowCount } = await query(
    'UPDATE users SET nome = $1 WHERE email = $2 AND nome <> $1',
    [demo.PROFILO.nome, DEMO_EMAIL]
  );
  if (rowCount > 0) console.log('[migrate] account DEMO rinominato in "' + demo.PROFILO.nome + '"');
}

/**
 * Sempre per i database preesistenti: i post del seed erano stati inseriti
 * tutti nello stesso istante, qui ricevono orari casuali (l'ordine cronologico
 * dell'elenco non cambia, lo garantisce l'ORDER BY della query).
 */
async function distribuisciOrariPost() {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS totale,
            COUNT(DISTINCT date_trunc('minute', created_at))::int AS istanti
     FROM posts`
  );
  if (rows[0].totale < 2 || rows[0].istanti > 1) return;

  const { rows: post } = await query('SELECT id FROM posts ORDER BY id');
  const minuti = orariCasualiPost(post.length);
  for (let i = 0; i < post.length; i++) {
    await query('UPDATE posts SET created_at = $1 WHERE id = $2', [minutiFa(minuti[i]), post[i].id]);
  }
  console.log('[migrate] assegnati orari casuali ai ' + post.length + ' post esistenti');
}

/**
 * Come sopra, per le notifiche dei database preesistenti: erano tutte dello
 * stesso istante, quindi finivano tutte nel gruppo "Oggi".
 */
async function distribuisciOrariNotifiche() {
  // solo quelle dell'account DEMO: le altre sono nate dall'uso dell'app
  const me = await idDi(DEMO_EMAIL);
  if (!me) return;

  const { rows } = await query(
    `SELECT COUNT(*)::int AS totale,
            COUNT(DISTINCT date_trunc('minute', created_at))::int AS istanti
     FROM notifications WHERE user_id = $1`,
    [me]
  );
  if (rows[0].totale < 2 || rows[0].istanti > 1) return;

  const { rows: notifiche } = await query(
    'SELECT id FROM notifications WHERE user_id = $1 ORDER BY id', [me]
  );
  for (let i = 0; i < notifiche.length; i++) {
    const minuti = (NOTIFICHE[i] && NOTIFICHE[i].minuti) || (i + 1) * 720;
    await query('UPDATE notifications SET created_at = $1 WHERE id = $2', [minutiFa(minuti), notifiche[i].id]);
  }
  console.log('[migrate] ridistribuiti gli orari di ' + notifiche.length + ' notifiche esistenti');
}

/**
 * Database preesistenti: i post di esempio erano nati senza prenotazione
 * allegata. Qui la si crea e la si collega, cosi' anche su un database gia'
 * popolato si vede il post cliccabile con il bottone "Partecipa".
 * Si tocca solo il primo post di ciascun autore del seed, e solo se non ha
 * gia' una prenotazione: i post scritti dagli utenti restano intatti.
 */
async function assicuraPrenotazioniDeiPost() {
  let collegati = 0;
  for (const { email, prenotazione } of POST) {
    if (!prenotazione) continue;
    const uid = await idDi(email);
    if (!uid) continue;

    // prenotazione_rimossa = true significa che qualcuno l'ha cancellata di
    // proposito: quel post mostra "prenotazione non più disponibile" e non va
    // ricollegato a una prenotazione nuova.
    const { rows } = await query(
      `SELECT id FROM posts
       WHERE user_id = $1 AND booking_id IS NULL AND NOT prenotazione_rimossa
       ORDER BY id LIMIT 1`,
      [uid]
    );
    if (!rows[0]) continue;

    const bookingId = await creaPrenotazioneDiEsempio(uid, prenotazione);
    if (!bookingId) continue;
    await query('UPDATE posts SET booking_id = $1 WHERE id = $2', [bookingId, rows[0].id]);
    collegati++;
  }
  if (collegati > 0) console.log('[migrate] collegata una prenotazione a ' + collegati + ' post di esempio');
}

/**
 * Database preesistenti: le prenotazioni allegate ai post di esempio erano
 * fissate a pochi giorni dal seed. Qui si spostano su una data casuale dopo
 * il 15 settembre 2026, una diversa per ciascuna.
 * Si toccano solo quelle troppo indietro: una volta sistemate restano dove
 * sono, cosi' la funzione puo' girare a ogni avvio senza rimescolare nulla.
 * I post scritti dagli utenti non c'entrano: si guardano solo gli autori del
 * seed e le prenotazioni davvero collegate a un post.
 */
// Pezzi di testo dei post di esempio che nominavano un giorno o un'ora:
// con la data sorteggiata non hanno piu' senso, e la prenotazione allegata
// li mostra gia' per conto suo. Si tolgono anche dai database gia' popolati.
const FRASI_DA_TOGLIERE = [
  { cerca: ' domani ', sostituisci: ' ' },
  { cerca: ' L’orario della prenotazione è per sabato 22/11 alle 21.00.', sostituisci: '' },
];

async function aggiornaDateDeiPost() {
  let spostate = 0;
  let corretti = 0;
  for (const { email } of POST) {
    const uid = await idDi(email);
    if (!uid) continue;

    const { rows } = await query(
      `SELECT b.id FROM bookings b
       JOIN posts p ON p.booking_id = b.id
       WHERE p.user_id = $1 AND b.user_id = $1 AND b.data <= $2`,
      [uid, ULTIMO_GIORNO_ESCLUSO]
    );

    for (const b of rows) {
      await query('UPDATE bookings SET data = $1 WHERE id = $2', [dataCasualeDeiPost(), b.id]);
      spostate++;
    }

    // Con una data sorteggiata, giorno e ora scritti dentro al testo non
    // tornano piu': si tolgono dai soli post di esempio (quelli con una
    // prenotazione allegata, che data e ora le mostrano gia' nel riquadro
    // sotto), mai da quelli scritti dagli utenti. Vale anche quando le date
    // erano gia' a posto, e ripetere il giro non cambia piu' nulla.
    for (const frase of FRASI_DA_TOGLIERE) {
      const { rowCount } = await query(
        `UPDATE posts SET contenuto = trim(REPLACE(contenuto, $2, $3))
         WHERE user_id = $1 AND booking_id IS NOT NULL AND position($2 in contenuto) > 0`,
        [uid, frase.cerca, frase.sostituisci]
      );
      corretti += rowCount;
    }
  }
  if (spostate > 0) {
    console.log('[migrate] spostate ' + spostate + ' prenotazioni dei post dopo il 15 settembre');
  }
  if (corretti > 0) {
    console.log('[migrate] tolto "domani" da ' + corretti + ' post di esempio: la data ora e casuale');
  }
}

/**
 * Database preesistenti: le notifiche gia' salvate non avevano una
 * destinazione. La si ricava dal titolo (il nome di chi l'ha generata) e dal
 * testo: "ha accettato" porta alla chat, "ha iniziato a seguirti" al profilo.
 */
async function assicuraLinkNotifiche() {
  const { rowCount } = await query(
    `UPDATE notifications n SET link = COALESCE(
       (SELECT '/utente/' || u.id FROM users u WHERE u.nome = n.titolo LIMIT 1),
       CASE WHEN n.tipo = 'prenotazione'      THEN '/prenotazioni'
            WHEN n.titolo ILIKE 'Benvenuto%'   THEN '/profilo/modifica'
            ELSE '/amici' END)
     WHERE n.link = ''`
  );
  if (rowCount > 0) console.log('[migrate] assegnata la destinazione a ' + rowCount + ' notifiche');
}

/**
 * Le notifiche "ha accettato la tua richiesta" gia' salvate aprivano la chat:
 * ora devono aprire il profilo di chi ha accettato.
 */
async function correggiLinkAmiciziaAccettata() {
  const { rowCount } = await query(
    `UPDATE notifications
     SET link = replace(link, '/chat/utente/', '/utente/')
     WHERE testo ILIKE 'Ha accettato%' AND link LIKE '/chat/utente/%'`
  );
  if (rowCount > 0) {
    console.log('[migrate] ' + rowCount + ' notifiche di amicizia accettata ora portano al profilo');
  }
}

async function migrate() {
  await waitForDatabase();
  await runSqlFile('01_schema.sql');
  await runSqlFile('02_seed.sql');
  const nuovi = await seedUtenti();
  await assicuraAccountDimostrativo();
  await assicuraNomeAccountDimostrativo();
  await rimuoviGruppiDiProva();
  if (nuovi) await seedContenuti();
  await distribuisciOrariPost();
  await distribuisciOrariNotifiche();
  await assicuraLinkNotifiche();
  await correggiLinkAmiciziaAccettata();
  await assicuraPrenotazioniDeiPost();
  await aggiornaDateDeiPost();
  await seedMessaggi();
}

module.exports = { migrate };

// Eseguibile anche da solo:  npm run seed
if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .then(() => console.log('[migrate] completato'))
    .catch((e) => {
      console.error('[migrate] errore:', e);
      process.exit(1);
    });
}
