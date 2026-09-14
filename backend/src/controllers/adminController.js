/**
 * CONTROLLER - Amministrazione (API JSON).
 *
 * Il backend non ha piu' pagine: qui non si renderizza nulla, si risponde
 * solo con dati. L'interfaccia del pannello vive nel frontend React e chiama
 * queste rotte con il token dell'amministratore.
 *
 * Convenzione delle risposte alle azioni: sia in caso di successo sia in caso
 * di rifiuto il corpo contiene un campo "esito" (eliminato, demo, inesistente,
 * ...) che il pannello traduce nel messaggio da mostrare; gli errori portano
 * anche lo stato HTTP giusto e un testo pronto in "errore".
 */
const fs = require('fs');
const path = require('path');
const userModel = require('../models/userModel');
const sportModel = require('../models/sportModel');
const bookingModel = require('../models/bookingModel');
const postModel = require('../models/postModel');
const demo = require('../config/demo');
const portafoglio = require('../config/portafoglio');
const {
  UTENTE,
  DURATA_ORE,
  credenzialiValide,
  creaTokenAdmin,
  attesaRimasta,
  segnalaFallimento,
  azzeraTentativi,
} = require('../middleware/adminAuth');

// le foto dei campi sono file gia' presenti nel progetto: il modulo di
// aggiunta le propone in un elenco, cosi' non serve conoscere i percorsi a
// memoria. La cartella e' montata nel container come sola lettura.
const CARTELLA_IMMAGINI =
  process.env.CARTELLA_IMMAGINI || path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'img');

function immaginiDisponibili() {
  // prima le foto dei campi e degli sport, poi tutto il resto (avatar, loghi):
  // in cima all'elenco ci si trova quello che serve davvero a un campo nuovo
  const priorita = (f) => (f.startsWith('venue-') ? 0 : f.startsWith('sport-') ? 1 : 2);
  try {
    return fs
      .readdirSync(CARTELLA_IMMAGINI)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort((a, b) => priorita(a) - priorita(b) || a.localeCompare(b))
      .map((f) => '/img/' + f);
  } catch {
    return [];
  }
}

/* ------------------------------- ACCESSO -------------------------------- */

/**
 * POST /api/admin/login  { nome, password }
 * Rotta separata da /api/auth/login: gli utenti entrano con l'email, qui si
 * entra con il nome utente configurato nell'ambiente.
 */
