/**
 * Autenticazione dell'amministratore, tenuta separata da quella degli utenti:
 * credenziali che stanno solo nelle variabili d'ambiente, endpoint dedicato
 * (POST /api/admin/login) e un token con { ruolo: 'admin' } e senza id, che
 * quindi non vale sulle rotte utente (vedi auth.js).
 * La password si puo' configurare come hash bcrypt (ADMIN_PASSWORD_HASH,
 * consigliato) oppure in chiaro (ADMIN_PASSWORD).
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { verifyPassword } = require('../config/hash');

const UTENTE = process.env.ADMIN_USERNAME || process.env.ADMIN_USER || '';
const PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const PASSWORD = process.env.ADMIN_PASSWORD || '';
const SEGRETO = process.env.ADMIN_SECRET || process.env.JWT_SECRET || 'sporteasy-admin-secret';

const DURATA_ORE = 8;

// freno ai tentativi a raffica: l'accesso admin ora e' un endpoint pubblico
const MAX_TENTATIVI = 5;
const BLOCCO_MINUTI = 5;
const tentativi = new Map(); // ip -> { falliti, bloccatoFino }

if (!UTENTE || (!PASSWORD_HASH && !PASSWORD)) {
  console.warn('[admin] credenziali non configurate: l\'accesso al pannello resta chiuso');
}

/**
 * Confronto a tempo costante: due stringhe diverse impiegano lo stesso tempo
 * di due uguali, cosi' dai tempi di risposta non si ricava la credenziale.
 */
function ugualiInSicurezza(a, b) {
  // si confrontano sempre due digest della stessa lunghezza
  const primo = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const secondo = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(primo, secondo);
}

async function credenzialiValide(utente, password) {
  if (!UTENTE || (!PASSWORD_HASH && !PASSWORD)) return false;

  // i due controlli si eseguono sempre entrambi: niente scorciatoie che
  // farebbero capire, dal tempo di risposta, quale dei due e' sbagliato
  const utenteOk = ugualiInSicurezza(utente || '', UTENTE);

  let passwordOk = false;
  if (PASSWORD_HASH) {
    try {
      passwordOk = await verifyPassword(String(password || ''), PASSWORD_HASH);
    } catch {
      console.error('[admin] ADMIN_PASSWORD_HASH non e\' un hash bcrypt valido');
    }
  } else {
    passwordOk = ugualiInSicurezza(password || '', PASSWORD);
  }

  return utenteOk && passwordOk;
}

/** Token di sessione dell'amministratore (nessun id utente al suo interno). */
function creaTokenAdmin() {
  return jwt.sign({ ruolo: 'admin', utente: UTENTE }, SEGRETO, { expiresIn: `${DURATA_ORE}h` });
}

/* --------------------- freno ai tentativi falliti ----------------------- */

/** Minuti di attesa rimasti, 0 se l'indirizzo puo' tentare l'accesso. */
function attesaRimasta(ip) {
  const voce = tentativi.get(ip);
  if (!voce || !voce.bloccatoFino) return 0;
  const rimasti = voce.bloccatoFino - Date.now();
  if (rimasti <= 0) {
    tentativi.delete(ip);
    return 0;
  }
  return Math.ceil(rimasti / 60000);
}

function segnalaFallimento(ip) {
  const voce = tentativi.get(ip) || { falliti: 0, bloccatoFino: 0 };
  voce.falliti += 1;
  if (voce.falliti >= MAX_TENTATIVI) {
    voce.falliti = 0;
    voce.bloccatoFino = Date.now() + BLOCCO_MINUTI * 60000;
  }
  tentativi.set(ip, voce);
}

function azzeraTentativi(ip) {
  tentativi.delete(ip);
}

/**
 * Protegge le rotte /api/admin/*: serve un token con ruolo admin.
 * Risponde in JSON (il backend non ha pagine: non c'e' nessun redirect).
 */
function richiediAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ errore: 'Accesso amministratore richiesto' });

  try {
    const dati = jwt.verify(token, SEGRETO);
    if (dati.ruolo !== 'admin') return res.status(403).json({ errore: 'Permessi insufficienti' });
    req.admin = dati;
    next();
  } catch {
    res.status(401).json({ errore: 'Sessione scaduta: rientra nel pannello' });
  }
}

module.exports = {
  UTENTE,
  DURATA_ORE,
  credenzialiValide,
  creaTokenAdmin,
  richiediAdmin,
  attesaRimasta,
  segnalaFallimento,
  azzeraTentativi,
};
