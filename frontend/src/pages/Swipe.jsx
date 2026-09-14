import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Navigazione from '../components/Navigazione';
import { BarraRicerca, Caricamento, Errore, Intestazione } from '../components/Ui';

const SOGLIA = 110; // px di trascinamento oltre i quali lo swipe e' valido
const ATTESA_RICERCA = 250; // ms di pausa prima di interrogare il server

export default function Swipe() {
  const [candidati, setCandidati] = useState([]);
  const [indice, setIndice] = useState(0);
  const [errore, setErrore] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [match, setMatch] = useState(null);

  // ricerca di una persona precisa, invece di aspettare che esca dal mazzo
  const [cerca, setCerca] = useState('');
  const [risultati, setRisultati] = useState([]);
  const [cercando, setCercando] = useState(false);
  const [inCorso, setInCorso] = useState(0);
  // persone a cui si e' gia' scritto dalla ricerca: non vanno riproposte
  // fra le carte (il server le esclude gia', ma il mazzo e' in memoria)
  const [esclusi, setEsclusi] = useState(() => new Set());

  const cartaRef = useRef(null);
  const trascina = useRef({ attivo: false, x0: 0, dx: 0 });

  const testoCercato = cerca.trim();
  const inRicerca = testoCercato.length > 0;

  useEffect(() => {
    let vivo = true;
    api
      .get('/swipe')
      .then((r) => vivo && setCandidati(r))
      .catch((err) => vivo && setErrore(err.message))
      .finally(() => vivo && setCaricamento(false));
    return () => {
      vivo = false;
    };
  }, []);

  /* --------------------------- ricerca persone --------------------------- */

  useEffect(() => {
    if (!testoCercato) {
      setRisultati([]);
      setCercando(false);
      return undefined;
    }

    let vivo = true;
    setCercando(true);
    // si aspetta un attimo prima di chiamare il server: scrivendo "Mario" si
    // fa una richiesta sola invece di cinque
    const attesa = setTimeout(() => {
      api
        .get(`/users?cerca=${encodeURIComponent(testoCercato)}`)
        .then((r) => vivo && setRisultati(r))
        .catch((err) => vivo && setErrore(err.message))
        .finally(() => vivo && setCercando(false));
    }, ATTESA_RICERCA);

    return () => {
      vivo = false;
      clearTimeout(attesa);
    };
  }, [testoCercato]);

  const corrente = useMemo(() => candidati[indice] || null, [candidati, indice]);

  // se la persona in cima al mazzo e' gia' stata contattata dalla ricerca si
  // passa oltre: mostrarla di nuovo sarebbe un doppione
  useEffect(() => {
    if (corrente && esclusi.has(corrente.id)) setIndice((i) => i + 1);
  }, [corrente, esclusi]);

  /**
   * Richiesta di amicizia dalla ricerca. Usa la stessa rotta dello swipe
   * (un "like"), quindi vale la stessa logica: se l'altra persona aveva gia'
   * chiesto l'amicizia scatta il match, altrimenti resta in attesa di risposta.
   */
  async function chiediAmicizia(u) {
    setInCorso(u.id);
    setErrore('');
    try {
      const esito = await api.post(`/swipe/${u.id}`, { liked: true });
      const nuovoStato = esito.match ? 'accettata' : 'inviata';
      setRisultati((rs) => rs.map((r) => (r.id === u.id ? { ...r, amicizia: nuovoStato } : r)));
      setEsclusi((s) => new Set(s).add(u.id));
      setMatch({ ...u, esito: esito.match ? 'match' : 'inviata' });
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInCorso(0);
    }
  }

  /**
   * Annulla una richiesta ancora in attesa: sparisce da entrambe le parti
   * (anche la notifica di chi l'aveva ricevuta) e la persona torna fra i
   * profili proponibili nello swipe.
   */
  async function annullaRichiesta(u) {
    setInCorso(u.id);
    setErrore('');
    try {
      await api.del(`/friends/requests/${u.id}`);
      setRisultati((rs) => rs.map((r) => (r.id === u.id ? { ...r, amicizia: 'nessuna' } : r)));
      setEsclusi((s) => {
        const senza = new Set(s);
        senza.delete(u.id);
        return senza;
      });
      setMatch(null);
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInCorso(0);
    }
  }

  /** L'altra persona aveva gia' inviato la richiesta: qui si accetta. */
  async function accettaRichiesta(u) {
    setInCorso(u.id);
    setErrore('');
    try {
      await api.post(`/friends/requests/${u.id}/accept`);
      setRisultati((rs) => rs.map((r) => (r.id === u.id ? { ...r, amicizia: 'accettata' } : r)));
      setEsclusi((s) => new Set(s).add(u.id));
      setMatch({ ...u, esito: 'match' });
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInCorso(0);
    }
  }

  /* ------------------------------ carte ------------------------------ */

  function aggiornaTrasformazione(dx) {
    const carta = cartaRef.current;
    if (!carta) return;
    carta.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
    const like = carta.querySelector('.timbro.like');
    const nope = carta.querySelector('.timbro.nope');
    if (like) like.style.opacity = dx > 30 ? Math.min(1, dx / SOGLIA) : 0;
    if (nope) nope.style.opacity = dx < -30 ? Math.min(1, -dx / SOGLIA) : 0;
  }

  function inizio(e) {
    if (!corrente) return;
    trascina.current = { attivo: true, x0: e.clientX, dx: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function muovi(e) {
    if (!trascina.current.attivo) return;
    trascina.current.dx = e.clientX - trascina.current.x0;
    aggiornaTrasformazione(trascina.current.dx);
  }

  function fine() {
    if (!trascina.current.attivo) return;
    const dx = trascina.current.dx;
    trascina.current.attivo = false;

    if (Math.abs(dx) > SOGLIA) {
      decidi(dx > 0);
    } else {
      const carta = cartaRef.current;
      if (carta) {
        carta.style.transition = 'transform 0.2s ease';
        aggiornaTrasformazione(0);
        setTimeout(() => carta && (carta.style.transition = ''), 200);
      }
    }
  }

  async function decidi(liked) {
    if (!corrente) return;
    const utente = corrente;

    const carta = cartaRef.current;
    if (carta) {
      carta.style.transition = 'transform 0.28s ease, opacity 0.28s ease';
      carta.style.transform = `translateX(${liked ? 600 : -600}px) rotate(${liked ? 26 : -26}deg)`;
      carta.style.opacity = '0';
    }

    setTimeout(() => setIndice((i) => i + 1), 240);

    try {
      const esito = await api.post(`/swipe/${utente.id}`, { liked });
      // il like manda una richiesta di amicizia: se le richieste si
      // incrociano e' un match, altrimenti resta in attesa di risposta
      if (esito.match) setMatch({ ...utente, esito: 'match' });
      else if (esito.richiesta === 'inviata') setMatch({ ...utente, esito: 'inviata' });
    } catch (err) {
      setErrore(err.message);
    }
  }

  return (
    <div className="app">
      <Intestazione titolo="Swipe" indietro={false} centrato />

      {/* la barra resta al centro della pagina, allineata alla carta dello swipe */}
      <div className="home-top home-top-centrata">
        <BarraRicerca valore={cerca} onChange={setCerca} placeholder="Cerca una persona per nome" />
      </div>

      <Errore testo={errore} />

      {/* --------------------------- RISULTATI --------------------------- */}
      {inRicerca && (
        <div className="contenuto lista-verticale risultati-persone">
          {cercando && risultati.length === 0 && <Caricamento testo="Sto cercando..." />}

          {risultati.map((u) => (
            <div key={u.id} className="riga-utente riga-richiesta">
              <Link to={`/utente/${u.id}`}>
                <img src={u.avatar} alt="" loading="lazy" />
              </Link>
              <span className="nome">
                <h3>
                  <Link to={`/utente/${u.id}`}>{u.nome}</Link>
                </h3>
                <p>{[u.sport, u.comune].filter(Boolean).join(' · ') || 'Nuovo su SportEasy'}</p>
              </span>
              <span className="azioni-richiesta">
                {u.amicizia === 'accettata' && <span className="pillola-info">Siete amici</span>}

                {u.amicizia === 'inviata' && (
                  <span className="richiesta-in-attesa">
                    <span className="pillola-info chiara">Richiesta inviata</span>
                    <button
                      type="button"
                      className="btn-testo"
                      disabled={inCorso === u.id}
                      onClick={() => annullaRichiesta(u)}
                    >
                      Annulla
                    </button>
                  </span>
                )}

                {u.amicizia === 'ricevuta' && (
                  <button
                    type="button"
                    className="btn btn-pillola"
                    disabled={inCorso === u.id}
                    onClick={() => accettaRichiesta(u)}
                  >
                    Accetta
                  </button>
                )}

                {(u.amicizia === 'nessuna' || u.amicizia === 'rifiutata') && (
                  <button
                    type="button"
                    className="btn btn-pillola"
                    disabled={inCorso === u.id}
                    onClick={() => chiediAmicizia(u)}
                  >
                    {inCorso === u.id ? 'Attendi...' : 'Aggiungi'}
                  </button>
                )}
              </span>
            </div>
          ))}

          {!cercando && risultati.length === 0 && (
            <p className="stato-vuoto">
              Nessuna persona trovata con «{testoCercato}».
              <br />
              Prova con un altro nome.
            </p>
          )}
        </div>
      )}

      {/* ----------------------------- CARTE ----------------------------- */}
      {!inRicerca && (
        <>
          {caricamento && <Caricamento />}

          {!caricamento && !corrente && (
            <p className="stato-vuoto">
              Hai visto tutti i profili disponibili.
              <br />
              Cerca una persona per nome qui sopra, oppure torna più tardi per scoprire nuovi
              compagni di gioco!
            </p>
          )}

          {corrente && (
            <>
              <div className="swipe-area">
                <div
                  key={corrente.id}
                  ref={cartaRef}
                  className="carta-swipe"
                  style={{ backgroundImage: `url(${corrente.avatar})` }}
                  onPointerDown={inizio}
                  onPointerMove={muovi}
                  onPointerUp={fine}
                  onPointerCancel={fine}
                >
                  <span className="timbro like">LIKE</span>
                  <span className="timbro nope">NOPE</span>
                  <div className="testo">
                    <h2>
                      {corrente.nome}
                      {corrente.eta ? `, ${corrente.eta}` : ''}
                    </h2>
                    <p>
                      {corrente.sport ? `${corrente.sport}\n` : ''}
                      {corrente.bio}
                    </p>
                  </div>
                </div>
              </div>

              <div className="azioni-swipe">
                <button type="button" className="no" aria-label="Rifiuta" onClick={() => decidi(false)}>✕</button>
                <button type="button" className="si" aria-label="Mi piace" onClick={() => decidi(true)}>♥</button>
              </div>
            </>
          )}
        </>
      )}

      {match && (
        <p className="stato-vuoto avviso-swipe">
          {match.esito === 'match'
            ? `È un match con ${match.nome}! Ora siete amici.`
            : `Richiesta di amicizia inviata a ${match.nome}: ora tocca a ${match.nome.split(' ')[0]} accettarla.`}
          <br />
          <button type="button" className="btn-testo" onClick={() => setMatch(null)}>Continua</button>
        </p>
      )}

      <Navigazione />
    </div>
  );
}
