import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navigazione from '../components/Navigazione';
import { BarraRicerca, Caricamento, Conferma, Errore, Intestazione } from '../components/Ui';

function quando(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const minuti = Math.floor(diff / 60000);
  if (minuti < 1) return 'adesso';
  if (minuti < 60) return `${minuti} min fa`;
  const ore = Math.floor(minuti / 60);
  if (ore < 24) return `${ore} h fa`;
  return new Date(iso).toLocaleDateString('it-IT');
}

const dataBreve = (iso) =>
  new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });

/**
 * Scheda della prenotazione allegata a un post: e' un collegamento alla
 * schermata di prenotazione del campo, cosi' chi legge puo' vedere le
 * disponibilita' o prenotare a sua volta.
 */
function SchedaPrenotazione({ post }) {
  const pieno = post.booking_iscritti >= post.booking_posti;
  return (
    <Link className="post-prenotazione" to={`/campo/${post.venue_id}`}>
      <span className="post-prenotazione-icona" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <rect x="3.5" y="5" width="17" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="post-prenotazione-testo">
        <strong>{post.booking_campo}</strong>
        <em>
          {post.booking_sport} · {dataBreve(post.booking_data)} alle {post.booking_ora}
        </em>
        <small className={pieno ? 'pieno' : ''}>
          {post.booking_iscritti} di {post.booking_posti} posti occupati
        </small>
      </span>
      <span className="freccia" aria-hidden="true">›</span>
    </Link>
  );
}

/**
 * Scheda "spenta" per un post la cui prenotazione non c'e' piu': cancellata
 * (il flag prenotazione_rimossa lo imposta un trigger del database) oppure
 * annullata da chi l'aveva organizzata. Il post resta leggibile e spiega
 * perche' non ci si puo' piu' aggiungere, invece di perdere la scheda senza
 * dire nulla.
 */
function PrenotazioneNonDisponibile({ annullata = false }) {
  return (
    <div className="post-prenotazione spenta">
      <span className="post-prenotazione-icona" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <rect x="3.5" y="5" width="17" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="m9.5 14.5 5 4M14.5 14.5l-5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="post-prenotazione-testo">
        <strong>{annullata ? 'Prenotazione annullata' : 'Prenotazione non più disponibile'}</strong>
        <em>
          {annullata
            ? 'Chi l’ha organizzata l’ha annullata: non è più possibile partecipare.'
            : 'La prenotazione collegata a questo post è stata cancellata.'}
        </em>
      </span>
    </div>
  );
}

