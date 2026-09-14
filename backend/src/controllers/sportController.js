/** CONTROLLER - Sport e campi. */
const sportModel = require('../models/sportModel');
const bookingModel = require('../models/bookingModel');

/** GET /api/sports */
async function elencoSport(req, res, next) {
  try {
    res.json(await sportModel.elencoSport());
  } catch (err) {
    next(err);
  }
}

/** GET /api/sports/:slug/venues */
async function campiPerSport(req, res, next) {
  try {
    const sport = await sportModel.sportPerSlug(req.params.slug);
    if (!sport) return res.status(404).json({ errore: 'Sport non trovato' });
    res.json({ sport, campi: await sportModel.campiPerSport(sport.slug) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/venues/:id  (opzionale ?data=YYYY-MM-DD per gli orari occupati) */
async function campo(req, res, next) {
  try {
    const campo = await sportModel.campoPerId(req.params.id);
    if (!campo) return res.status(404).json({ errore: 'Campo non trovato' });

    const risposta = { ...campo, orariOccupati: [] };
    if (req.query.data) {
      risposta.orariOccupati = await bookingModel.orariOccupati(campo.id, req.query.data);
    }
    res.json(risposta);
  } catch (err) {
    next(err);
  }
}

/** GET /api/venues?cerca=... */
async function cerca(req, res, next) {
  try {
    res.json(await sportModel.cercaCampi(req.query.cerca || ''));
  } catch (err) {
    next(err);
  }
}

module.exports = { elencoSport, campiPerSport, campo, cerca };
