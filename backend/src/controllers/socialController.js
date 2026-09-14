/** CONTROLLER - Post, amici, gruppi, swipe, notifiche, profilo. */
const postModel = require('../models/postModel');
const socialModel = require('../models/socialModel');
const notificationModel = require('../models/notificationModel');
const userModel = require('../models/userModel');
const bookingModel = require('../models/bookingModel');
const { adesso, slotPassato } = require('../config/orario');

// un'immagine caricata dall'utente (foto profilo o immagine di un gruppo)
// arriva come data URL: si accettano solo immagini e con un peso ragionevole
// (il client la riduce prima di inviarla)
const IMMAGINE_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const IMMAGINE_MAX = 700 * 1024;

function immagineValida(valore) {
  if (typeof valore !== 'string' || !valore) return false;
  if (valore.startsWith('data:')) return IMMAGINE_DATA_URL.test(valore) && valore.length <= IMMAGINE_MAX;
  return valore.startsWith('/img/') && valore.length <= 160;
}

/* -------------------------------- POST ------------------------------- */

async function elencoPost(req, res, next) {
  try {
    res.json(await postModel.elenco(req.utente.id));
  } catch (err) {
    next(err);
  }
}

async function creaPost(req, res, next) {
  try {
    const contenuto = (req.body && req.body.contenuto || '').trim();
    if (!contenuto) return res.status(400).json({ errore: 'Il post non può essere vuoto' });
    if (contenuto.length > 1000) return res.status(400).json({ errore: 'Post troppo lungo (max 1000 caratteri)' });

    // prenotazione allegata (facoltativa): dev'essere una prenotazione propria
    let bookingId = null;
    if (req.body && req.body.bookingId) {
      const prenotazione = await bookingModel.perId(req.body.bookingId);
      if (!prenotazione || prenotazione.user_id !== req.utente.id) {
        return res.status(400).json({ errore: 'Puoi allegare solo una tua prenotazione' });
      }
      bookingId = prenotazione.id;
    }

    res.status(201).json(await postModel.crea(req.utente.id, contenuto, bookingId));
  } catch (err) {
    next(err);
  }
}

