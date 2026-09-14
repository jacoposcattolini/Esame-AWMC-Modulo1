/** MODEL - Amici, gruppi e swipe. */
const { query } = require('../config/db');

// l'eta' non e' un dato inserito a mano: si ricava dalla data di nascita
const ETA = "COALESCE(EXTRACT(YEAR FROM age(u.data_nascita))::int, u.eta) AS eta";

/* ------------------------------ AMICI ------------------------------ */

async function amiciDi(userId) {
  const { rows } = await query(
    `SELECT u.id, u.nome, u.avatar, u.sport, u.bio, ${ETA}, f.stato
     FROM friendships f
     JOIN users u ON u.id = f.friend_id
     WHERE f.user_id = $1 AND f.stato = 'accettata'
     ORDER BY u.nome`,
    [userId]
  );
  return rows;
}

/* --------------------------- richieste di amicizia ---------------------------

   Una richiesta e' UNA riga sola, dal mittente al destinatario, con
   stato 'inviata'. Quando viene accettata la riga passa ad 'accettata' e se
   ne aggiunge una speculare: da quel momento i due si vedono a vicenda negli
   amici. Il rifiuto lascia la riga a 'rifiutata', cosi' non si ripropone da
   sola al primo swipe successivo.
   ---------------------------------------------------------------------- */

/** Richieste ricevute e ancora in attesa. */
async function richiesteRicevute(userId) {
  const { rows } = await query(
    `SELECT u.id, u.nome, u.avatar, u.sport, u.bio, ${ETA}, f.created_at
     FROM friendships f
     JOIN users u ON u.id = f.user_id
     WHERE f.friend_id = $1 AND f.stato = 'inviata'
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Come stanno le cose fra due persone, dal punto di vista di userId:
 * 'accettata' | 'inviata' (l'ho mandata io) | 'ricevuta' (devo rispondere)
 * | 'rifiutata' | 'nessuna'.
 */
async function statoAmicizia(userId, altroId) {
  const { rows } = await query(
    `SELECT user_id, friend_id, stato FROM friendships
     WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [userId, altroId]
  );
  if (rows.some((r) => r.stato === 'accettata')) return 'accettata';
  const mia = rows.find((r) => Number(r.user_id) === Number(userId));
  if (mia && mia.stato === 'inviata') return 'inviata';
  const sua = rows.find((r) => Number(r.friend_id) === Number(userId));
  if (sua && sua.stato === 'inviata') return 'ricevuta';
  if (rows.length > 0) return 'rifiutata';
  return 'nessuna';
}

/**
 * Stato dell'amicizia fra userId e piu' persone in una sola query.
 * Serve alla ricerca di persone (schermata Swipe), che altrimenti dovrebbe
 * chiedere il profilo di ognuna per sapere se e' gia' amica.
 * Torna una mappa { id: stato }, con gli stessi valori di statoAmicizia.
 */
async function statiAmicizia(userId, ids) {
  const elenco = ids.map(Number).filter(Number.isInteger);
  if (elenco.length === 0) return {};

  const { rows } = await query(
    `SELECT user_id, friend_id, stato FROM friendships
     WHERE (user_id = $1 AND friend_id = ANY($2::int[]))
        OR (friend_id = $1 AND user_id = ANY($2::int[]))`,
    [userId, elenco]
  );

  const stati = {};
  for (const id of elenco) {
    const righe = rows.filter(
      (r) => Number(r.user_id) === id || Number(r.friend_id) === id
    );
    // stesso ordine di precedenza di statoAmicizia, per una persona sola
    if (righe.some((r) => r.stato === 'accettata')) stati[id] = 'accettata';
    else if (righe.some((r) => Number(r.user_id) === Number(userId) && r.stato === 'inviata')) stati[id] = 'inviata';
    else if (righe.some((r) => Number(r.friend_id) === Number(userId) && r.stato === 'inviata')) stati[id] = 'ricevuta';
    else if (righe.length > 0) stati[id] = 'rifiutata';
    else stati[id] = 'nessuna';
  }
  return stati;
}

/** Rende amiche due persone in entrambe le direzioni. */
async function rendiAmici(a, b) {
  await aggiungiAmico(a, b, 'accettata');
  await aggiungiAmico(b, a, 'accettata');
}

/**
 * Invia una richiesta di amicizia.
 * Se l'altra persona ne aveva gia' mandata una, le due si incrociano e
 * l'amicizia scatta subito: e' il "match".
 */
async function inviaRichiesta(userId, friendId) {
  if (Number(userId) === Number(friendId)) return null;

  const attuale = await statoAmicizia(userId, friendId);
  if (attuale === 'accettata') return { stato: 'gia_amici', match: false };

  if (attuale === 'ricevuta') {
    await rendiAmici(userId, friendId);
    return { stato: 'accettata', match: true };
  }

  await aggiungiAmico(userId, friendId, 'inviata');
  return { stato: 'inviata', match: false };
}