async function login(req, res, next) {
  try {
    const ip = req.ip || 'sconosciuto';

    const attesa = attesaRimasta(ip);
    if (attesa > 0) {
      return res.status(429).json({ errore: `Troppi tentativi. Riprova fra ${attesa} minuti.` });
    }

    const { nome, password } = req.body || {};
    if (!(await credenzialiValide(nome, password))) {
      segnalaFallimento(ip);
      return res.status(401).json({ errore: 'Credenziali non valide' });
    }

    azzeraTentativi(ip);
    res.json({
      token: creaTokenAdmin(),
      durataOre: DURATA_ORE,
      amministratore: { nome: UTENTE, ruolo: 'admin' },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/sessione
 * Serve al pannello per sapere, dopo un ricaricamento della pagina, se il
 * token salvato vale ancora (l'equivalente di /api/auth/me per l'admin).
 */
function sessione(req, res) {
  res.json({ nome: req.admin.utente, ruolo: 'admin' });
}

/* ------------------------------- LETTURE -------------------------------- */

/** GET /api/admin/statistiche */
async function statistiche(req, res, next) {
  try {
    const [utenti, campi, prenotazioni, post, sport, ultime] = await Promise.all([
      userModel.conta(),
      sportModel.contaCampi(),
      bookingModel.conta(),
      postModel.conta(),
      sportModel.elencoSport(),
      bookingModel.ultime(15),
    ]);
    res.json({ statistiche: { utenti, campi, prenotazioni, post }, sport, ultime });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/utenti */
async function utenti(req, res, next) {
  try {
    res.json({ utenti: await userModel.elenco() });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/prenotazioni */
async function prenotazioni(req, res, next) {
  try {
    res.json({ prenotazioni: await bookingModel.tutte() });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/post */
async function post(req, res, next) {
  try {
    res.json({ post: await postModel.tutti() });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/campi - elenco, sport e foto selezionabili nel modulo. */
async function campi(req, res, next) {
  try {
    const [elenco, sport] = await Promise.all([sportModel.tuttiCampi(), sportModel.elencoSport()]);
    res.json({ campi: elenco, sport, immagini: immaginiDisponibili() });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------- AZIONI --------------------------------- */

/**
 * DELETE /api/admin/utenti/:id
 * L'account DEMO non e' eliminabile nemmeno da qui: vale la stessa regola
 * dell'app (socialController.eliminaProfilo), altrimenti si potrebbe
 * cancellare dal pannello cio' che l'app protegge.
 */
async function eliminaUtente(req, res, next) {
  try {
    const utente = await userModel.trovaPerId(req.params.id);
    if (!utente) {
      return res.status(404).json({ esito: 'inesistente', errore: 'Account non trovato' });
    }
    if (demo.eDemo(utente.email)) {
      return res.status(409).json({ esito: 'demo', errore: 'L’account DEMO non è eliminabile' });
    }

    await userModel.elimina(utente.id);
    res.json({ esito: 'eliminato' });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/prenotazioni/:id/stato  { stato }
 * Annullando dal pannello vale la stessa regola dell'app: quanto era stato
 * pagato torna sul saldo SportEasy di chi lo aveva versato.
 */
async function cambiaStatoPrenotazione(req, res, next) {
  try {
    const stato = String((req.body || {}).stato || '');
    if (!['in_attesa', 'confermata', 'annullata'].includes(stato)) {
      return res.status(400).json({ esito: 'statononvalido', errore: 'Stato non valido' });
    }

    const prima = await bookingModel.perId(req.params.id);
    const aggiornata = await bookingModel.cambiaStatoAdmin(req.params.id, stato);
    if (!aggiornata) {
      return res.status(404).json({ esito: 'inesistente', errore: 'Prenotazione non trovata' });
    }

    if (stato === 'annullata' && prima && prima.stato !== 'annullata') {
      await portafoglio.rimborsaPrenotazione(prima);
    }
    res.json({ esito: 'aggiornata', prenotazione: aggiornata });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/prenotazioni/:id
 * Prima di cancellare si rimborsa chi aveva pagato; i post collegati non si
 * rompono perche' il trigger sul database li marca (vedi 01_schema.sql).
 */
async function eliminaPrenotazione(req, res, next) {
  try {
    const prima = await bookingModel.perId(req.params.id);
    if (prima && prima.stato !== 'annullata') await portafoglio.rimborsaPrenotazione(prima);

    const ok = await bookingModel.eliminaAdmin(req.params.id);
    if (!ok) return res.status(404).json({ esito: 'inesistente', errore: 'Prenotazione non trovata' });
    res.json({ esito: 'eliminata' });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/post/:id */
async function eliminaPost(req, res, next) {
  try {
    const ok = await postModel.eliminaAdmin(req.params.id);
    if (!ok) return res.status(404).json({ esito: 'inesistente', errore: 'Post non trovato' });
    res.json({ esito: 'eliminato' });
  } catch (err) {
    next(err);
  }
}

/**
 * Controlla i dati del modulo "nuovo campo" e li normalizza.
 * Il modulo e' guidato (nessuno deve conoscere la struttura del database),
 * quindi qui si traducono i valori in quello che la tabella si aspetta.
 * La validazione resta sul server: il pannello non ne ha una sua.
 * Torna { dati } se va tutto bene, { errore } con il messaggio da mostrare
 * se qualcosa non va.
 */
async function validaCampo(corpo) {
  const c = corpo || {};

  const nome = String(c.nome || '').trim();
  if (nome.length < 2 || nome.length > 120) {
    return { errore: 'Il nome del campo deve avere da 2 a 120 caratteri' };
  }

  const sportId = Number(c.sport_id);
  const sport = (await sportModel.elencoSport()).find((x) => x.id === sportId);
  if (!sport) return { errore: 'Scegli uno sport fra quelli disponibili' };

  const prezzo = Number(String(c.prezzo || '0').replace(',', '.'));
  if (!Number.isFinite(prezzo) || prezzo < 0 || prezzo > 999) {
    return { errore: 'Il prezzo a persona deve essere un numero fra 0 e 999' };
  }

  // gli orari sono ore piene, come nel resto dell'app ("9.00", "21.00")
  const apertura = Number(c.apertura);
  const chiusura = Number(c.chiusura);
  if (!Number.isInteger(apertura) || !Number.isInteger(chiusura) ||
      apertura < 0 || chiusura > 24 || apertura >= chiusura) {
    return { errore: 'Orari non validi: l’apertura deve venire prima della chiusura' };
  }

  const immagine = String(c.immagine || '').trim();
  if (!immagine.startsWith('/img/') || immagine.length > 160) {
    return { errore: 'Scegli una foto fra quelle disponibili' };
  }

  const indirizzo = String(c.indirizzo || '').trim().slice(0, 160);

  // le coordinate sono facoltative, ma o ci sono entrambe o nessuna:
  // servono al segnaposto sulla mappa della schermata di prenotazione
  const vuoto = (v) => v === undefined || v === null || String(v).trim().length === 0;
  const lat = vuoto(c.lat) ? null : Number(String(c.lat).replace(',', '.'));
  const lng = vuoto(c.lng) ? null : Number(String(c.lng).replace(',', '.'));
  if ((lat === null) !== (lng === null)) {
    return { errore: 'Indica sia latitudine sia longitudine, oppure lascia vuote entrambe' };
  }
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
    return { errore: 'Latitudine non valida (va da -90 a 90)' };
  }
  if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
    return { errore: 'Longitudine non valida (va da -180 a 180)' };
  }

  const rating = Number(c.rating || 5);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { errore: 'La valutazione va da 1 a 5' };
  }

  return {
    dati: {
      sport_id: sportId,
      nome,
      prezzo,
      apertura: `${apertura}.00`,
      chiusura: `${chiusura}.00`,
      immagine,
      indirizzo,
      lat,
      lng,
      rating,
      ordine: Number(c.ordine) || 0,
    },
  };
}

/** POST /api/admin/campi - aggiunge un campo dal modulo guidato. */
async function creaCampo(req, res, next) {
  try {
    const { errore, dati } = await validaCampo(req.body);
    if (errore) return res.status(400).json({ esito: 'nonvalido', errore });

    const campo = await sportModel.creaCampo(dati);
    if (!campo) {
      return res.status(409).json({
        esito: 'duplicato',
        errore: 'Esiste già un campo con questo nome per lo sport scelto',
      });
    }

    res.status(201).json({ esito: 'creato', campo });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/campi/:id
 * Con il campo se ne vanno le sue prenotazioni (ON DELETE CASCADE): prima si
 * rimborsa chi aveva pagato, come per l'eliminazione di una prenotazione.
 */
async function eliminaCampo(req, res, next) {
  try {
    const campo = await sportModel.campoPerId(req.params.id);
    if (!campo) return res.status(404).json({ esito: 'inesistente', errore: 'Campo non trovato' });

    for (const b of await bookingModel.tutte(1000)) {
      if (b.venue_id === campo.id && b.stato !== 'annullata') {
        await portafoglio.rimborsaPrenotazione(b);
      }
    }

    const ok = await sportModel.eliminaCampo(campo.id);
    if (!ok) return res.status(404).json({ esito: 'inesistente', errore: 'Campo non trovato' });
    res.json({ esito: 'eliminato', campo: campo.nome });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  sessione,
  statistiche,
  utenti,
  prenotazioni,
  post,
  campi,
  eliminaUtente,
  cambiaStatoPrenotazione,
  eliminaPrenotazione,
  eliminaPost,
  creaCampo,
  eliminaCampo,
};
