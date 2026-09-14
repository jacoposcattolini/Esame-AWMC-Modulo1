/**
 * ROUTES - mappa gli URL sui metodi dei Controller.
 * Il backend espone SOLO dati: ogni rotta sta sotto /api e risponde in JSON.
 * Le rotte di amministrazione stanno sotto /api/admin e vogliono il token
 * dell'amministratore (middleware/adminAuth.js), separato da quello utente.
 */
const express = require('express');
const { richiediAuth } = require('../middleware/auth');

const authController = require('../controllers/authController');
const sportController = require('../controllers/sportController');
const bookingController = require('../controllers/bookingController');
const socialController = require('../controllers/socialController');
const chatController = require('../controllers/chatController');
const adminController = require('../controllers/adminController');
const paymentController = require('../controllers/paymentController');
const { richiediAdmin } = require('../middleware/adminAuth');

const api = express.Router();

/* ------------------------------- AUTH -------------------------------- */
api.post('/auth/register', authController.register);
api.post('/auth/login', authController.login);
api.post('/auth/demo', authController.accessoDiProva);
api.post('/auth/logout', richiediAuth, authController.logout);
api.get('/auth/me', richiediAuth, authController.me);

/* --------------------------- SPORT E CAMPI --------------------------- */
api.get('/sports', sportController.elencoSport);
api.get('/sports/:slug/venues', sportController.campiPerSport);
api.get('/venues', sportController.cerca);
api.get('/venues/:id', sportController.campo);

/* --------------------------- PRENOTAZIONI ---------------------------- */
api.get('/bookings', richiediAuth, bookingController.mie);
api.post('/bookings', richiediAuth, bookingController.crea);
api.post('/bookings/:id/pay', richiediAuth, bookingController.paga);
api.get('/bookings/:id/join', richiediAuth, bookingController.riepilogoPartecipazione);
api.post('/bookings/:id/join', richiediAuth, bookingController.partecipa);
api.delete('/bookings/:id/join', richiediAuth, bookingController.abbandona);
api.post('/bookings/:id/invite', richiediAuth, bookingController.invita);
api.post('/bookings/:id/invite/decline', richiediAuth, bookingController.rifiutaInvito);
api.delete('/bookings/:id', richiediAuth, bookingController.annulla);

/* -------------------------------- POST ------------------------------- */
api.get('/posts', richiediAuth, socialController.elencoPost);
api.post('/posts', richiediAuth, socialController.creaPost);
api.delete('/posts/:id', richiediAuth, socialController.eliminaPost);

/* ------------------------- AMICI E UTENTI ---------------------------- */
api.get('/users', richiediAuth, socialController.utenti);
api.get('/users/:id', richiediAuth, socialController.profiloUtente);
api.get('/users/:id/bookings', richiediAuth, socialController.prenotazioniUtente);
api.get('/friends', richiediAuth, socialController.amici);
api.get('/friends/requests', richiediAuth, socialController.richieste);
api.post('/friends/requests/:id/accept', richiediAuth, socialController.accettaRichiesta);
api.post('/friends/requests/:id/reject', richiediAuth, socialController.rifiutaRichiesta);
// annulla una richiesta che ho mandato io e non e' ancora stata gestita
api.delete('/friends/requests/:id', richiediAuth, socialController.annullaRichiesta);
api.post('/friends/:id', richiediAuth, socialController.aggiungiAmico);
api.delete('/friends/:id', richiediAuth, socialController.rimuoviAmico);

/* ------------------------------ GRUPPI ------------------------------- */
api.get('/groups', richiediAuth, socialController.gruppi);
api.post('/groups', richiediAuth, socialController.creaGruppo);
api.get('/groups/:id/members', richiediAuth, socialController.membriGruppo);
api.post('/groups/:id/join', richiediAuth, socialController.entraNelGruppo);
api.delete('/groups/:id', richiediAuth, socialController.eliminaGruppo);

/* -------------------------------- CHAT ------------------------------- */
api.get('/chats', richiediAuth, chatController.anteprime);
api.get('/chats/users/:id', richiediAuth, chatController.conversazioneUtente);
api.post('/chats/users/:id', richiediAuth, chatController.inviaAUtente);
api.get('/chats/groups/:id', richiediAuth, chatController.conversazioneGruppo);
api.post('/chats/groups/:id', richiediAuth, chatController.inviaAlGruppo);

/* ------------------------------- SWIPE ------------------------------- */
api.get('/swipe', richiediAuth, socialController.candidatiSwipe);
api.post('/swipe/:id', richiediAuth, socialController.swipe);

/* ----------------------------- NOTIFICHE ----------------------------- */
api.get('/notifications', richiediAuth, socialController.notifiche);
api.post('/notifications/read', richiediAuth, socialController.leggiNotifiche);

/* ----------------------- METODI DI PAGAMENTO ------------------------- */
api.get('/payment-methods', richiediAuth, paymentController.elenco);
api.post('/payment-methods', richiediAuth, paymentController.crea);
api.put('/payment-methods/:id', richiediAuth, paymentController.aggiorna);
api.delete('/payment-methods/:id', richiediAuth, paymentController.elimina);

/* ------------------------------ PROFILO ------------------------------ */
api.put('/profile', richiediAuth, socialController.aggiornaProfilo);
api.delete('/profile', richiediAuth, socialController.eliminaProfilo);

/* --------------------------- AMMINISTRAZIONE -------------------------- */
/**
 * Rotte usate dal pannello di controllo (sezione admin del frontend).
 * L'accesso e' un endpoint a parte: gli utenti entrano con l'email da
 * /api/auth/login, l'amministratore con il nome utente da qui.
 */
const admin = express.Router();

admin.post('/login', adminController.login);

// da qui in poi serve il token dell'amministratore
admin.use(richiediAdmin);

admin.get('/sessione', adminController.sessione);
admin.get('/statistiche', adminController.statistiche);
admin.get('/prenotazioni', adminController.prenotazioni);
admin.get('/utenti', adminController.utenti);
admin.get('/post', adminController.post);
admin.get('/campi', adminController.campi);

admin.put('/prenotazioni/:id/stato', adminController.cambiaStatoPrenotazione);
admin.delete('/prenotazioni/:id', adminController.eliminaPrenotazione);
admin.delete('/utenti/:id', adminController.eliminaUtente);
admin.delete('/post/:id', adminController.eliminaPost);
admin.post('/campi', adminController.creaCampo);
admin.delete('/campi/:id', adminController.eliminaCampo);

api.use('/admin', admin);

module.exports = { api };
