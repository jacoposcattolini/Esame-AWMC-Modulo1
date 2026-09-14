/**
 * Configurazione dell'applicazione Express (pattern MVC):
 *   Model      -> src/models      (query su PostgreSQL)
 *   View       -> il client React: il backend non ha interfaccia grafica
 *   Controller -> src/controllers (logica applicativa)
 *   Routes     -> src/routes      (URL -> Controller)
 *
 * Questo server sta "dietro le quinte": riceve richieste e risponde solo con
 * JSON. Non renderizza pagine, non serve CSS e nessun suo indirizzo si apre
 * come schermata: l'unica interfaccia dell'applicazione e' il frontend React.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { api } = require('./routes');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// log essenziale delle richieste
app.use((req, res, next) => {
  const inizio = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inizio}ms)`);
  });
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, servizio: 'sporteasy-api' }));

app.use('/api', api);

// La radice non e' una pagina: descrive il servizio e basta.
app.get('/', (req, res) =>
  res.json({
    servizio: 'sporteasy-api',
    descrizione: 'API JSON di SportEasy. Nessuna interfaccia grafica: usa il frontend.',
    endpoint: '/api',
    salute: '/api/health',
  })
);

app.use((req, res) => res.status(404).json({ errore: 'Risorsa non trovata' }));

// gestore errori centralizzato
app.use((err, req, res, next) => {
  console.error('[errore]', err);
  res.status(err.status || 500).json({ errore: err.message || 'Errore interno del server' });
});

module.exports = app;