/**
 * Annulla una richiesta di amicizia ancora in attesa.
 * Cancella la riga invece di segnarla "rifiutata": la richiesta non e' mai
 * esistita, ne' per chi l'ha mandata ne' per chi l'ha ricevuta.
 */
async function annullaRichiesta(userId, destinatarioId) {
  const { rowCount } = await query(
    `DELETE FROM friendships
     WHERE user_id = $1 AND friend_id = $2 AND stato = 'inviata'`,
    [userId, destinatarioId]
  );
  return rowCount > 0;
}

/**
 * Dimentica lo swipe fra due persone, in entrambi i versi.
 * Serve quando un rapporto viene sciolto (richiesta annullata, amicizia
 * rimossa): senza questo i due resterebbero esclusi per sempre dallo swipe,
 * perche' il "mi piace" registrato li toglie dai candidati.
 */
async function dimenticaSwipe(userId, altroId) {
  await query(
    `DELETE FROM swipes
     WHERE (user_id = $1 AND target_id = $2) OR (user_id = $2 AND target_id = $1)`,
    [userId, altroId]
  );
}

/** Accetta la richiesta ricevuta da mittenteId. false se non esisteva. */
async function accettaRichiesta(userId, mittenteId) {
  const { rowCount } = await query(
    `UPDATE friendships SET stato = 'accettata'
     WHERE user_id = $2 AND friend_id = $1 AND stato = 'inviata'`,
    [userId, mittenteId]
  );
  if (rowCount === 0) return false;
  await aggiungiAmico(userId, mittenteId, 'accettata');
  return true;
}

/** Rifiuta la richiesta ricevuta da mittenteId. */
async function rifiutaRichiesta(userId, mittenteId) {
  const { rowCount } = await query(
    `UPDATE friendships SET stato = 'rifiutata'
     WHERE user_id = $2 AND friend_id = $1 AND stato = 'inviata'`,
    [userId, mittenteId]
  );
  return rowCount > 0;
}

async function aggiungiAmico(userId, friendId, stato = 'accettata') {
  if (Number(userId) === Number(friendId)) return null;
  const { rows } = await query(
    `INSERT INTO friendships (user_id, friend_id, stato) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, friend_id) DO UPDATE SET stato = EXCLUDED.stato
     RETURNING id, friend_id, stato`,
    [userId, friendId, stato]
  );
  return rows[0];
}

/** true se l'utente ha gia' fra gli amici la persona indicata. */
async function sonoAmici(userId, friendId) {
  const { rows } = await query(
    'SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2',
    [userId, friendId]
  );
  return rows.length > 0;
}

/**
 * Toglie l'amicizia in entrambi i versi e dimentica gli swipe fra i due:
 * senza quest'ultimo passaggio la persona rimossa resterebbe fuori dallo
 * swipe per sempre (il "mi piace" di allora la escluderebbe dai candidati).
 */