async function eliminaPost(req, res, next) {
  try {
    const ok = await postModel.elimina(req.params.id, req.utente.id);
    if (!ok) return res.status(404).json({ errore: 'Post non trovato' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------- AMICI ------------------------------- */

async function amici(req, res, next) {
  try {
    res.json(await socialModel.amiciDi(req.utente.id));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users?cerca=...
 * Elenco delle persone (usato dalla ricerca nella schermata Swipe): a ogni
 * riga si aggiunge lo stato dell'amicizia con chi sta cercando, cosi' il
 * bottone sa gia' se offrire "Aggiungi", "Accetta" o dire che siete amici.
 */
async function utenti(req, res, next) {
  try {
    const elenco = await userModel.elenco({
      escludiId: req.utente.id,
      cerca: req.query.cerca || '',
    });
    const stati = await socialModel.statiAmicizia(req.utente.id, elenco.map((u) => u.id));
    res.json(elenco.map((u) => ({ ...u, amicizia: stati[u.id] || 'nessuna' })));
  } catch (err) {
    next(err);
  }
}

async function profiloUtente(req, res, next) {
  try {
    const utente = await userModel.trovaPerId(req.params.id);
    if (!utente) return res.status(404).json({ errore: 'Utente non trovato' });
    const stato = await socialModel.statoAmicizia(req.utente.id, utente.id);
    res.json({ ...utente, amico: stato === 'accettata', amicizia: stato });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/:id/bookings
 * Prenotazioni ancora aperte organizzate da quell'utente: si vedono dal suo
 * profilo e da li' ci si puo' aggiungere. Gli orari gia' passati di oggi
 * vengono scartati con lo stesso confronto usato in prenotazione (ora dei
 * campi, non del server).
 */
async function prenotazioniUtente(req, res, next) {
  try {
    const utente = await userModel.trovaPerId(req.params.id);
    if (!utente) return res.status(404).json({ errore: 'Utente non trovato' });

    const ora = adesso();
    const aperte = await bookingModel.aperteDi(utente.id, req.utente.id, ora.data);
    res.json(aperte.filter((b) => !slotPassato(b.data, b.ora)));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/friends/:id
 * Non crea piu' un'amicizia d'ufficio: manda una richiesta, che l'altra
 * persona trova nella sezione Amici e puo' accettare o rifiutare.
 */
async function aggiungiAmico(req, res, next) {
  try {
    const risultato = await socialModel.inviaRichiesta(req.utente.id, req.params.id);
    if (!risultato) return res.status(400).json({ errore: 'Non puoi aggiungere te stesso' });
    if (risultato.stato === 'gia_amici') {
      return res.status(409).json({ errore: 'Siete già amici' });
    }

    const io = await userModel.trovaPerId(req.utente.id);
    await avvisaDellaRichiesta(io, Number(req.params.id), risultato);
    res.status(201).json(risultato);
  } catch (err) {
    next(err);
  }
}

/** Testo della notifica di richiesta: si crea e si cancella da due punti. */
const TESTO_RICHIESTA = 'Ti ha inviato una richiesta di amicizia';

/**
 * Notifica chi riceve la richiesta (o entrambi, se le richieste si sono
 * incrociate e l'amicizia e' scattata subito).
 * La notifica "ha accettato la tua richiesta" porta al profilo di chi ha
 * accettato: e' la persona di cui si vuole sapere qualcosa in piu', la chat
 * resta comunque a un tocco dal profilo e dalla schermata Amici.
 */
async function avvisaDellaRichiesta(io, altroId, risultato) {
  if (risultato.stato === 'accettata') {
    const altro = await userModel.trovaPerId(altroId);
    if (!altro) return;
    await notificationModel.crea({
      userId: io.id, titolo: altro.nome, testo: 'Ha accettato la tua richiesta',
      avatar: altro.avatar, tipo: 'social', link: `/utente/${altro.id}`,
      autoreId: altro.id,
    });
    await notificationModel.crea({
      userId: altro.id, titolo: io.nome, testo: 'Ha accettato la tua richiesta',
      avatar: io.avatar, tipo: 'social', link: `/utente/${io.id}`,
      autoreId: io.id,
    });
    return;
  }

  if (risultato.stato === 'inviata') {
    await notificationModel.crea({
      userId: altroId,
      titolo: io.nome,
      testo: TESTO_RICHIESTA,
      avatar: io.avatar,
      tipo: 'social',
      link: '/amici',
      autoreId: io.id,
    });
  }
}

/**
 * DELETE /api/friends/requests/:id
 * Annulla la richiesta di amicizia che ho mandato a :id ed e' ancora in
 * attesa. Sparisce da entrambe le parti: la riga viene cancellata e con essa
 * la notifica che era arrivata al destinatario. Si dimentica anche lo swipe,
 * cosi' quella persona puo' tornare fra i profili proposti.
 */
async function annullaRichiesta(req, res, next) {
  try {
    const annullata = await socialModel.annullaRichiesta(req.utente.id, req.params.id);
    if (!annullata) {
      return res.status(404).json({ errore: 'Nessuna richiesta in attesa verso questa persona' });
    }

    await socialModel.dimenticaSwipe(req.utente.id, req.params.id);
    await notificationModel.elimina({
      userId: Number(req.params.id),
      autoreId: req.utente.id,
      testo: TESTO_RICHIESTA,
    });

    res.json({ ok: true, stato: 'nessuna' });
  } catch (err) {
    next(err);
  }
}

/** GET /api/friends/requests - richieste ricevute ancora in attesa. */
async function richieste(req, res, next) {
  try {
    res.json(await socialModel.richiesteRicevute(req.utente.id));
  } catch (err) {
    next(err);
  }
}

/** POST /api/friends/requests/:id/accept */
async function accettaRichiesta(req, res, next) {
  try {
    const ok = await socialModel.accettaRichiesta(req.utente.id, req.params.id);
    if (!ok) return res.status(404).json({ errore: 'Richiesta non trovata' });

    const io = await userModel.trovaPerId(req.utente.id);
    const mittente = await userModel.trovaPerId(req.params.id);
    if (mittente) {
      // toccando la notifica si apre il profilo di chi ha accettato
      await notificationModel.crea({
        userId: mittente.id, titolo: io.nome, testo: 'Ha accettato la tua richiesta',
        avatar: io.avatar, tipo: 'social', link: `/utente/${io.id}`,
        autoreId: io.id,
      });
    }
    // si restituisce il nuovo amico: il client lo aggiunge subito alla lista
    res.json({ ok: true, amico: mittente });
  } catch (err) {
    next(err);
  }
}

/** POST /api/friends/requests/:id/reject */
async function rifiutaRichiesta(req, res, next) {
  try {
    const ok = await socialModel.rifiutaRichiesta(req.utente.id, req.params.id);
    if (!ok) return res.status(404).json({ errore: 'Richiesta non trovata' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function rimuoviAmico(req, res, next) {
  try {
    const ok = await socialModel.rimuoviAmico(req.utente.id, req.params.id);
    res.json({ ok });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------ GRUPPI ------------------------------- */

async function gruppi(req, res, next) {
  try {
    const miei = req.query.tutti === '1'
      ? await socialModel.tuttiGruppi()
      : await socialModel.gruppiDi(req.utente.id);
    res.json(miei);
  } catch (err) {
    next(err);
  }
}

async function membriGruppo(req, res, next) {
  try {
    res.json(await socialModel.membriGruppo(req.params.id));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/groups
 * Crea un gruppo con il creatore dentro. I membri iniziali si possono
 * scegliere solo fra i propri amici: si evita di infilare nel gruppo persone
 * con cui non si ha alcun rapporto.
 */
async function creaGruppo(req, res, next) {
  try {
    const corpo = req.body || {};
    const nome = String(corpo.nome || '').trim();
    if (nome.length < 2 || nome.length > 80) {
      return res.status(400).json({ errore: 'Il nome del gruppo deve avere da 2 a 80 caratteri' });
    }
    if (await socialModel.nomeGruppoOccupato(nome)) {
      return res.status(409).json({ errore: 'Esiste già un gruppo con questo nome' });
    }
    // l'immagine puo' essere una di quelle pronte o una foto dalla galleria
    if (corpo.immagine !== undefined && corpo.immagine !== '' && !immagineValida(corpo.immagine)) {
      return res.status(400).json({ errore: 'Immagine del gruppo non valida' });
    }

    const amici = await socialModel.amiciDi(req.utente.id);
    const consentiti = new Set(amici.map((a) => a.id));
    const membri = Array.isArray(corpo.membri)
      ? corpo.membri.map(Number).filter((id) => consentiti.has(id))
      : [];

    const gruppo = await socialModel.creaGruppo(nome, corpo.immagine, req.utente.id, membri);
    if (!gruppo) return res.status(409).json({ errore: 'Esiste già un gruppo con questo nome' });
    res.status(201).json(gruppo);
  } catch (err) {
    next(err);
  }
}

async function entraNelGruppo(req, res, next) {
  try {
    await socialModel.entraNelGruppo(req.params.id, req.utente.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/groups/:id
 * Elimina il gruppo: puo' farlo solo chi lo ha creato. Se ne vanno con lui
 * anche i membri e i messaggi della chat di gruppo.
 */
async function eliminaGruppo(req, res, next) {
  try {
    const esito = await socialModel.eliminaGruppo(req.params.id, req.utente.id);
    if (esito === 'non_trovato') return res.status(404).json({ errore: 'Gruppo non trovato' });
    if (esito === 'non_tuo') {
      return res.status(403).json({ errore: 'Puoi eliminare solo i gruppi che hai creato' });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------- SWIPE ------------------------------- */

async function candidatiSwipe(req, res, next) {
  try {
    res.json(await socialModel.candidatiSwipe(req.utente.id));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/swipe/:id
 * Un like manda anche una richiesta di amicizia. Se le richieste si
 * incrociano l'amicizia scatta subito (match).
 */
async function swipe(req, res, next) {
  try {
    const liked = req.body && req.body.liked === true;
    const risultato = await socialModel.registraSwipe(req.utente.id, req.params.id, liked);

    if (liked && risultato.richiesta !== 'nessuna') {
      const io = await userModel.trovaPerId(req.utente.id);
      await avvisaDellaRichiesta(io, Number(req.params.id), { stato: risultato.richiesta });
    }
    res.json(risultato);
  } catch (err) {
    next(err);
  }
}

/* ----------------------------- NOTIFICHE ----------------------------- */

async function notifiche(req, res, next) {
  try {
    res.json(await notificationModel.perUtente(req.utente.id));
  } catch (err) {
    next(err);
  }
}

async function leggiNotifiche(req, res, next) {
  try {
    await notificationModel.segnaLette(req.utente.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------ PROFILO ------------------------------ */

async function aggiornaProfilo(req, res, next) {
  try {
    const dati = req.body || {};
    if (dati.avatar !== undefined && !immagineValida(dati.avatar)) {
      return res.status(400).json({ errore: 'Immagine del profilo non valida o troppo pesante' });
    }
    const utente = await userModel.aggiorna(req.utente.id, dati);
    if (!utente) return res.status(404).json({ errore: 'Utente non trovato' });
    res.json(utente);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/profile - cancella l'account e tutti i dati collegati. */
async function eliminaProfilo(req, res, next) {
  try {
    // l'account DEMO serve a tutti: non si puo' eliminare
    const utente = await userModel.trovaPerId(req.utente.id);
    if (utente && utente.demo) {
      return res.status(403).json({ errore: 'L’account DEMO non può essere eliminato' });
    }
    const ok = await userModel.elimina(req.utente.id);
    if (!ok) return res.status(404).json({ errore: 'Utente non trovato' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  annullaRichiesta,
  elencoPost, creaPost, eliminaPost,
  amici, utenti, profiloUtente, prenotazioniUtente, aggiungiAmico, rimuoviAmico,
  richieste, accettaRichiesta, rifiutaRichiesta,
  gruppi, membriGruppo, creaGruppo, entraNelGruppo, eliminaGruppo,
  candidatiSwipe, swipe,
  notifiche, leggiNotifiche,
  aggiornaProfilo, eliminaProfilo,
};
