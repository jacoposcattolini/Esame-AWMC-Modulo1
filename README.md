# SportEasy

**SportEasy** è una web app a tema **sportivo/social**. Permette di prenotare campi
sportivi (calcetto, calciotto, basket, padel, tennis, beach volley), pagare la
propria quota e — soprattutto — trovare compagni con cui giocare: uno *swipe* dei
profili in stile app di incontri, una rubrica di amici, gruppi con chat e una
bacheca di post. È pensata per l'uso da smartphone (interfaccia responsive), ma
funziona anche da desktop.

L'applicazione gira **solo in locale**: non è previsto alcun deploy.

---

## Funzionalità principali

- **Swipe profili** — scorri i profili degli altri utenti e metti "mi piace" o
  scarta; un profilo scartato torna disponibile dopo un periodo di grazia.
- **Amici** — invia e gestisci richieste di amicizia, consulta i profili altrui e
  le loro prenotazioni.
- **Gruppi con chat** — crea o entra in un gruppo e chatta con i suoi membri; è
  disponibile anche la chat privata uno-a-uno.
- **Notifiche** — richieste di amicizia, inviti alle partite e altri eventi.
- **Post** — una bacheca dove pubblicare ed eliminare i propri post.
- **Prenotazioni e pagamenti** — prenota un campo per una fascia oraria, invita
  partecipanti, dividi la quota e paga dal saldo SportEasy o da una carta salvata.
- **Pannello di controllo (admin)** — sezione riservata per gestire prenotazioni,
  utenti, post e campi.

---

## Stack tecnologico

| Livello | Tecnologia |
|---|---|
| **Frontend** | React 18.3 + Vite 5.4, React Router 6.28 (Single Page Application) |
| **Backend** | Node.js 20 + Express 4.21 (pattern MVC), autenticazione con JWT, password cifrate con bcrypt |
| **DBMS** | PostgreSQL 16 (driver `pg`) |
| **Esecuzione** | Docker + Docker Compose (i tre servizi in un unico stack) |

Il backend espone **solo API JSON** sotto `/api`: non ha interfaccia grafica.
L'unica interfaccia dell'applicazione è il frontend React.

### Accesso ai dati: SQL scritto a mano, senza ORM

Non viene usato alcun ORM. Tutte le query SQL sono scritte a mano dentro i
**Model** (`backend/src/models/`), l'unico strato che parla con il database: i
controller non contengono SQL. Le query sono **parametriche** (`$1`, `$2`, …),
quindi protette dalla SQL injection, e passano tutte da un unico pool di
connessioni (`backend/src/config/db.js`).

---

## Prerequisiti

- **Docker Desktop** con Docker Compose (unico requisito: Node, npm e PostgreSQL
  girano dentro i container, non serve installarli sul computer).

---

## Installazione, configurazione e avvio in locale

Dalla cartella del progetto:

### 1. Prepara le variabili d'ambiente

Copia il file di esempio in `.env`:

```bash
cp .env.example .env
```

I valori predefiniti sono già pronti per l'uso locale (utente e password del
database, chiave di firma dei token, credenziali del pannello admin). Non serve
modificarli per far partire l'app.

### 2. Avvia lo stack

```bash
docker compose up --build
```

Il comando costruisce e avvia i tre servizi: database, backend e frontend. La
prima build è la più lenta; gli avvii successivi sono rapidi.

### 3. Creazione e popolamento del database (automatici)

Non serve alcun passaggio manuale:

- al **primo avvio** il container PostgreSQL esegue gli script in `db/init/`
  (`01_schema.sql` crea le tabelle, `02_seed.sql` inserisce i dati di
  riferimento: sport, campi, gruppi);
- a **ogni avvio** il backend esegue una migrazione idempotente
  (`backend/src/config/migrate.js`) che rifà lo schema se manca e popola gli
  utenti di esempio con post, amicizie, notifiche e chat dimostrative.

In caso si voglia ripartire da un database pulito, basta rimuovere il volume dei
dati:

```bash
docker compose down -v
docker compose up --build
```

### 4. Apri l'applicazione

| Indirizzo | Cosa |
|---|---|
| <http://localhost:8080> | Sito (frontend) |
| <http://localhost:8080/admin> | Pannello di controllo |
| <http://localhost:3000/api> | API JSON del backend |

Essendo il frontend in ascolto anche sulla rete locale, l'app si può aprire pure
dallo smartphone collegato allo stesso Wi-Fi.

---

## Credenziali dimostrative

- **Account utente DEMO** — nella schermata di accesso, bottone
  **"Entra con l'account DEMO"** (`utenteprova@gmail.com`, senza password). È un
  account "a perdere": si ripristina allo stato iniziale a ogni uscita.
- **Pannello di controllo (admin)** — form dedicato in alto nella schermata di
  accesso:
  - utente: `admin`
  - password: `adminsporteasy.2026`

> Le credenziali admin si leggono dal file `.env` (`ADMIN_USERNAME` e
> `ADMIN_PASSWORD_HASH`, un hash bcrypt). La password sopra è quella di sviluppo
> impostata in `.env.example`; per cambiarla si rigenera l'hash e si aggiorna
> `.env`.

Gli altri utenti di esempio (Mario Rossi, Franco Totti, …) hanno tutti la
password `password`.

---

## Struttura delle cartelle

```
sporteasy/
├─ backend/                 Backend Node.js/Express (API JSON, pattern MVC)
│  └─ src/
│     ├─ models/            Model: le query SQL scritte a mano (uno per entità)
│     ├─ controllers/       Controller: logica applicativa, nessuna SQL
│     ├─ routes/            Mappa URL → controller (tutto sotto /api)
│     ├─ middleware/        Autenticazione utente e admin (JWT)
│     ├─ config/            Connessione DB, migrazione/seed, hashing, account demo
│     └─ app.js, server.js  Configurazione e avvio di Express
├─ frontend/                Frontend React + Vite (Single Page Application)
│  ├─ src/
│  │  ├─ pages/             Le schermate dell'app (+ pages/admin per il pannello)
│  │  ├─ components/        Componenti riutilizzabili (navigazione, UI, …)
│  │  ├─ context/           Contesto di autenticazione
│  │  ├─ styles/            Fogli di stile
│  │  ├─ api.js             Client HTTP verso il backend
│  │  └─ App.jsx, main.jsx  Rotte e bootstrap dell'applicazione
│  └─ public/img/           Immagini (avatar, campi, sport, logo)
├─ db/init/                 Script SQL: 01_schema.sql (tabelle) e 02_seed.sql (dati)
└─ docker-compose.yml       Definizione dei tre servizi: db, backend, frontend
```
