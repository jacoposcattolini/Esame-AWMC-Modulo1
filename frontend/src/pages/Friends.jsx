import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Navigazione from '../components/Navigazione';
import { BarraRicerca, Caricamento, Conferma, Errore, Modale } from '../components/Ui';
import { useAuth } from '../context/AuthContext';
import { controllaFile, riduciImmagine } from '../immagini';

/** Ogni quanto si ricontrolla il server: serve a far comparire da sole le
 *  amicizie accettate dall'altra persona, senza ricaricare la pagina. */
const RINFRESCO = 10000;

/** Immagini disponibili per un gruppo nuovo. */
const IMMAGINI_GRUPPO = [
  '/img/group-amici-stretti.jpg',
  '/img/sport-calcetto.jpg',
  '/img/sport-calciotto.jpg',
  '/img/sport-basket.jpg',
  '/img/sport-padel.jpg',
  '/img/sport-tennis.jpg',
  '/img/sport-beach.jpg',
];

/** Orario compatto dell'ultimo messaggio, come nelle app di messaggistica. */
function quando(iso) {
  if (!iso) return '';
  const data = new Date(iso);
  const giorni = Math.floor((Date.now() - data.getTime()) / 86400000);
  if (giorni < 1) return data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (giorni < 7) return data.toLocaleDateString('it-IT', { weekday: 'short' });
  return data.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

/**
 * Elenco delle conversazioni: solo gli amici gia' acquisiti e solo i gruppi
 * di cui si fa parte. Toccando una riga si apre direttamente la chat.
 * La terza scheda raccoglie le richieste di amicizia ricevute (dallo swipe o
 * dal profilo di qualcuno) da accettare o rifiutare.
 * La lista e' su una sola colonna (classe "lista-verticale"), anche su
 * desktop, cosi' si scorre dall'alto verso il basso senza cercare a griglia.
 */
export default function Friends() {
  const { utente } = useAuth();
  const [scheda, setScheda] = useState('amici'); // amici | gruppi | richieste
  const [cerca, setCerca] = useState('');
  const [amici, setAmici] = useState([]);
  const [gruppi, setGruppi] = useState([]);
  const [richieste, setRichieste] = useState([]);
  const [anteprime, setAnteprime] = useState({ amici: [], gruppi: [] });
  const [errore, setErrore] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [inCorso, setInCorso] = useState(0);

  // creazione di un nuovo gruppo
  const [nuovoGruppo, setNuovoGruppo] = useState(null);
  const [salvataggio, setSalvataggio] = useState(false);
  // immagine caricata dalla galleria (o dal computer) per il nuovo gruppo
  const [fotoGruppo, setFotoGruppo] = useState('');
  const selettoreFile = useRef(null);
  // gruppo per cui e' aperta la conferma di eliminazione
  const [daEliminare, setDaEliminare] = useState(null);

  const carica = useCallback(
    (silenzioso = false) => {
      if (!silenzioso) setCaricamento(true);
      return Promise.all([
        api.get('/friends'),
        api.get('/groups'),
        api.get('/chats'),
        api.get('/friends/requests'),
      ])
        .then(([a, g, c, r]) => {
          setAmici(a);
          setGruppi(g);
          setAnteprime(c);
          setRichieste(r);
        })
        .catch((err) => !silenzioso && setErrore(err.message))
        .finally(() => !silenzioso && setCaricamento(false));
    },
    []
  );

  useEffect(() => {
    carica();
    // aggiornamento periodico: se qualcuno accetta la nostra richiesta, lo
    // vediamo comparire fra gli amici senza dover ricaricare a mano
    const timer = setInterval(() => carica(true), RINFRESCO);
    return () => clearInterval(timer);
  }, [carica]);

  const ultimoConAmico = useMemo(() => {
    const mappa = new Map();
    for (const m of anteprime.amici || []) mappa.set(m.altro_id, m);
    return mappa;
  }, [anteprime]);

  const ultimoDelGruppo = useMemo(() => {
    const mappa = new Map();
    for (const m of anteprime.gruppi || []) mappa.set(m.group_id, m);
    return mappa;
  }, [anteprime]);

  const elencoAmici = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return amici.filter((a) => !q || a.nome.toLowerCase().includes(q));
  }, [amici, cerca]);

  const elencoGruppi = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return gruppi.filter((g) => !q || g.nome.toLowerCase().includes(q));
  }, [gruppi, cerca]);

  /** Accetta o rifiuta una richiesta, aggiornando subito le liste. */
  async function rispondi(utente, accetta) {
    setInCorso(utente.id);
    setErrore('');
    try {
      const esito = await api.post(
        `/friends/requests/${utente.id}/${accetta ? 'accept' : 'reject'}`
      );
      setRichieste((r) => r.filter((x) => x.id !== utente.id));
      if (accetta) {
        // il nuovo amico compare subito, senza aspettare il prossimo giro
        const amico = esito.amico || utente;
        setAmici((a) =>
          a.some((x) => x.id === amico.id) ? a : [...a, amico].sort((x, y) => x.nome.localeCompare(y.nome))
        );
      }
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInCorso(0);
    }
  }

  function apriCreazione() {
    setErrore('');
    setFotoGruppo('');
    setNuovoGruppo({ nome: '', immagine: IMMAGINI_GRUPPO[0], membri: [] });
  }

  /**
   * Immagine presa dalla galleria del telefono (o dal file system del
   * computer): viene ridotta sul posto e diventa subito quella scelta.
   */
  async function scegliFoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // cosi' si puo' riscegliere lo stesso file
    if (!file) return;
    const problema = controllaFile(file);
    if (problema) {
      setErrore(problema);
      return;
    }
    try {
      const ridotta = await riduciImmagine(file);
      setFotoGruppo(ridotta);
      setNuovoGruppo((g) => ({ ...g, immagine: ridotta }));
      setErrore('');
    } catch (err) {
      setErrore(err.message);
    }
  }

  function alternaMembro(id) {
    setNuovoGruppo((g) => ({
      ...g,
      membri: g.membri.includes(id) ? g.membri.filter((m) => m !== id) : [...g.membri, id],
    }));
  }

  async function creaGruppo(e) {
    e.preventDefault();
    setErrore('');
    if (nuovoGruppo.nome.trim().length < 2) {
      setErrore('Dai un nome al gruppo (almeno 2 caratteri)');
      return;
    }
    setSalvataggio(true);
    try {
      const gruppo = await api.post('/groups', {
        nome: nuovoGruppo.nome.trim(),
        immagine: nuovoGruppo.immagine,
        membri: nuovoGruppo.membri,
      });
      setGruppi((g) => [...g, gruppo]);
      setNuovoGruppo(null);
      setScheda('gruppi');
    } catch (err) {
      setErrore(err.message);
    } finally {
      setSalvataggio(false);
    }
  }

  /** Elimina il gruppo: solo dopo la conferma esplicita. */
  async function eliminaGruppo() {
    setSalvataggio(true);
    setErrore('');
    try {
      await api.del(`/groups/${daEliminare.id}`);
      setGruppi((g) => g.filter((x) => x.id !== daEliminare.id));
      setDaEliminare(null);
    } catch (err) {
      setErrore(err.message);
      setDaEliminare(null);
    } finally {
      setSalvataggio(false);
    }
  }

  const segnaposto =
    scheda === 'amici'
      ? 'Cerca fra i tuoi amici'
      : scheda === 'gruppi'
        ? 'Cerca fra i tuoi gruppi'
        : 'Cerca fra le richieste';

  return (
    <div className="app">
      <div className="home-top">
        <BarraRicerca valore={cerca} onChange={setCerca} placeholder={segnaposto} />
      </div>

      <div className="contenuto lista-verticale">
        <div className="segmenti">
          <button type="button" className={scheda === 'amici' ? 'attivo' : ''} onClick={() => setScheda('amici')}>
            Amici
          </button>
          <button type="button" className={scheda === 'gruppi' ? 'attivo' : ''} onClick={() => setScheda('gruppi')}>
            Gruppi
          </button>
          <button type="button" className={scheda === 'richieste' ? 'attivo' : ''} onClick={() => setScheda('richieste')}>
            Richieste
            {richieste.length > 0 && <span className="pallino-conteggio">{richieste.length}</span>}
          </button>
        </div>

        <Errore testo={errore} />
        {caricamento && <Caricamento />}

        {scheda === 'gruppi' && (
          <button type="button" className="btn btn-pillola btn-nuovo-gruppo" onClick={apriCreazione}>
            Crea un gruppo
          </button>
        )}

        {scheda === 'amici' &&
          elencoAmici.map((u) => {
            const ultimo = ultimoConAmico.get(u.id);
            return (
              <Link key={u.id} className="riga-utente riga-chat" to={`/chat/utente/${u.id}`}>
                <img src={u.avatar} alt="" loading="lazy" />
                <span className="nome">
                  <h3>{u.nome}</h3>
                  <p>{ultimo ? ultimo.testo : u.sport || 'Nessun messaggio, scrivi tu il primo'}</p>
                </span>
                <span className="quando">{quando(ultimo && ultimo.created_at)}</span>
              </Link>
            );
          })}

        {scheda === 'gruppi' &&
          elencoGruppi.map((g) => {
            const ultimo = ultimoDelGruppo.get(g.id);
            // solo chi ha creato il gruppo puo' eliminarlo
            const mio = utente && Number(g.creatore_id) === Number(utente.id);
            return (
              <div key={g.id} className="riga-utente riga-chat riga-gruppo">
                <Link className="gruppo-apri" to={`/chat/gruppo/${g.id}`}>
                  <img src={g.immagine} alt="" loading="lazy" />
                  <span className="nome">
                    <h3>{g.nome}</h3>
                    <p>{ultimo ? `${ultimo.mittente}: ${ultimo.testo}` : `${g.membri} membri`}</p>
                  </span>
                  <span className="quando">{quando(ultimo && ultimo.created_at)}</span>
                </Link>
                {mio && (
                  <button
                    type="button"
                    className="btn-testo pericolo"
                    onClick={() => setDaEliminare(g)}
                  >
                    Elimina
                  </button>
                )}
              </div>
            );
          })}

        {scheda === 'richieste' &&
          richieste.map((u) => (
            <div key={u.id} className="riga-utente riga-richiesta">
              <Link to={`/utente/${u.id}`}>
                <img src={u.avatar} alt="" loading="lazy" />
              </Link>
              <span className="nome">
                <h3>
                  <Link to={`/utente/${u.id}`}>{u.nome}</Link>
                </h3>
                <p>{u.sport || 'Vuole aggiungerti agli amici'}</p>
              </span>
              <span className="azioni-richiesta">
                <button
                  type="button"
                  className="btn btn-pillola"
                  disabled={inCorso === u.id}
                  onClick={() => rispondi(u, true)}
                >
                  Accetta
                </button>
                <button
                  type="button"
                  className="btn-testo pericolo"
                  disabled={inCorso === u.id}
                  onClick={() => rispondi(u, false)}
                >
                  Rifiuta
                </button>
              </span>
            </div>
          ))}

        {!caricamento && scheda === 'amici' && elencoAmici.length === 0 && (
          <p className="stato-vuoto">
            {cerca ? 'Nessun amico con questo nome.' : 'Non hai ancora amici: trovali dalla schermata Swipe.'}
          </p>
        )}
        {!caricamento && scheda === 'gruppi' && elencoGruppi.length === 0 && (
          <p className="stato-vuoto">
            {cerca ? 'Nessun gruppo con questo nome.' : 'Non fai ancora parte di nessun gruppo: creane uno!'}
          </p>
        )}
        {!caricamento && scheda === 'richieste' && richieste.length === 0 && (
          <p className="stato-vuoto">
            Nessuna richiesta in attesa. Arrivano da qui quando qualcuno ti aggiunge dal suo profilo
            o ti mette «mi piace» nello Swipe.
          </p>
        )}
      </div>

      {daEliminare && (
        <Conferma
          titolo="Eliminare il gruppo?"
          messaggio={`«${daEliminare.nome}» verrà eliminato per tutti i suoi ${daEliminare.membri} membri, insieme alla chat di gruppo e ai messaggi scambiati. L’operazione non si può annullare.`}
          etichetta="Sì, elimina"
          etichettaAnnulla="Torna indietro"
          pericolo
          inCorso={salvataggio}
          onConferma={eliminaGruppo}
          onAnnulla={() => setDaEliminare(null)}
        />
      )}

      {nuovoGruppo && (
        <Modale titolo="Nuovo gruppo" onChiudi={() => setNuovoGruppo(null)}>
          <form className="modulo-gruppo" onSubmit={creaGruppo}>
            <Errore testo={errore} />

            <span className="etichetta">Nome del gruppo</span>
            <label className="campo">
              <input
                type="text"
                placeholder="Es. Calcetto del giovedì"
                maxLength={80}
                value={nuovoGruppo.nome}
                onChange={(e) => setNuovoGruppo((g) => ({ ...g, nome: e.target.value }))}
                required
                autoFocus
              />
            </label>

            <span className="etichetta">Immagine</span>
            <p className="aiuto">
              Carica un’immagine dalla galleria o dal computer, oppure scegline una fra quelle pronte.
            </p>
            <div className="scelta-avatar">
              <button
                type="button"
                className="avatar-opzione avatar-carica"
                onClick={() => selettoreFile.current && selettoreFile.current.click()}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path d="M4 8.5h3.2l1.4-2.2h6.8l1.4 2.2H20a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z"
                        fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <circle cx="12" cy="13.6" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                <span>Carica</span>
              </button>

              <input
                ref={selettoreFile}
                type="file"
                accept="image/*"
                className="selettore-file"
                onChange={scegliFoto}
              />

              {fotoGruppo && (
                <button
                  type="button"
                  className={`avatar-opzione${nuovoGruppo.immagine === fotoGruppo ? ' scelto' : ''}`}
                  aria-pressed={nuovoGruppo.immagine === fotoGruppo}
                  onClick={() => setNuovoGruppo((g) => ({ ...g, immagine: fotoGruppo }))}
                >
                  <img src={fotoGruppo} alt="L’immagine che hai caricato" />
                </button>
              )}

              {IMMAGINI_GRUPPO.map((img) => (
                <button
                  key={img}
                  type="button"
                  className={`avatar-opzione${nuovoGruppo.immagine === img ? ' scelto' : ''}`}
                  aria-pressed={nuovoGruppo.immagine === img}
                  onClick={() => setNuovoGruppo((g) => ({ ...g, immagine: img }))}
                >
                  <img src={img} alt="" />
                </button>
              ))}
            </div>

            <span className="etichetta">Chi ne fa parte</span>
            <p className="aiuto">
              {amici.length === 0
                ? 'Non hai ancora amici da aggiungere: il gruppo parte con te e potrai invitarli più avanti.'
                : 'Scegli chi aggiungere subito: ci sei già tu, gli altri si possono aggiungere dopo.'}
            </p>
            <ul className="elenco-membri scelta-membri">
              {amici.map((a) => (
                <li key={a.id}>
                  <label>
                    <img src={a.avatar} alt="" loading="lazy" />
                    <span>
                      <strong>{a.nome}</strong>
                      <em>{a.sport || 'Nessuno sport indicato'}</em>
                    </span>
                    <input
                      type="checkbox"
                      checked={nuovoGruppo.membri.includes(a.id)}
                      onChange={() => alternaMembro(a.id)}
                    />
                  </label>
                </li>
              ))}
            </ul>

            <div className="modale-azioni">
              <button
                type="button"
                className="btn btn-bordo"
                onClick={() => setNuovoGruppo(null)}
                disabled={salvataggio}
              >
                Annulla
              </button>
              <button type="submit" className="btn btn-verde" disabled={salvataggio}>
                {salvataggio ? 'Creazione...' : 'Crea gruppo'}
              </button>
            </div>
          </form>
        </Modale>
      )}

      <Navigazione />
    </div>
  );
}
