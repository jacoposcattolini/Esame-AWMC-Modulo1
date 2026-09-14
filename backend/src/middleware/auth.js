/** Middleware di autenticazione: verifica il JWT e popola req.utente. */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sporteasy-dev-secret';

function richiediAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ errore: 'Token mancante' });

  try {
    const dati = jwt.verify(token, JWT_SECRET);

    // Il token dell'amministratore e' firmato con lo stesso segreto ma non
    // rappresenta un utente (non ha un id): va rifiutato qui, altrimenti
    // arriverebbe ai Model come id "undefined". Le due sessioni restano
    // separate: l'admin passa solo da /api/admin/*.
    if (dati.ruolo === 'admin' || !dati.id) {
      return res.status(401).json({ errore: 'Questo token non vale per le rotte utente' });
    }

    req.utente = dati;
    next();
  } catch (err) {
    res.status(401).json({ errore: 'Token non valido o scaduto' });
  }
}

module.exports = { richiediAuth };
