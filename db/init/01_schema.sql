-- ============================================================
-- SportEasy - schema PostgreSQL
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  nome          VARCHAR(80)  NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(120) NOT NULL,      -- bcrypt ($2b$...)
  bio           TEXT         DEFAULT '',
  data_nascita  DATE,
  comune        VARCHAR(120) DEFAULT '',
  sport         VARCHAR(80)  DEFAULT '',
  eta           INTEGER,
  avatar        TEXT         DEFAULT '/img/avatar-lorenzo.jpg',  -- percorso o foto caricata (data URL)
  -- credito SportEasy: ci finiscono i rimborsi delle prenotazioni annullate
  -- e da qui si possono pagare le prenotazioni successive
  saldo         NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sports (
  id       SERIAL PRIMARY KEY,
  slug     VARCHAR(40)  NOT NULL UNIQUE,
  nome     VARCHAR(60)  NOT NULL,
  immagine VARCHAR(160) NOT NULL,
  ordine   INTEGER      NOT NULL DEFAULT 0,
  -- quante persone al massimo puo' ospitare una prenotazione di questo sport
  max_partecipanti SMALLINT NOT NULL DEFAULT 10 CHECK (max_partecipanti > 0)
);

CREATE TABLE IF NOT EXISTS venues (
  id            SERIAL PRIMARY KEY,
  sport_id      INTEGER NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  nome          VARCHAR(120)  NOT NULL,
  prezzo        NUMERIC(6,2)  NOT NULL DEFAULT 0,
  apertura      VARCHAR(10)   NOT NULL,
  chiusura      VARCHAR(10)   NOT NULL,
  immagine      VARCHAR(160)  NOT NULL,
  indirizzo     VARCHAR(160)  DEFAULT '',
  lat           NUMERIC(9,6),
  lng           NUMERIC(9,6),
  rating        SMALLINT      NOT NULL DEFAULT 5,
  ordine        SMALLINT      NOT NULL DEFAULT 0,
  UNIQUE (sport_id, nome)
);

CREATE TABLE IF NOT EXISTS bookings (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  venue_id      INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  data          DATE    NOT NULL,
  ora           VARCHAR(10) NOT NULL,
  partecipanti  INTEGER NOT NULL DEFAULT 1 CHECK (partecipanti > 0),
  totale        NUMERIC(8,2) NOT NULL DEFAULT 0,
  -- quanto ha effettivamente versato l'organizzatore (0 finche' non paga):
  -- e' l'importo che gli torna come saldo se la prenotazione viene annullata
  pagato        NUMERIC(8,2) NOT NULL DEFAULT 0,
  stato         VARCHAR(20)  NOT NULL DEFAULT 'in_attesa',  -- in_attesa | confermata | annullata
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contenuto  TEXT    NOT NULL,
  -- prenotazione allegata al post (facoltativa): permette agli altri di aggiungersi
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  -- true quando la prenotazione allegata e' stata cancellata: il post resta
  -- leggibile e mostra "prenotazione non più disponibile" invece di perdere
  -- la scheda senza spiegazioni (lo imposta il trigger qui sotto)
  prenotazione_rimossa BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chi si e' aggiunto a una prenotazione altrui (dal post nel feed).
