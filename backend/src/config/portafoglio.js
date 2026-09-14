/**
 * SALDO SPORTEASY (portafoglio dell'utente).
 *
 * Regole:
 *  - quando una prenotazione gia' pagata viene annullata, l'importo versato
 *    non esce dall'app: torna come saldo, utilizzabile per i pagamenti
 *    successivi. Vale sia per l'organizzatore sia per chi si era aggiunto
 *    dal post pagando la propria quota;
 *  - al momento di pagare, l'utente puo' scegliere di scalare il saldo: la
 *    parte eventualmente scoperta si considera pagata con il metodo scelto
 *    (il pagamento e' comunque simulato, non c'e' nessun circuito reale);
 *  - la quota di chi si aggiunge a una prenotazione altrui (dal post o da un
 *    invito) non resta all'app: finisce sul saldo di chi ha organizzato, che
 *    ha gia' pagato l'intero campo. Se poi il partecipante esce, o la
 *    prenotazione viene annullata, la quota torna indietro dallo stesso saldo.
 *
 * Tutte le funzioni accettano `esegui` (client.query dentro una transazione,
 * oppure il query() globale) cosi' i movimenti di denaro restano atomici
 * insieme al cambio di stato della prenotazione.
 */
const { query } = require('./db');
const bookingModel = require('../models/bookingModel');
const userModel = require('../models/userModel');

/** Arrotonda ai centesimi: evita i residui dei float (0.1 + 0.2). */
const centesimi = (n) => Math.round(Number(n) * 100) / 100;

/** Decide quanto dell'importo copre il saldo e quanto la carta. */
function ripartisci(importo, saldoDisponibile, usaSaldo) {
  const totale = centesimi(Math.max(0, importo));
  const dalSaldo = usaSaldo ? centesimi(Math.min(saldoDisponibile, totale)) : 0;
  return { dalSaldo, dalMetodo: centesimi(totale - dalSaldo) };
}

/** Addebita un importo all'utente, scalando il saldo se richiesto. */
async function addebita(utenteId, importo, usaSaldo, esegui = query) {
  const saldo = await userModel.saldoDi(utenteId, esegui);
  const quote = ripartisci(importo, saldo, usaSaldo);
  if (quote.dalSaldo > 0) await userModel.muoviSaldo(utenteId, -quote.dalSaldo, esegui);
  return { ...quote, saldoResiduo: centesimi(saldo - quote.dalSaldo) };
}

/**
 * Sposta una quota da chi partecipa a chi ha organizzato.
 * L'addebito e' gia' avvenuto (vedi addebita): qui si accredita soltanto.
 */
async function accreditaOrganizzatore(organizzatoreId, importo, esegui = query) {
  const quota = centesimi(importo);
  if (quota > 0) await userModel.muoviSaldo(organizzatoreId, quota, esegui);
  return quota;
}

/**
 * Toglie dal saldo dell'organizzatore una quota che gli era stata accreditata
 * (un partecipante che esce, o una prenotazione annullata).
 * Il saldo non scende mai sotto zero: se nel frattempo l'organizzatore lo ha
 * gia' speso, quel che manca lo assorbe l'app, ma chi partecipava viene
 * comunque rimborsato per intero. Restituisce quanto e' riuscita a togliere.
 */
async function stornaOrganizzatore(organizzatoreId, importo, esegui = query) {
  const quota = centesimi(importo);
  if (quota <= 0) return 0;
  const disponibile = await userModel.saldoDi(organizzatoreId, esegui);
  const tolto = centesimi(Math.min(disponibile, quota));
  if (tolto > 0) await userModel.muoviSaldo(organizzatoreId, -tolto, esegui);
  return tolto;
}

/**
 * Rimborsa sul saldo tutto quello che era stato versato per una prenotazione:
 * la quota dell'organizzatore e quelle di chi si era aggiunto. Azzera gli
 * importi versati, cosi' un doppio annullamento non paga due volte.
 */
async function rimborsaPrenotazione(prenotazione, esegui = query) {
  let rimborsato = 0;

  if (prenotazione.pagato > 0) {
    await userModel.muoviSaldo(prenotazione.user_id, prenotazione.pagato, esegui);
    await bookingModel.segnaPagata(prenotazione.id, 0, esegui);
    rimborsato = centesimi(rimborsato + prenotazione.pagato);
  }

  // le quote dei partecipanti erano finite sul saldo dell'organizzatore:
  // tornano a chi le aveva versate, uscendo da quello stesso saldo
  const partecipanti = await bookingModel.partecipantiDaRimborsare(prenotazione.id, esegui);
  let quoteAltrui = 0;
  for (const p of partecipanti) {
    await userModel.muoviSaldo(p.user_id, p.pagato, esegui);
    quoteAltrui = centesimi(quoteAltrui + p.pagato);
    rimborsato = centesimi(rimborsato + p.pagato);
  }
  if (partecipanti.length > 0) {
    await bookingModel.azzeraQuote(prenotazione.id, esegui);
    await stornaOrganizzatore(prenotazione.user_id, quoteAltrui, esegui);
  }

  return rimborsato;
}

module.exports = {
  centesimi, ripartisci, addebita, rimborsaPrenotazione,
  accreditaOrganizzatore, stornaOrganizzatore,
};
