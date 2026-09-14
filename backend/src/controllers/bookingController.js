/** CONTROLLER - Prenotazioni + pagamento simulato. */
const bookingModel = require('../models/bookingModel');
const sportModel = require('../models/sportModel');
const notificationModel = require('../models/notificationModel');
const userModel = require('../models/userModel');
const paymentModel = require('../models/paymentModel');
const socialModel = require('../models/socialModel');
const messageModel = require('../models/messageModel');
const { slotPassato } = require('../config/orario');
const { pool } = require('../config/db');
const portafoglio = require('../config/portafoglio');

/**
 * Controlla che l'utente possa davvero coprire l'importo: quello che il saldo
 * non copre va pagato con una carta, e senza carte salvate il pagamento non
 * puo' andare a buon fine. Restituisce il messaggio d'errore da mostrare,
 * oppure '' se si puo' procedere.
 */
async function controllaFondi(utenteId, importo, usaSaldo) {
  const totale = portafoglio.centesimi(importo);
  if (totale <= 0) return '';

  const saldo = await userModel.saldoDi(utenteId);
  const { dalMetodo } = portafoglio.ripartisci(totale, saldo, usaSaldo);
  if (dalMetodo <= 0) return '';

  if (await paymentModel.conta(utenteId) > 0) return '';

  return saldo > 0 && usaSaldo
    ? `Saldo insufficiente: mancano ${dalMetodo.toFixed(2)} € e non hai nessuna carta salvata. Aggiungine una dal profilo per completare il pagamento.`
    : 'Nessun metodo di pagamento disponibile: aggiungi una carta dal profilo o usa il saldo SportEasy.';
}

/** GET /api/bookings - prenotazioni dell'utente loggato */
async function mie(req, res, next) {
  try {
    res.json(await bookingModel.perUtente(req.utente.id));
  } catch (err) {
    next(err);
  }
}

