-- ============================================================
-- SportEasy - popolamento dati di riferimento (sport, campi, gruppi)
-- I dati presi dal progetto Figma "SportEasy".
-- Idempotente: puo' essere rieseguito senza duplicare nulla.
-- ============================================================

-- max_partecipanti: quante persone al massimo stanno in una prenotazione.
-- Il basket non era nell'elenco richiesto: 10 (5 contro 5), da cambiare qui
-- se il numero giusto e' un altro.
INSERT INTO sports (slug, nome, immagine, ordine, max_partecipanti) VALUES
  ('calcetto',  'Calcetto',     '/img/sport-calcetto.jpg',  1, 10),
  ('calciotto', 'Calciotto',    '/img/sport-calciotto.jpg', 2, 16),
  ('basket',    'Basket',       '/img/sport-basket.jpg',    3, 10),
  ('padel',     'Padel',        '/img/sport-padel.jpg',      4,  4),
  ('tennis',    'Tennis',       '/img/sport-tennis.jpg',    5,  4),
  ('beach',     'Beach Volley', '/img/sport-beach.jpg',     6,  4)
ON CONFLICT (slug) DO UPDATE SET max_partecipanti = EXCLUDED.max_partecipanti;

INSERT INTO venues (sport_id, nome, prezzo, apertura, chiusura, immagine, indirizzo, lat, lng, rating, ordine)
SELECT s.id, v.nome, v.prezzo, v.apertura, v.chiusura, v.immagine, v.indirizzo, v.lat, v.lng, v.rating, v.ordine
-- Coordinate e indirizzi verificati sui dati reali di OpenStreetMap
-- (Nominatim / Overpass, zona di Macerata):
--   Campo Collevario    -> "Centro Sportivo Collevario", Via Giovanni Verga
--   Campo Helvia Recina -> Stadio "Helvia Recina", Via Famiglia Palmieri (Villa Potenza)
--   Campo Corneto       -> campo da basket del quartiere Corneto, Piazzale Vittime del Terrorismo
--   Campo Torresi       -> "Tennis Padel Team Torresi ASD", Via Dante Alighieri 20
--   Circolo Tennis      -> "Associazione Tennis e Padel Macerata", Via dei Velini 157/B
--                          (i campi che in OSM figurano come "Tennis Giuseppucci")
--   Campo Filarmonica   -> "La Filarmonica", Via Ghino Valenti 122
FROM (VALUES
  ('calcetto',  'Campo Collevario',    5.00, '10.00', '20.00', '/img/venue-collevario-2.jpg',     'Via Giovanni Verga, Macerata',            43.285231, 13.429037, 5, 1),
  ('calcetto',  'Campo Helvia Recina', 5.00, '9.00',  '21.00', '/img/venue-helvia-calcetto.jpg',  'Via Famiglia Palmieri, Macerata',         43.307200, 13.435718, 5, 2),
  ('calciotto', 'Campo Collevario',    5.00, '10.00', '20.00', '/img/venue-collevario.jpg',       'Via Giovanni Verga, Macerata',            43.285231, 13.429037, 5, 1),
  ('calciotto', 'Campo Helvia Recina', 5.00, '10.00', '20.00', '/img/venue-helvia-calciotto-2.jpg?v=2', 'Via Famiglia Palmieri, Macerata',         43.307200, 13.435718, 5, 2),
  ('basket',    'Campo Corneto',       0.00, '9.00',  '00.00', '/img/venue-corneto.jpg',          'Piazzale Vittime del Terrorismo, Macerata', 43.287097, 13.450962, 5, 1),
  ('basket',    'Campo Helvia Recina', 0.00, '10.00', '20.00', '/img/venue-helvia-basket.jpg',    'Via Famiglia Palmieri, Macerata',         43.307200, 13.435718, 5, 2),
  ('padel',     'Campo Torresi',       7.00, '9.00',  '22.00', '/img/venue-torresi-padel.jpg',    'Via Dante Alighieri 20, Macerata',        43.296171, 13.451078, 5, 1),
  ('padel',     'Campo Helvia Recina', 5.00, '10.00', '20.00', '/img/venue-helvia-padel.jpg',     'Via Famiglia Palmieri, Macerata',         43.307200, 13.435718, 5, 2),
  ('tennis',    'Campo Torresi',       7.00, '10.00', '22.00', '/img/venue-torresi-tennis.jpg',   'Via Dante Alighieri 20, Macerata',        43.296171, 13.451078, 5, 1),
  ('tennis',    'Circolo Tennis',      8.00, '9.00',  '22.00', '/img/venue-circolo-tennis.jpg',   'Via dei Velini 157/B, Macerata',          43.307909, 13.439839, 5, 2),
  ('beach',     'Campo Filarmonica',   7.00, '9.00',  '20.00', '/img/venue-filarmonica.jpg',      'Via Ghino Valenti 122, Macerata',         43.309094, 13.420739, 5, 1),
  ('beach',     'Campo Helvia Recina', 5.00, '10.00', '20.00', '/img/venue-helvia-beach.jpg',     'Via Famiglia Palmieri, Macerata',         43.306938, 13.437582, 5, 2)
) AS v(sport_slug, nome, prezzo, apertura, chiusura, immagine, indirizzo, lat, lng, rating, ordine)
JOIN sports s ON s.slug = v.sport_slug
-- il seed e' idempotente: sui database gia' creati aggiorna anche posizione e
-- indirizzo, altrimenti i pin resterebbero sulle vecchie coordinate sbagliate
ON CONFLICT (sport_id, nome) DO UPDATE SET
  ordine    = EXCLUDED.ordine,
  indirizzo = EXCLUDED.indirizzo,
  lat       = EXCLUDED.lat,
  lng       = EXCLUDED.lng;

INSERT INTO groups (nome, immagine) VALUES
  ('Calcetto',      '/img/sport-calcetto.jpg'),
  ('Basket',        '/img/sport-basket.jpg'),
  ('Amici Stretti', '/img/group-amici-stretti.jpg')
ON CONFLICT (nome) DO NOTHING;