CREATE TABLE IF NOT EXISTS booking_participants (
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  -- quota versata da chi si e' aggiunto dal post: gli torna come saldo se
  -- esce dalla prenotazione o se la prenotazione viene annullata
  pagato     NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, user_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- inviata: richiesta in attesa di risposta (una riga sola, dal mittente)
  -- accettata: amicizia attiva (una riga per direzione)
  -- rifiutata: richiesta respinta, resta a memoria per non riproporla subito
  stato      VARCHAR(20) NOT NULL DEFAULT 'accettata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE TABLE IF NOT EXISTS groups (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(80) NOT NULL UNIQUE,
  immagine    TEXT        NOT NULL,   -- percorso o foto scelta dalla galleria (data URL)
  -- chi ha creato il gruppo: e' l'unico che puo' eliminarlo. I gruppi del
  -- seed non hanno un creatore (NULL) e restano lì per tutti.
  creatore_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titolo     VARCHAR(120) NOT NULL,
  testo      VARCHAR(240) NOT NULL,
  avatar     VARCHAR(160) DEFAULT '',
  tipo       VARCHAR(30)  NOT NULL DEFAULT 'social', -- social | prenotazione | messaggio
  link       VARCHAR(200) NOT NULL DEFAULT '',        -- schermata da aprire al tocco
  -- chi ha provocato la notifica (NULL se e' di sistema): serve a ripulirle
  -- quando quell'utente sparisce o viene riportato allo stato iniziale
  autore_id  INTEGER      REFERENCES users(id) ON DELETE CASCADE,
  letta      BOOLEAN      NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Inviti a partecipare a una prenotazione (dalla schermata prenotazioni o
-- dalla chat). L'invito non occupa un posto: lo occupa solo chi accetta,
-- iscrivendosi come partecipante.
CREATE TABLE IF NOT EXISTS booking_invites (
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  stato      VARCHAR(12) NOT NULL DEFAULT 'in_attesa'
             CHECK (stato IN ('in_attesa', 'accettato', 'rifiutato')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, user_id)
);

CREATE TABLE IF NOT EXISTS swipes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  liked      BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  mittente_id     INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  destinatario_id INTEGER          REFERENCES users(id)  ON DELETE CASCADE,
  group_id        INTEGER          REFERENCES groups(id) ON DELETE CASCADE,
  testo           TEXT    NOT NULL,
  -- prenotazione allegata al messaggio: e' l'invito che si vede in chat
  booking_id      INTEGER          REFERENCES bookings(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- un messaggio e' o diretto (destinatario_id) o di gruppo (group_id), mai entrambi
  CHECK ((destinatario_id IS NOT NULL AND group_id IS NULL)
      OR (destinatario_id IS NULL AND group_id IS NOT NULL))
);

-- Metodi di pagamento salvati dall'utente.
-- ATTENZIONE: qui NON finisce mai il numero completo della carta. Si salvano
-- solo i dati che servono a riconoscerla (circuito, ultime 4 cifre, scadenza,
-- intestatario), come fanno i servizi veri: il numero resta nel browser il
-- tempo di ricavarne le ultime quattro cifre e non viene mai inviato.
CREATE TABLE IF NOT EXISTS payment_methods (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circuito      VARCHAR(20)  NOT NULL DEFAULT 'Carta',   -- Visa | Mastercard | Maestro | Amex | Carta
  intestatario  VARCHAR(80)  NOT NULL,
  ultime4       CHAR(4)      NOT NULL CHECK (ultime4 ~ '^[0-9]{4}$'),
  scadenza_mese SMALLINT     NOT NULL CHECK (scadenza_mese BETWEEN 1 AND 12),
  scadenza_anno SMALLINT     NOT NULL CHECK (scadenza_anno BETWEEN 2000 AND 2100),
  predefinito   BOOLEAN      NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- aggiunte per database creati prima dell'introduzione delle colonne
ALTER TABLE venues        ADD COLUMN IF NOT EXISTS ordine SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE posts         ADD COLUMN IF NOT EXISTS booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS autore_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE users         ALTER COLUMN avatar TYPE TEXT;
ALTER TABLE groups        ALTER COLUMN immagine TYPE TEXT;
ALTER TABLE groups        ADD COLUMN IF NOT EXISTS creatore_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE messages      ADD COLUMN IF NOT EXISTS booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE sports        ADD COLUMN IF NOT EXISTS max_partecipanti SMALLINT NOT NULL DEFAULT 10;
ALTER TABLE users         ADD COLUMN IF NOT EXISTS saldo NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE bookings      ADD COLUMN IF NOT EXISTS pagato NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE booking_participants ADD COLUMN IF NOT EXISTS pagato NUMERIC(6,2) NOT NULL DEFAULT 0;
ALTER TABLE posts         ADD COLUMN IF NOT EXISTS prenotazione_rimossa BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_venues_sport    ON venues(sport_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user   ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created   ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user      ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_diretti  ON messages(mittente_id, destinatario_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_gruppo   ON messages(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_partecipanti  ON booking_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_inviti_utente ON booking_invites(user_id);
CREATE INDEX IF NOT EXISTS idx_pagamenti_utente ON payment_methods(user_id, created_at DESC);

-- ============================================================
-- Cancellazione controllata delle prenotazioni.
--
-- La chiave esterna posts.booking_id e' ON DELETE SET NULL: cancellando una
-- prenotazione il collegamento spariva in silenzio e il post restava a
-- parlare di una partita che non esisteva piu'. Questo trigger, che scatta
-- PRIMA della cancellazione (quando il collegamento c'e' ancora), marca i
-- post interessati: l'app mostra "prenotazione non più disponibile" al posto
-- della scheda. Sta nel database e non nell'applicazione apposta, cosi' vale
-- anche per le cancellazioni fatte dal pannello di controllo o a mano in SQL.
-- ============================================================
CREATE OR REPLACE FUNCTION segna_post_senza_prenotazione() RETURNS trigger AS $$
BEGIN
  UPDATE posts SET prenotazione_rimossa = true WHERE booking_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_senza_prenotazione ON bookings;
CREATE TRIGGER trg_post_senza_prenotazione
  BEFORE DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION segna_post_senza_prenotazione();
