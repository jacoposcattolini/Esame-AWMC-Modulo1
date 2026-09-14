/**
 * CONTROLLER - Metodi di pagamento del profilo.
 *
 * Non c'e' nessun gateway di pagamento collegato: qui si gestiscono soltanto i
 * dati (elenco, aggiunta, modifica, eliminazione, carta predefinita).
 * Il numero completo della carta non viene mai accettato ne' salvato: il
 * client invia solo le ultime quattro cifre.
 */
const paymentModel = require('../models/paymentModel');

const CIRCUITI = ['Visa', 'Mastercard', 'Maestro', 'American Express', 'Carta'];

/** Controlla i dati in arrivo e li normalizza; restituisce { errore } se non vanno. */
function validaCarta(corpo, parziale = false) {
  const dati = {};
  const c = corpo || {};

  const richiesto = (campo) => !parziale || c[campo] !== undefined;

  if (richiesto('intestatario')) {
    const intestatario = String(c.intestatario || '').trim();
    if (intestatario.length < 2 || intestatario.length > 80) {
      return { errore: 'Intestatario mancante o troppo lungo' };
    }
    dati.intestatario = intestatario;
  }

  if (richiesto('ultime4')) {
    const ultime4 = String(c.ultime4 || '').trim();
    if (!/^\d{4}$/.test(ultime4)) {
      return { errore: 'Servono le ultime 4 cifre della carta' };
    }
    dati.ultime4 = ultime4;
  }

  if (richiesto('scadenza_mese') || richiesto('scadenza_anno')) {
    const mese = Number(c.scadenza_mese);
    const anno = Number(c.scadenza_anno);
    if (!Number.isInteger(mese) || mese < 1 || mese > 12) {
      return { errore: 'Mese di scadenza non valido' };
    }
    if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) {
      return { errore: 'Anno di scadenza non valido' };
    }
    // una carta gia' scaduta non ha senso salvarla
    const adesso = new Date();
    if (anno < adesso.getFullYear() ||
        (anno === adesso.getFullYear() && mese < adesso.getMonth() + 1)) {
      return { errore: 'La carta risulta già scaduta' };
    }
    dati.scadenza_mese = mese;
    dati.scadenza_anno = anno;
  }

  if (c.circuito !== undefined) {
    dati.circuito = CIRCUITI.includes(c.circuito) ? c.circuito : 'Carta';
  } else if (!parziale) {
    dati.circuito = 'Carta';
  }

  if (c.predefinito !== undefined) dati.predefinito = c.predefinito === true;

  return { dati };
}

/** GET /api/payment-methods */
async function elenco(req, res, next) {
  try {
    res.json(await paymentModel.elenco(req.utente.id));
  } catch (err) {
    next(err);
  }
}

/** POST /api/payment-methods */
async function crea(req, res, next) {
  try {
    const { errore, dati } = validaCarta(req.body);
    if (errore) return res.status(400).json({ errore });

    if ((await paymentModel.conta(req.utente.id)) >= 8) {
      return res.status(409).json({ errore: 'Hai già salvato il numero massimo di carte' });
    }

    res.status(201).json(await paymentModel.crea(req.utente.id, dati));
  } catch (err) {
    next(err);
  }
}

/** PUT /api/payment-methods/:id */
async function aggiorna(req, res, next) {
  try {
    const { errore, dati } = validaCarta(req.body, true);
    if (errore) return res.status(400).json({ errore });

    const carta = await paymentModel.aggiorna(req.params.id, req.utente.id, dati);
    if (!carta) return res.status(404).json({ errore: 'Metodo di pagamento non trovato' });
    res.json(carta);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/payment-methods/:id */
async function elimina(req, res, next) {
  try {
    const ok = await paymentModel.elimina(req.params.id, req.utente.id);
    if (!ok) return res.status(404).json({ errore: 'Metodo di pagamento non trovato' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { elenco, crea, aggiorna, elimina };
