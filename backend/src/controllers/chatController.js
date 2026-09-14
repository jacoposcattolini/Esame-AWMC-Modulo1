/**
 * CONTROLLER - Chat dirette (fra amici) e chat di gruppo.
 * L'accesso e' consentito solo a chi ha davvero titolo per leggere:
 * la chat diretta agli amici, quella di gruppo ai membri del gruppo.
 *
 * Un messaggio puo' portare con se' una propria prenotazione (bookingId):
 * e' l'invito, che nella chat diventa una scheda con i tasti per partecipare
 * o rifiutare. Vale lo stesso controllo della schermata prenotazioni: si puo'
 * condividere solo una prenotazione propria, aperta e con posti liberi.
 */
const messageModel = require('../models/messageModel');
const socialModel = require('../models/socialModel');
const userModel = require('../models/userModel');
const bookingModel = require('../models/bookingModel');
const bookingController = require('./bookingController');
const { slotPassato } = require('../config/orario');

const MAX_LUNGHEZZA = 1000;

/**
 * Testo del messaggio: obbligatorio, tranne quando si allega una
 * prenotazione (in quel caso lo scrive l'app).
 */
function testoValido(req, res, obbligatorio = true) {
  const testo = ((req.body && req.body.testo) || '').trim();
  if (!testo && obbligatorio) {
    res.status(400).json({ errore: 'Il messaggio non può essere vuoto' });
    return null;
  }
  if (testo.length > MAX_LUNGHEZZA) {
    res.status(400).json({ errore: `Messaggio troppo lungo (max ${MAX_LUNGHEZZA} caratteri)` });
    return null;
  }
  return testo;
}

/**
 * Controlla la prenotazione che si vuole allegare al messaggio.
 * Se non c'e' niente da allegare torna un oggetto vuoto, altrimenti la
 * prenotazione oppure l'errore da mostrare.
 */
async function prenotazioneDaAllegare(req) {
  const bookingId = req.body && req.body.bookingId;
  if (!bookingId) return {};

  const prenotazione = await bookingModel.perId(bookingId);
  if (!prenotazione) return { stato: 404, errore: 'Prenotazione non trovata' };
  if (prenotazione.user_id !== req.utente.id) {
    return { stato: 403, errore: 'Puoi condividere solo le prenotazioni che hai creato' };
  }
  if (prenotazione.stato === 'annullata') {
    return { stato: 409, errore: 'Questa prenotazione è stata annullata' };
  }
  if (slotPassato(prenotazione.data, prenotazione.ora)) {
    return { stato: 409, errore: 'Questa prenotazione è già passata' };
  }
  if (prenotazione.iscritti >= prenotazione.posti) {
    return { stato: 409, errore: `Nessun posto libero: la prenotazione è al completo (${prenotazione.posti} partecipanti)` };
  }
  return { prenotazione };
}

/* ----------------------------- CHAT DIRETTE ----------------------------- */

/** GET /api/chats/users/:id */
async function conversazioneUtente(req, res, next) {
  try {
    const altro = await userModel.trovaPerId(req.params.id);
    if (!altro) return res.status(404).json({ errore: 'Utente non trovato' });
    if (!(await socialModel.sonoAmici(req.utente.id, altro.id))) {
      return res.status(403).json({ errore: 'Puoi scrivere solo alle persone con cui sei amico' });
    }

    res.json({
      tipo: 'utente',
      titolo: altro.nome,
      immagine: altro.avatar,
      sottotitolo: altro.sport || '',
      utenteId: altro.id,
      messaggi: await messageModel.conversazioneDiretta(req.utente.id, altro.id),
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/chats/users/:id  (testo e/o { bookingId } da allegare) */
async function inviaAUtente(req, res, next) {
  try {
    const allegato = await prenotazioneDaAllegare(req);
    if (allegato.errore) return res.status(allegato.stato).json({ errore: allegato.errore });

    const testo = testoValido(req, res, !allegato.prenotazione);
    if (testo === null) return;

    const altro = await userModel.trovaPerId(req.params.id);
    if (!altro) return res.status(404).json({ errore: 'Utente non trovato' });
    if (!(await socialModel.sonoAmici(req.utente.id, altro.id))) {
      return res.status(403).json({ errore: 'Puoi scrivere solo alle persone con cui sei amico' });
    }

    const prenotazione = allegato.prenotazione;
    if (prenotazione) {
      // condividere una prenotazione in chat e' un invito a tutti gli effetti
      await bookingModel.creaInviti(prenotazione.id, [altro.id]);
    }

    const messaggio = await messageModel.inviaDiretto(
      req.utente.id,
      altro.id,
      testo || bookingController.testoInvito(prenotazione),
      prenotazione ? prenotazione.id : null
    );
    res.status(201).json(messaggio);
  } catch (err) {
    next(err);
  }
}

/* ---------------------------- CHAT DI GRUPPO ---------------------------- */

/** GET /api/chats/groups/:id */
async function conversazioneGruppo(req, res, next) {
  try {
    const gruppo = await socialModel.gruppoPerId(req.params.id);
    if (!gruppo) return res.status(404).json({ errore: 'Gruppo non trovato' });
    if (!(await socialModel.eMembro(gruppo.id, req.utente.id))) {
      return res.status(403).json({ errore: 'Non fai parte di questo gruppo' });
    }

    res.json({
      tipo: 'gruppo',
      titolo: gruppo.nome,
      immagine: gruppo.immagine,
      sottotitolo: `${gruppo.membri} membri`,
      messaggi: await messageModel.conversazioneGruppo(gruppo.id, req.utente.id),
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/chats/groups/:id  (testo e/o { bookingId } da allegare) */
async function inviaAlGruppo(req, res, next) {
  try {
    const allegato = await prenotazioneDaAllegare(req);
    if (allegato.errore) return res.status(allegato.stato).json({ errore: allegato.errore });

    const testo = testoValido(req, res, !allegato.prenotazione);
    if (testo === null) return;

    const gruppo = await socialModel.gruppoPerId(req.params.id);
    if (!gruppo) return res.status(404).json({ errore: 'Gruppo non trovato' });
    if (!(await socialModel.eMembro(gruppo.id, req.utente.id))) {
      return res.status(403).json({ errore: 'Non fai parte di questo gruppo' });
    }

    const prenotazione = allegato.prenotazione;
    if (prenotazione) {
      // invito per tutti i membri del gruppo, tranne chi lo manda
      const membri = await socialModel.membriGruppo(gruppo.id);
      await bookingModel.creaInviti(
        prenotazione.id,
        membri.map((m) => m.id).filter((id) => id !== req.utente.id)
      );
    }

    const messaggio = await messageModel.inviaAlGruppo(
      req.utente.id,
      gruppo.id,
      testo || bookingController.testoInvito(prenotazione),
      prenotazione ? prenotazione.id : null
    );
    res.status(201).json(messaggio);
  } catch (err) {
    next(err);
  }
}

/* ------------------------------- ANTEPRIME ------------------------------- */

/** GET /api/chats - ultimo messaggio di ogni conversazione (per le liste). */
async function anteprime(req, res, next) {
  try {
    const [amici, gruppi] = await Promise.all([
      messageModel.ultimiPerAmici(req.utente.id),
      messageModel.ultimiPerGruppi(req.utente.id),
    ]);
    res.json({ amici, gruppi });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  conversazioneUtente, inviaAUtente,
  conversazioneGruppo, inviaAlGruppo,
  anteprime,
};
