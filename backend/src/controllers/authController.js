/**
 * CONTROLLER - Registrazione e login.
 * Le password vengono cifrate con bcrypt (vedi config/hash.js) e non tornano mai al client.
 */
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const notificationModel = require('../models/notificationModel');
const { hashPassword, verifyPassword } = require('../config/hash');
const demo = require('../config/demo');

const JWT_SECRET = process.env.JWT_SECRET || 'sporteasy-dev-secret';
const JWT_SCADENZA = '7d';

function creaToken(utente) {
  return jwt.sign({ id: utente.id, email: utente.email }, JWT_SECRET, { expiresIn: JWT_SCADENZA });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/auth/register */
async function register(req, res, next) {
  try {
    const { nome, email, password, confermaPassword } = req.body || {};

    if (!nome || !email || !password) {
      return res.status(400).json({ errore: 'Nome, email e password sono obbligatori' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ errore: 'Indirizzo email non valido' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ errore: 'La password deve avere almeno 6 caratteri' });
    }
    if (confermaPassword !== undefined && password !== confermaPassword) {
      return res.status(400).json({ errore: 'Le password non coincidono' });
    }
    if (await userModel.esisteEmail(email)) {
      return res.status(409).json({ errore: 'Esiste già un account con questa email' });
    }

    const passwordHash = await hashPassword(password);
    const utente = await userModel.creaUtente({ nome, email, passwordHash });

    await notificationModel.crea({
      userId: utente.id,
      titolo: 'Benvenuto su SportEasy',
      testo: 'Completa il profilo e trova i tuoi compagni di gioco',
      tipo: 'social',
      link: '/profilo/modifica',
    });

    res.status(201).json({ token: creaToken(utente), utente });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Si entra solo con l'email: gli username non sono piu' accettati.
 * L'account DEMO fa eccezione sulla sola password (non ne ha), ma la sua
 * email e' un indirizzo normale e viene validata come le altre. Per tutti gli
 * altri la password resta obbligatoria e viene verificata con bcrypt.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email) {
      return res.status(400).json({ errore: 'Email obbligatoria' });
    }
    if (!EMAIL_RE.test(String(email).trim())) {
      return res.status(400).json({ errore: 'Inserisci un indirizzo email valido' });
    }

    const senzaPassword = demo.eDemo(email);
    if (!senzaPassword && !password) {
      return res.status(400).json({ errore: 'Email e password sono obbligatorie' });
    }

    const utente = await userModel.trovaPerEmailConHash(email);
    if (!utente) return res.status(401).json({ errore: 'Credenziali non valide' });

    if (!senzaPassword) {
      const ok = await verifyPassword(password, utente.password_hash);
      if (!ok) return res.status(401).json({ errore: 'Credenziali non valide' });
    }

    // si rilegge con la proiezione pubblica: niente password_hash e con il
    // flag "demo" che il client usa per l'account DEMO
    const pubblico = await userModel.trovaPerId(utente.id);
    res.json({ token: creaToken(utente), utente: pubblico });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/demo
 * Accesso diretto all'account DEMO, senza credenziali da digitare: e' la
 * rotta usata dal tasto dedicato nella schermata di accesso. Se l'account non
 * esiste piu' viene ricreato al volo.
 */
async function accessoDiProva(req, res, next) {
  try {
    await demo.ripristinaSeMancante();

    const utente = await userModel.trovaPerEmailConHash(demo.DEMO_EMAIL);
    if (!utente) return res.status(500).json({ errore: 'Account DEMO non disponibile' });

    const pubblico = await userModel.trovaPerId(utente.id);
    res.json({ token: creaToken(utente), utente: pubblico });
  } catch (err) {
    next(err);
  }
}

/** GET /api/auth/me */
async function me(req, res, next) {
  try {
    const utente = await userModel.trovaPerId(req.utente.id);
    if (!utente) return res.status(404).json({ errore: 'Utente non trovato' });
    res.json(utente);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Il token JWT resta valido fino alla scadenza (l'app lo butta via da sola):
 * questa rotta serve a chiudere la sessione lato dati. Per l'account
 * dimostrativo riporta tutto allo stato iniziale, cosi' la prova successiva
 * riparte pulita; per gli altri utenti non tocca nulla.
 */
async function logout(req, res, next) {
  try {
    const utente = await userModel.trovaPerId(req.utente.id);
    if (!utente || !utente.demo) return res.json({ ok: true, ripristinato: false });

    await demo.ripristina();
    console.log('[demo] account DEMO riportato allo stato iniziale');
    res.json({ ok: true, ripristinato: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, accessoDiProva, logout, me };