export default function Posts() {
  const { utente, variaSaldo } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState([]);
  const [cerca, setCerca] = useState('');
  const [testo, setTesto] = useState('');
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [allegata, setAllegata] = useState('');
  const [errore, setErrore] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [inCorso, setInCorso] = useState(0); // prenotazione in aggiornamento
  // post da cui si sta per uscire: stessa conferma delle altre prenotazioni
  const [daLasciare, setDaLasciare] = useState(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([api.get('/posts'), api.get('/bookings')])
      .then(([elenco, mie]) => {
        if (!vivo) return;
        setPost(elenco);
        // si possono allegare solo le proprie prenotazioni ancora valide
        setPrenotazioni(mie.filter((b) => b.mio && b.stato !== 'annullata'));
      })
      .catch((err) => vivo && setErrore(err.message))
      .finally(() => vivo && setCaricamento(false));
    return () => {
      vivo = false;
    };
  }, []);

  const scelta = useMemo(
    () => prenotazioni.find((b) => String(b.id) === String(allegata)) || null,
    [prenotazioni, allegata]
  );

  // la ricerca guarda il testo del post, l'autore e la prenotazione allegata
  const postFiltrati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (!q) return post;
    return post.filter((p) =>
      [p.contenuto, p.autore, p.booking_campo, p.booking_sport].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    );
  }, [post, cerca]);

  async function pubblica(e) {
    e.preventDefault();
    const contenuto = testo.trim();
    if (!contenuto) return;
    try {
      const nuovo = await api.post('/posts', {
        contenuto,
        bookingId: allegata ? Number(allegata) : undefined,
      });
      setPost((p) => [nuovo, ...p]);
      setTesto('');
      setAllegata('');
      setErrore('');
    } catch (err) {
      setErrore(err.message);
    }
  }

  async function elimina(id) {
    try {
      await api.del(`/posts/${id}`);
      setPost((p) => p.filter((x) => x.id !== id));
    } catch (err) {
      setErrore(err.message);
    }
  }

  /** Aggiorna tutti i post che mostrano la stessa prenotazione. */
  function aggiornaPrenotazione(bookingId, iscritti, partecipo) {
    setPost((elenco) =>
      elenco.map((p) =>
        p.booking_id === bookingId
          ? { ...p, booking_iscritti: iscritti, booking_partecipo: partecipo }
          : p
      )
    );
  }

  /**
   * "Partecipa": se il campo e' a pagamento si passa prima dalla schermata di
   * pagamento della quota; se il campo e' gratuito ci si aggiunge subito.
   */
  async function partecipa(p) {
    if (Number(p.booking_prezzo) > 0) {
      navigate(`/partecipa/${p.booking_id}`);
      return;
    }
    setInCorso(p.booking_id);
    setErrore('');
    try {
      const b = await api.post(`/bookings/${p.booking_id}/join`);
      aggiornaPrenotazione(p.booking_id, b.iscritti, true);
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInCorso(0);
    }
  }

  /** Uscita da una prenotazione trovata in un post: solo dopo la conferma. */
  async function abbandona() {
    const bookingId = daLasciare.booking_id;
    setInCorso(bookingId);
    setErrore('');
    try {
      const b = await api.del(`/bookings/${bookingId}/join`);
      aggiornaPrenotazione(bookingId, b.iscritti, false);
      // la quota versata torna sul saldo: il contatore si aggiorna subito
      variaSaldo(b.rimborsato);
      setDaLasciare(null);
    } catch (err) {
      setErrore(err.message);
      setDaLasciare(null);
    } finally {
      setInCorso(0);
    }
  }

  return (
    <div className="app">
      <Intestazione titolo="Post" indietro={false} />

      <div className="ricerca-sezione">
        <BarraRicerca valore={cerca} onChange={setCerca} placeholder="Cerca fra i post" />
      </div>

      <div className="contenuto colonna-post">
        <form className="crea-post" onSubmit={pubblica}>
          <div className="crea-post-riga">
            <img src={(utente && utente.avatar) || '/img/avatar-lorenzo.jpg'} alt="" />
            <input
              type="text"
              placeholder="Scrivi un messaggio"
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              maxLength={1000}
            />
            <button type="submit">Post</button>
          </div>

          {prenotazioni.length > 0 && (
            <label className="allega-prenotazione">
              <span>Allega una prenotazione</span>
              <select value={allegata} onChange={(e) => setAllegata(e.target.value)}>
                <option value="">Nessuna</option>
                {prenotazioni.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.sport} · {b.campo} · {dataBreve(b.data)} alle {b.ora}
                  </option>
                ))}
              </select>
            </label>
          )}

          {scelta && (
            <p className="aiuto">
              Gli altri potranno aggiungersi a questa prenotazione direttamente dal post
              ({scelta.iscritti} di {scelta.posti} posti già occupati).
            </p>
          )}
        </form>

        <Errore testo={errore} />
        {caricamento && <Caricamento />}

        {postFiltrati.map((p) => {
          const mio = utente && p.user_id === utente.id;
          const annullata = Boolean(p.booking_id) && p.booking_stato === 'annullata';
          const sparita = !p.booking_id && p.prenotazione_rimossa;
          const attiva = Boolean(p.booking_id) && !annullata;
          const pieno = attiva && p.booking_iscritti >= p.booking_posti;

          return (
            <article key={p.id} className={`post${p.booking_id ? ' post-con-prenotazione' : ''}`}>
              <div className="autore">
                {/* foto e nome aprono il profilo di chi ha scritto il post */}
                <Link
                  className="autore-collegamento"
                  to={mio ? '/profilo' : `/utente/${p.user_id}`}
                  aria-label={mio ? 'Vai al tuo profilo' : `Apri il profilo di ${p.autore}`}
                >
                  <img src={p.avatar} alt="" loading="lazy" />
                  <div>
                    <h3>{p.autore}</h3>
                    <time>{quando(p.created_at)}</time>
                  </div>
                </Link>
                {mio && (
                  <button type="button" className="btn-testo" onClick={() => elimina(p.id)}>
                    Elimina
                  </button>
                )}
              </div>

              <p>{p.contenuto}</p>

              {sparita && <PrenotazioneNonDisponibile />}
              {annullata && <PrenotazioneNonDisponibile annullata />}

              {attiva && (
                <>
                  <SchedaPrenotazione post={p} />

                  {!mio && (
                    <div className="post-azioni">
                      {p.booking_partecipo ? (
                        <>
                          <span className="pillola-info">Sei iscritto</span>
                          <button
                            type="button"
                            className="btn-testo"
                            disabled={inCorso === p.booking_id}
                            onClick={() => setDaLasciare(p)}
                          >
                            Esci dalla prenotazione
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-pillola btn-partecipa"
                          disabled={pieno || inCorso === p.booking_id}
                          onClick={() => partecipa(p)}
                        >
                          {pieno
                            ? 'Posti esauriti'
                            : inCorso === p.booking_id
                              ? 'Attendi...'
                              : Number(p.booking_prezzo) > 0
                                ? `Partecipa · ${Number(p.booking_prezzo).toFixed(2)} €`
                                : 'Partecipa'}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })}

        {!caricamento && postFiltrati.length === 0 && (
          <p className="stato-vuoto">
            {cerca ? 'Nessun post corrisponde alla ricerca.' : 'Ancora nessun post.'}
          </p>
        )}
      </div>

      {daLasciare && (
        <Conferma
          titolo="Uscire dalla prenotazione?"
          messaggio={`Non risulterai più iscritto al ${String(daLasciare.booking_sport).toLowerCase()} a ${
            daLasciare.booking_campo
          } del ${new Date(daLasciare.booking_data).toLocaleDateString('it-IT')} alle ${
            daLasciare.booking_ora
          }${
            Number(daLasciare.booking_prezzo) > 0
              ? `, e i ${Number(daLasciare.booking_prezzo).toFixed(2)} € della tua quota torneranno sul saldo SportEasy`
              : ''
          }. Il posto tornerà libero per qualcun altro.`}
          etichetta="Sì, esci"
          etichettaAnnulla="Torna indietro"
          pericolo
          inCorso={inCorso === daLasciare.booking_id}
          onConferma={abbandona}
          onAnnulla={() => setDaLasciare(null)}
        />
      )}

      <Navigazione />
    </div>
  );
}