async function rimuoviAmico(userId, friendId) {
  const { rowCount } = await query(
    `DELETE FROM friendships
     WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [userId, friendId]
  );
  if (rowCount > 0) await dimenticaSwipe(userId, friendId);
  return rowCount > 0;
}

/* ------------------------------ GRUPPI ----------------------------- */

async function gruppiDi(userId) {
  const { rows } = await query(
    `SELECT g.id, g.nome, g.immagine, g.creatore_id,
            (SELECT COUNT(*)::int FROM group_members m2 WHERE m2.group_id = g.id) AS membri
     FROM groups g
     JOIN group_members m ON m.group_id = g.id AND m.user_id = $1
     ORDER BY g.id`,
    [userId]
  );
  return rows;
}

async function tuttiGruppi() {
  const { rows } = await query(
    `SELECT g.id, g.nome, g.immagine, g.creatore_id,
            (SELECT COUNT(*)::int FROM group_members m WHERE m.group_id = g.id) AS membri
     FROM groups g ORDER BY g.id`
  );
  return rows;
}

async function gruppoPerId(id) {
  const { rows } = await query(
    `SELECT g.id, g.nome, g.immagine, g.creatore_id,
            (SELECT COUNT(*)::int FROM group_members m WHERE m.group_id = g.id) AS membri
     FROM groups g WHERE g.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/** true se l'utente fa parte del gruppo (serve a proteggere la chat di gruppo). */
async function eMembro(groupId, userId) {
  const { rows } = await query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  return rows.length > 0;
}

async function membriGruppo(groupId) {
  const { rows } = await query(
    `SELECT u.id, u.nome, u.avatar, u.sport
     FROM group_members m JOIN users u ON u.id = m.user_id
     WHERE m.group_id = $1 ORDER BY u.nome`,
    [groupId]
  );
  return rows;
}

/** true se esiste gia' un gruppo con questo nome (il nome e' unico). */
async function nomeGruppoOccupato(nome) {
  const { rows } = await query('SELECT 1 FROM groups WHERE lower(nome) = lower($1)', [nome]);
  return rows.length > 0;
}

/**
 * Crea un gruppo con il suo creatore dentro, piu' i membri iniziali scelti.
 * Restituisce null se il nome e' gia' preso: prima si riusava il gruppo
 * esistente, e chi creava "Calcetto" finiva dentro il gruppo di qualcun altro.
 */
async function creaGruppo(nome, immagine, creatoreId, membri = []) {
  if (await nomeGruppoOccupato(nome)) return null;

  const { rows } = await query(
    `INSERT INTO groups (nome, immagine, creatore_id) VALUES ($1,$2,$3) RETURNING id`,
    [nome, immagine || '/img/group-amici-stretti.jpg', creatoreId]
  );
  const gruppo = rows[0];

  const daInserire = [creatoreId, ...membri.filter((m) => Number(m) !== Number(creatoreId))];
  for (const utente of daInserire) {
    await query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [gruppo.id, utente]
    );
  }
  return gruppoPerId(gruppo.id);
}

async function entraNelGruppo(groupId, userId) {
  await query(
    'INSERT INTO group_members (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [groupId, userId]
  );
  return true;
}

/**
 * Elimina un gruppo, ma solo se a chiederlo e' chi lo ha creato: i gruppi di
 * esempio (senza creatore) non si possono cancellare dall'app.
 * Membri e messaggi se ne vanno con lui (ON DELETE CASCADE).
 * Torna 'ok', 'non_trovato' oppure 'non_tuo'.
 */
async function eliminaGruppo(groupId, userId) {
  const { rows } = await query('SELECT creatore_id FROM groups WHERE id = $1', [groupId]);
  if (rows.length === 0) return 'non_trovato';
  if (Number(rows[0].creatore_id) !== Number(userId)) return 'non_tuo';

  await query('DELETE FROM groups WHERE id = $1', [groupId]);
  return 'ok';
}

/* ------------------------------- SWIPE ----------------------------- */

// Un rifiuto non esclude il profilo per sempre: passato un mese dallo swipe
// negativo la persona torna fra i candidati, cosi' la lista non si esaurisce
// mai. I like invece restano esclusi definitivamente: sono decisioni gia' prese.
const GRAZIA_RIFIUTO = process.env.SWIPE_GRAZIA_RIFIUTO || '1 month';

/**
 * Utenti ancora da valutare: esclusi se stessi, chi ha gia' ricevuto un like
 * e chi e' stato rifiutato da meno del periodo di grazia.
 * L'ordine e' casuale, cosi' le carte non si ripresentano sempre uguali.
 */
async function candidatiSwipe(userId) {
  const { rows } = await query(
    `SELECT u.id, u.nome, u.avatar, u.sport, u.bio, ${ETA}
     FROM users u
     WHERE u.id <> $1
       AND u.id NOT IN (
         SELECT target_id FROM swipes
         WHERE user_id = $1
           AND (liked = true OR created_at > now() - $2::interval)
       )
       -- chi e' gia' amico non ha senso proporlo: e' gia' nella rubrica
       AND u.id NOT IN (
         SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END
         FROM friendships
         WHERE (user_id = $1 OR friend_id = $1) AND stato = 'accettata'
       )
     ORDER BY random()`,
    [userId, GRAZIA_RIFIUTO]
  );
  return rows;
}

/**
 * Registra la decisione dello swipe. Con un like parte anche una richiesta di
 * amicizia: l'altra persona la trova fra le richieste e decide se accettarla.
 * Se aveva gia' messo like (o mandato una richiesta) le due si incrociano e
 * l'amicizia scatta subito: e' il match.
 */
async function registraSwipe(userId, targetId, liked) {
  await query(
    `INSERT INTO swipes (user_id, target_id, liked) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, target_id)
       DO UPDATE SET liked = EXCLUDED.liked, created_at = now()`,
    [userId, targetId, liked]
  );
  if (!liked) return { match: false, richiesta: 'nessuna' };

  const esito = await inviaRichiesta(userId, targetId);
  if (!esito) return { match: false, richiesta: 'nessuna' };
  return { match: esito.match, richiesta: esito.stato };
}

module.exports = {
  amiciDi, aggiungiAmico, rimuoviAmico, sonoAmici,
  richiesteRicevute, statoAmicizia, statiAmicizia, inviaRichiesta, accettaRichiesta, rifiutaRichiesta,
  annullaRichiesta, dimenticaSwipe,
  gruppiDi, tuttiGruppi, gruppoPerId, eMembro, membriGruppo, creaGruppo, entraNelGruppo,
  eliminaGruppo,
  nomeGruppoOccupato,
  candidatiSwipe, registraSwipe,
};