/** POST /api/bookings */
async function crea(req, res, next) {
  try {
    const { venueId, data, ora, partecipanti } = req.body || {};
    if (!venueId || !data || !ora) {
      return res.status(400).json({ errore: 'Campo, data e ora sono obbligatori' });
    }
    const n = Number(partecipanti) || 1;
    if (n < 1) {
      return res.status(400).json({ errore: 'Numero di partecipanti non valido' });
    }

    // Controllo definitivo sull'orario: il confronto usa l'ora dei campi
    // (Europe/Rome), non quella del server ne' quella del telefono.
    if (slotPassato(data, ora)) {
      return res.status(400).json({ errore: 'Questo orario è già passato, scegline uno successivo' });
    }

    const campo = await sportModel.campoPerId(venueId);
    if (!campo) return res.status(404).json({ errore: 'Campo non trovato' });

    // ogni sport ha il suo tetto di partecipanti (vedi sports.max_partecipanti)
    if (n > campo.max_partecipanti) {
      return res.status(400).json({
        errore: `${campo.sport_nome}: al massimo ${campo.max_partecipanti} partecipanti per prenotazione`,
      });
    }

    const occupati = await bookingModel.orariOccupati(campo.id, data);
    if (occupati.includes(ora)) {
      return res.status(409).json({ errore: 'Questo orario è già prenotato, scegline un altro' });
    }

    const prenotazione = await bookingModel.crea({
      userId: req.utente.id,
      venueId: campo.id,
      data,
      ora,
      partecipanti: n,
      totale: Number(campo.prezzo) * n,
      stato: 'in_attesa',
    });

    res.status(201).json(prenotazione);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/bookings/:id/pay - conferma il pagamento (simulato).
 * Con { usaSaldo: true } l'importo viene scalato dal saldo SportEasy; quel
 * che resta scoperto si considera pagato con il metodo scelto.
 * Saldo e stato cambiano nella stessa transazione: o entrambi o nessuno.
 */
async function paga(req, res, next) {
  const usaSaldo = (req.body || {}).usaSaldo === true;

  // prima di toccare qualsiasi cosa: l'utente puo' coprire l'importo?
  const attesa = await bookingModel.perId(req.params.id);
  if (attesa && attesa.user_id === req.utente.id) {
    const problema = await controllaFondi(req.utente.id, attesa.totale, usaSaldo);
    if (problema) return res.status(400).json({ errore: problema });
  }

  const client = await pool.connect();
  const esegui = (t, v) => client.query(t, v);
  try {
    await client.query('BEGIN');

    const prenotazione = await bookingModel.aggiornaStato(
      req.params.id, req.utente.id, 'confermata', esegui
    );
    if (!prenotazione) {
      await client.query('ROLLBACK');
      return res.status(404).json({ errore: 'Prenotazione non trovata' });
    }

    const conto = await portafoglio.addebita(req.utente.id, prenotazione.totale, usaSaldo, esegui);
    await bookingModel.segnaPagata(prenotazione.id, prenotazione.totale, esegui);

    await client.query('COMMIT');

    await notificationModel.crea({
      userId: req.utente.id,
      titolo: 'Prenotazione',
      testo: `La tua prenotazione a ${prenotazione.campo} è stata confermata`,
      tipo: 'prenotazione',
      link: '/prenotazioni',
    });

    res.json({ ...(await bookingModel.perId(prenotazione.id)), conto });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/bookings/:id - annulla la prenotazione.
 * Quello che era stato versato (dall'organizzatore e da chi si era aggiunto)
 * torna sul saldo SportEasy di ciascuno, non fuori dall'app.
 *
 * Una prenotazione la cui ora e' gia' cominciata non si annulla piu': la
 * partita e' andata, e rimborsarla significherebbe restituire i soldi di
 * un'attivita' gia' avvenuta (togliendoli, fra l'altro, all'organizzatore che
 * aveva incassato le quote). Il confronto usa l'ora dei campi (Europe/Rome),
 * non quella del server ne' quella del telefono.
 */
async function annulla(req, res, next) {
  const attesa = await bookingModel.perId(req.params.id);
  if (attesa && attesa.user_id === req.utente.id &&
      attesa.stato !== 'annullata' && slotPassato(attesa.data, attesa.ora)) {
    return res.status(409).json({
      errore: 'Questa prenotazione è già passata: non può più essere annullata',
    });
  }

  const client = await pool.connect();
  const esegui = (t, v) => client.query(t, v);
  try {
    await client.query('BEGIN');

    const prima = await bookingModel.perId(req.params.id);
    const prenotazione = await bookingModel.aggiornaStato(
      req.params.id, req.utente.id, 'annullata', esegui
    );
    if (!prenotazione) {
      await client.query('ROLLBACK');
      return res.status(404).json({ errore: 'Prenotazione non trovata' });
    }

    const rimborsato = prima ? await portafoglio.rimborsaPrenotazione(prima, esegui) : 0;
    await client.query('COMMIT');

    const finale = await bookingModel.perId(prenotazione.id);

    if (rimborsato > 0) {
      await notificationModel.crea({
        userId: req.utente.id,
        titolo: 'Rimborso accreditato',
        testo: `${prima.pagato.toFixed(2)} € sono tornati sul tuo saldo SportEasy`,
        tipo: 'prenotazione',
        link: '/profilo',
      });
    }

    res.json({ ...finale, rimborsato });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

/** Controlli comuni a "posso aggiungermi?": restituisce { errore, stato } oppure { prenotazione }. */
async function verificaPartecipazione(id, utenteId) {
  const prenotazione = await bookingModel.perId(id);
  if (!prenotazione) return { stato: 404, errore: 'Prenotazione non trovata' };
  if (prenotazione.stato === 'annullata') {
    return { stato: 409, errore: 'Questa prenotazione è stata annullata' };
  }
  if (prenotazione.user_id === utenteId) {
    return { stato: 400, errore: 'Questa prenotazione è già tua' };
  }
  if (await bookingModel.partecipa(id, utenteId)) {
    return { stato: 409, errore: 'Fai già parte di questa prenotazione' };
  }
  if (prenotazione.iscritti >= prenotazione.posti) {
    return {
      stato: 409,
      errore: `Posti esauriti: questa prenotazione è al completo (${prenotazione.posti} partecipanti)`,
    };
  }
  return { prenotazione };
}

/**
 * GET /api/bookings/:id/join - riepilogo prima di aggiungersi.
 * Serve alla schermata di pagamento della partecipazione: dice quanto costa
 * la quota e quanto saldo e' disponibile, senza iscrivere nessuno.
 */
async function riepilogoPartecipazione(req, res, next) {
  try {
    const esito = await verificaPartecipazione(req.params.id, req.utente.id);
    if (esito.errore) return res.status(esito.stato).json({ errore: esito.errore });

    res.json({
      prenotazione: esito.prenotazione,
      quota: portafoglio.centesimi(esito.prenotazione.prezzo),
      saldo: await userModel.saldoDi(req.utente.id),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/bookings/:id/join - ci si aggiunge alla prenotazione di un altro
 * utente (dal post nel feed), pagando la propria quota (il prezzo a persona
 * del campo). Con { usaSaldo: true } la quota viene scalata dal saldo.
 * Iscrizione e pagamento stanno nella stessa transazione.
 */
async function partecipa(req, res, next) {
  let client;
  try {
    const esito = await verificaPartecipazione(req.params.id, req.utente.id);
    if (esito.errore) return res.status(esito.stato).json({ errore: esito.errore });

    const prenotazione = esito.prenotazione;
    const quota = portafoglio.centesimi(prenotazione.prezzo);
    const usaSaldo = (req.body || {}).usaSaldo === true;

    const problema = await controllaFondi(req.utente.id, quota, usaSaldo);
    if (problema) return res.status(400).json({ errore: problema });

    client = await pool.connect();
    const esegui = (t, v) => client.query(t, v);
    await client.query('BEGIN');
    const conto = quota > 0
      ? await portafoglio.addebita(req.utente.id, quota, usaSaldo, esegui)
      : { dalSaldo: 0, dalMetodo: 0 };

    const nuovo = await bookingModel.aggiungiPartecipante(prenotazione.id, req.utente.id, quota, esegui);
    if (nuovo) {
      // la quota va a chi ha organizzato: e' lui ad aver pagato tutto il campo
      await portafoglio.accreditaOrganizzatore(prenotazione.user_id, quota, esegui);
      // se era arrivato un invito, ora risulta accettato (lo legge la chat)
      await bookingModel.rispondiInvito(prenotazione.id, req.utente.id, 'accettato', esegui);
    }
    await client.query('COMMIT');

    // due notifiche: l'avviso a chi ha organizzato (e pubblicato il post) e
    // la conferma a chi si e' appena aggiunto
    if (nuovo) {
      const io = await userModel.trovaPerId(req.utente.id);
      await notificationModel.crea({
        userId: prenotazione.user_id,
        titolo: io.nome,
        testo: quota > 0
          ? `Si è aggiunto alla tua prenotazione a ${prenotazione.campo}: ${quota.toFixed(2)} € sul tuo saldo SportEasy`
          : `Si è aggiunto alla tua prenotazione a ${prenotazione.campo}`,
        avatar: io.avatar,
        tipo: 'prenotazione',
        link: '/prenotazioni',
        autoreId: io.id,
      });
      await notificationModel.crea({
        userId: io.id,
        titolo: 'Prenotazione',
        testo: `Ti sei aggiunto alla prenotazione di ${prenotazione.organizzatore} a ${prenotazione.campo}`,
        tipo: 'prenotazione',
        link: '/prenotazioni',
      });
    }
    res.json({ ...(await bookingModel.perId(prenotazione.id)), conto });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    if (client) client.release();
  }
}

/**
 * Testo che accompagna la scheda della prenotazione in chat. Serve anche alle
 * anteprime della lista conversazioni, che mostrano solo il testo.
 */
function testoInvito(prenotazione) {
  const quando = `${new Date(prenotazione.data).toLocaleDateString('it-IT')} alle ${prenotazione.ora}`;
  return `Ti va di unirti? ${prenotazione.sport} a ${prenotazione.campo}, ${quando}`;
}

/**
 * POST /api/bookings/:id/invite - invita amici e gruppi a una prenotazione.
 *
 * Puo' farlo solo chi ha organizzato, e solo finche' restano posti liberi:
 * gli inviti non possono superare i posti ancora disponibili, che dipendono
 * dal tetto di partecipanti dello sport.
 * Ogni invitato riceve una notifica e, soprattutto, la prenotazione gli arriva
 * in chat come scheda con i tasti per partecipare o rifiutare: nella chat
 * diretta se e' stato scelto fra gli amici, nella chat del gruppo se e' stato
 * invitato tutto il gruppo.
 */
async function invita(req, res, next) {
  try {
    const prenotazione = await bookingModel.perId(req.params.id);
    if (!prenotazione) return res.status(404).json({ errore: 'Prenotazione non trovata' });
    if (prenotazione.user_id !== req.utente.id) {
      return res.status(403).json({ errore: 'Puoi invitare solo alle prenotazioni che hai creato' });
    }
    if (prenotazione.stato === 'annullata') {
      return res.status(409).json({ errore: 'Questa prenotazione è stata annullata' });
    }
    if (slotPassato(prenotazione.data, prenotazione.ora)) {
      return res.status(409).json({ errore: 'Questa prenotazione è già passata' });
    }

    const liberi = prenotazione.posti - prenotazione.iscritti;
    if (liberi <= 0) {
      return res.status(409).json({
        errore: `Nessun posto libero: la prenotazione è al completo (${prenotazione.posti} partecipanti)`,
      });
    }

    const corpo = req.body || {};
    const amici = await socialModel.amiciDi(req.utente.id);
    const consentiti = new Set(amici.map((a) => a.id));

    // si tengono separati amici e gruppi: servono a sapere in quale chat
    // mandare la scheda della prenotazione
    const amiciScelti = Array.isArray(corpo.amici)
      ? [...new Set(corpo.amici.map(Number).filter((id) => consentiti.has(id)))]
      : [];
    const gruppiScelti = [];
    if (Array.isArray(corpo.gruppi)) {
      for (const groupId of [...new Set(corpo.gruppi.map(Number))]) {
        if (await socialModel.eMembro(groupId, req.utente.id)) gruppiScelti.push(groupId);
      }
    }

    // destinatari: gli amici scelti piu' i membri dei gruppi scelti. Niente
    // doppioni (chi e' amico ed e' anche nel gruppo conta una volta sola),
    // niente organizzatore.
    const destinatari = new Set(amiciScelti);
    for (const groupId of gruppiScelti) {
      for (const m of await socialModel.membriGruppo(groupId)) destinatari.add(m.id);
    }
    destinatari.delete(req.utente.id);

    // chi c'e' gia' non va invitato di nuovo
    for (const id of [...destinatari]) {
      if (await bookingModel.partecipa(prenotazione.id, id)) destinatari.delete(id);
    }

    if (destinatari.size === 0) {
      return res.status(400).json({ errore: 'Nessuno da invitare: scegli amici o gruppi che non fanno già parte della prenotazione' });
    }
    if (destinatari.size > liberi) {
      return res.status(400).json({
        errore: `Restano solo ${liberi} ${liberi === 1 ? 'posto libero' : 'posti liberi'}: stai invitando ${destinatari.size} persone`,
      });
    }

    const io = await userModel.trovaPerId(req.utente.id);
    const quando = `${new Date(prenotazione.data).toLocaleDateString('it-IT')} alle ${prenotazione.ora}`;

    await bookingModel.creaInviti(prenotazione.id, [...destinatari]);

    for (const id of destinatari) {
      await notificationModel.crea({
        userId: id,
        titolo: io.nome,
        testo: `Ti ha invitato a ${prenotazione.sport} a ${prenotazione.campo}, ${quando}`,
        avatar: io.avatar,
        tipo: 'prenotazione',
        link: `/partecipa/${prenotazione.id}`,
        autoreId: io.id,
      });
    }

    // l'invito arriva anche in chat, come scheda della prenotazione
    const testo = testoInvito(prenotazione);
    for (const id of amiciScelti) {
      if (destinatari.has(id)) await messageModel.inviaDiretto(io.id, id, testo, prenotazione.id);
    }
    for (const groupId of gruppiScelti) {
      await messageModel.inviaAlGruppo(io.id, groupId, testo, prenotazione.id);
    }

    res.json({ invitati: destinatari.size, liberi: liberi - destinatari.size });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/bookings/:id/invite/decline - si rifiuta un invito ricevuto.
 * Il posto non era occupato, quindi per gli altri non cambia nulla: la scheda
 * in chat smette di proporre "partecipa" e chi ha invitato viene avvisato.
 */
async function rifiutaInvito(req, res, next) {
  try {
    const prenotazione = await bookingModel.perId(req.params.id);
    if (!prenotazione) return res.status(404).json({ errore: 'Prenotazione non trovata' });

    const ok = await bookingModel.rispondiInvito(prenotazione.id, req.utente.id, 'rifiutato');
    if (!ok) return res.status(404).json({ errore: 'Non hai nessun invito per questa prenotazione' });

    const io = await userModel.trovaPerId(req.utente.id);
    await notificationModel.crea({
      userId: prenotazione.user_id,
      titolo: io.nome,
      testo: `Non può partecipare alla tua prenotazione a ${prenotazione.campo}`,
      avatar: io.avatar,
      tipo: 'prenotazione',
      link: '/prenotazioni',
      autoreId: io.id,
    });

    res.json({ ok: true, stato: 'rifiutato' });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/bookings/:id/join - ci si toglie da una prenotazione altrui.
 * La quota versata torna sul saldo SportEasy.
 *
 * Come per l'annullamento, a partita cominciata non si esce piu': la quota
 * uscirebbe dal saldo dell'organizzatore per un campo ormai giocato.
 */
async function abbandona(req, res, next) {
  const attesa = await bookingModel.perId(req.params.id);
  if (attesa && attesa.stato !== 'annullata' && slotPassato(attesa.data, attesa.ora)) {
    return res.status(409).json({
      errore: 'Questa prenotazione è già passata: non puoi più uscirne',
    });
  }

  const client = await pool.connect();
  const esegui = (t, v) => client.query(t, v);
  try {
    await client.query('BEGIN');

    const prenotazione = await bookingModel.perId(req.params.id, esegui);
    const quota = await bookingModel.quotaPartecipante(req.params.id, req.utente.id, esegui);
    const ok = await bookingModel.rimuoviPartecipante(req.params.id, req.utente.id, esegui);
    if (!ok) {
      await client.query('ROLLBACK');
      return res.status(404).json({ errore: 'Non fai parte di questa prenotazione' });
    }
    if (quota > 0) {
      // la quota torna a chi esce, uscendo dal saldo dell'organizzatore
      await userModel.muoviSaldo(req.utente.id, quota, esegui);
      if (prenotazione) await portafoglio.stornaOrganizzatore(prenotazione.user_id, quota, esegui);
    }

    await client.query('COMMIT');
    res.json({ ...(await bookingModel.perId(req.params.id)), rimborsato: quota });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  mie, crea, paga, annulla, partecipa, abbandona, riepilogoPartecipazione,
  invita, rifiutaInvito, testoInvito,
};
