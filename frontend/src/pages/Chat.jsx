import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navigazione from '../components/Navigazione';
import { BottoneIndietro, Caricamento, Errore, Modale } from '../components/Ui';

/** "14:32" per oggi, "lun 14:32" nella settimana, data completa oltre. */
function orario(iso) {
  const data = new Date(iso);
  const ora = data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const giorni = Math.floor((Date.now() - data.getTime()) / 86400000);
  if (giorni < 1) return ora;
  if (giorni < 7) return `${data.toLocaleDateString('it-IT', { weekday: 'short' })} ${ora}`;
  return `${data.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} ${ora}`;
}

/** Separatore di giornata sopra il primo messaggio di ogni data. */
function giornata(iso) {
  const data = new Date(iso);
  const giorni = Math.floor((Date.now() - data.getTime()) / 86400000);
  if (giorni < 1) return 'Oggi';
  if (giorni < 2) return 'Ieri';
  return data.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
}

/** Data compatta: "05/09". */
const dataBreve = (iso) =>
  new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });

/**
 * INVITO IN CHAT.
 *
 * Un messaggio con una prenotazione allegata non e' testo e basta: diventa una
 * scheda con i dati della partita e i tasti per partecipare o rifiutare.
 * Cosa si vede dipende da chi legge: chi l'ha mandata vede solo il riepilogo,
 * chi partecipa gia' lo legge scritto, chi ha rifiutato non se lo ritrova
 * riproposto ogni volta.
 */
function InvitoInChat({ m, mio, inCorso, onPartecipa, onRifiuta }) {
  const annullata = m.booking_stato === 'annullata';
  const pieno = m.booking_iscritti >= m.booking_posti;
  const rifiutato = m.invito_stato === 'rifiutato';
  const prezzo = Number(m.booking_prezzo) || 0;

  // i tasti compaiono solo a chi puo' ancora decidere qualcosa
  const decidibile = !mio && !m.booking_partecipo && !annullata && !pieno && !rifiutato;

  return (
    <div className={`invito-chat${annullata ? ' spento' : ''}`}>
      {/* la scheda porta alla pagina del campo, come nei post */}
      <Link className="invito-scheda" to={`/campo/${m.venue_id}`}>
        <img src={m.booking_immagine} alt="" loading="lazy" />
        <span className="invito-testo">
          <strong>{m.booking_campo}</strong>
          <em>
            {m.booking_sport} · {dataBreve(m.booking_data)} alle {m.booking_ora}
          </em>
          <small className={pieno ? 'pieno' : ''}>
            {m.booking_iscritti} di {m.booking_posti} posti occupati
            {prezzo > 0 ? ` · ${prezzo.toFixed(2)} € a testa` : ' · gratuito'}
          </small>
        </span>
      </Link>

      {annullata && <span className="invito-esito">Prenotazione annullata</span>}
      {!annullata && mio && <span className="invito-esito">Invito inviato</span>}
      {!annullata && !mio && m.booking_partecipo && (
        <span className="invito-esito ok">Hai accettato: partecipi</span>
      )}
      {!annullata && !mio && !m.booking_partecipo && rifiutato && (
        <span className="invito-esito">Hai rifiutato l’invito</span>
      )}
      {!annullata && !mio && !m.booking_partecipo && !rifiutato && pieno && (
        <span className="invito-esito">Posti esauriti</span>
      )}

      {decidibile && (
        <span className="invito-azioni">
          <button
            type="button"
            className="btn btn-pillola"
            disabled={inCorso}
            onClick={() => onPartecipa(m)}
          >
            {prezzo > 0 ? `Partecipa · ${prezzo.toFixed(2)} €` : 'Partecipa'}
          </button>
          <button type="button" className="btn-testo pericolo" disabled={inCorso} onClick={() => onRifiuta(m)}>
            Rifiuta
          </button>
        </span>
      )}
    </div>
  );
}

/**
 * Chat diretta con un amico (tipo="utente") o chat di un gruppo (tipo="gruppo").
 * Entrambe usano le stesse rotte /api/chats, che controllano i permessi.
 */
export default function Chat({ tipo }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { utente } = useAuth();
  const [chat, setChat] = useState(null);
  const [testo, setTesto] = useState('');
  const [errore, setErrore] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [invio, setInvio] = useState(false);
  // elenco dei partecipanti: si apre toccando l'immagine del gruppo
  const [membri, setMembri] = useState(null);
  const [caricaMembri, setCaricaMembri] = useState(false);
  // condivisione di una propria prenotazione nella chat
  const [prenotazioni, setPrenotazioni] = useState(null);
  const [caricaPrenotazioni, setCaricaPrenotazioni] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const fondo = useRef(null);

  const percorso = tipo === 'gruppo' ? `/chats/groups/${id}` : `/chats/users/${id}`;

  const carica = useCallback(
    (silenzioso = false) =>
      api
        .get(percorso)
        .then((r) => setChat(r))
        .catch((err) => !silenzioso && setErrore(err.message))
        .finally(() => setCaricamento(false)),
    [percorso]
  );

  useEffect(() => {
    setCaricamento(true);
    carica();
    // aggiornamento periodico: nelle chat di gruppo arrivano messaggi da altri
    const timer = setInterval(() => carica(true), 8000);
    return () => clearInterval(timer);
  }, [carica]);

  /* Si scende in fondo solo quando arriva un messaggio nuovo: il
     ricaricamento periodico non deve spostare la pagina mentre si legge o si
     risponde a un invito. */
  const quantiMessaggi = (chat && chat.messaggi.length) || 0;
  useEffect(() => {
    if (fondo.current) fondo.current.scrollIntoView({ block: 'end' });
  }, [quantiMessaggi]);

  /** Apre la scheda con i partecipanti del gruppo (immagine della chat). */
  async function mostraMembri() {
    setMembri([]);
    setCaricaMembri(true);
    try {
      setMembri(await api.get(`/groups/${id}/members`));
    } catch (err) {
      setErrore(err.message);
      setMembri(null);
    } finally {
      setCaricaMembri(false);
    }
  }

  /**
   * Apre l'elenco delle proprie prenotazioni condivisibili: aperte, non
   * annullate e con almeno un posto libero (il server ricontrolla).
   */
  async function apriPrenotazioni() {
    setPrenotazioni([]);
    setCaricaPrenotazioni(true);
    try {
      const elenco = await api.get('/bookings');
      const oggi = new Date().toISOString().slice(0, 10);
      setPrenotazioni(
        elenco.filter(
          (b) =>
            b.mio &&
            b.stato !== 'annullata' &&
            String(b.data).slice(0, 10) >= oggi &&
            b.iscritti < b.posti
        )
      );
    } catch (err) {
      setErrore(err.message);
      setPrenotazioni(null);
    } finally {
      setCaricaPrenotazioni(false);
    }
  }

  /** Manda in chat la prenotazione scelta: per chi la riceve e' un invito. */
  async function condividi(prenotazione) {
    setInCorso(true);
    try {
      const messaggio = await api.post(percorso, { bookingId: prenotazione.id });
      setChat((c) => ({ ...c, messaggi: [...c.messaggi, messaggio] }));
      setPrenotazioni(null);
      setErrore('');
    } catch (err) {
      setErrore(err.message);
      setPrenotazioni(null);
    } finally {
      setInCorso(false);
    }
  }

  /**
   * "Partecipa" da un invito ricevuto in chat: se la quota e' a pagamento si
   * passa dalla schermata di partecipazione, altrimenti ci si aggiunge subito.
   */
  async function partecipa(m) {
    if (Number(m.booking_prezzo) > 0) {
      navigate(`/partecipa/${m.booking_id}`);
      return;
    }
    setInCorso(true);
    setErrore('');
    try {
      await api.post(`/bookings/${m.booking_id}/join`, {});
      await carica(true);
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInCorso(false);
    }
  }

  /** "Rifiuta": l'invito resta in chat ma segnato, e chi ha invitato lo sa. */
  async function rifiuta(m) {
    setInCorso(true);
    setErrore('');
    try {
      await api.post(`/bookings/${m.booking_id}/invite/decline`, {});
      await carica(true);
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInCorso(false);
    }
  }

  async function invia(e) {
    e.preventDefault();
    const contenuto = testo.trim();
    if (!contenuto || invio) return;
    setInvio(true);
    try {
      const messaggio = await api.post(percorso, { testo: contenuto });
      setChat((c) => ({ ...c, messaggi: [...c.messaggi, messaggio] }));
      setTesto('');
      setErrore('');
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInvio(false);
    }
  }

  const messaggi = (chat && chat.messaggi) || [];
  let ultimaGiornata = null;

  return (
    <div className="app senza-tabbar chat-pagina">
      <header className="intestazione intestazione-chat">
        <BottoneIndietro a="/amici" />
        {chat &&
          (tipo === 'utente' ? (
              <Link className="chat-titolo" to={`/utente/${chat.utenteId}`}>
                <img src={chat.immagine} alt="" />
                <span>
                  <strong>{chat.titolo}</strong>
                  <em>{chat.sottotitolo || 'Vedi il profilo'}</em>
                </span>
              </Link>
          ) : (
            <span className="chat-titolo">
              <button
                type="button"
                className="chat-immagine-gruppo"
                onClick={mostraMembri}
                aria-label={`Partecipanti di ${chat.titolo}`}
                title="Vedi i partecipanti"
              >
                <img src={chat.immagine} alt="" />
              </button>
              <button type="button" className="chat-titolo-testo" onClick={mostraMembri}>
                <strong>{chat.titolo}</strong>
                <em>{chat.sottotitolo}</em>
              </button>
            </span>
          ))}
      </header>

      {membri !== null && (
        <Modale titolo="Partecipanti al gruppo" onChiudi={() => setMembri(null)}>
          {caricaMembri && <Caricamento testo="Carico i partecipanti..." />}
          {!caricaMembri && membri.length === 0 && (
            <p className="stato-vuoto">Nessun partecipante.</p>
          )}
          {/* ogni riga apre il profilo di quella persona (il proprio, se e' l'utente) */}
          <ul className="elenco-membri">
            {membri.map((m) => {
              const sonoIo = utente && m.id === utente.id;
              return (
                <li key={m.id}>
                  <Link
                    to={sonoIo ? '/profilo' : `/utente/${m.id}`}
                    onClick={() => setMembri(null)}
                    aria-label={sonoIo ? 'Vai al tuo profilo' : `Apri il profilo di ${m.nome}`}
                  >
                    <img src={m.avatar} alt="" loading="lazy" />
                    <span>
                      <strong>{m.nome}</strong>
                      <em>{m.sport || 'Nessuno sport indicato'}</em>
                    </span>
                    {sonoIo && <span className="pillola-info chiara">Tu</span>}
                    <span className="freccia" aria-hidden="true">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Modale>
      )}

      <div className="chat-messaggi">
        <Errore testo={errore} />
        {caricamento && <Caricamento testo="Carico la conversazione..." />}

        {!caricamento && messaggi.length === 0 && !errore && (
          <p className="stato-vuoto">
            Nessun messaggio.
            <br />
            Scrivi tu il primo!
          </p>
        )}

        {messaggi.map((m) => {
          const mio = utente && m.mittente_id === utente.id;
          const giorno = giornata(m.created_at);
          const nuovoGiorno = giorno !== ultimaGiornata;
          ultimaGiornata = giorno;

          return (
            <div key={m.id}>
              {nuovoGiorno && <p className="chat-giorno">{giorno}</p>}
              <div className={`bolla ${mio ? 'mia' : 'altrui'}${m.booking_id ? ' con-invito' : ''}`}>
                {!mio && tipo === 'gruppo' && <span className="autore">{m.mittente}</span>}
                <p>{m.testo}</p>
                {m.booking_id && (
                  <InvitoInChat
                    m={m}
                    mio={mio}
                    inCorso={inCorso}
                    onPartecipa={partecipa}
                    onRifiuta={rifiuta}
                  />
                )}
                <time dateTime={m.created_at}>{orario(m.created_at)}</time>
              </div>
            </div>
          );
        })}

        <div ref={fondo} />
      </div>

      <form className="chat-invio" onSubmit={invia}>
        <button
          type="button"
          className="chat-allega"
          onClick={apriPrenotazioni}
          aria-label="Invia una prenotazione"
          title="Invia una prenotazione"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <rect x="3.5" y="5" width="17" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 13v5M9.5 15.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <input
          type="text"
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Scrivi un messaggio"
          maxLength={1000}
          aria-label="Scrivi un messaggio"
        />
        <button type="submit" aria-label="Invia" disabled={invio || !testo.trim()}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M3.5 20.5 21 12 3.5 3.5 6 12l-2.5 8.5Z" fill="currentColor" />
          </svg>
        </button>
      </form>

      {prenotazioni !== null && (
        <Modale titolo="Invia una prenotazione" onChiudi={() => setPrenotazioni(null)}>
          {caricaPrenotazioni && <Caricamento testo="Carico le tue prenotazioni..." />}
          {!caricaPrenotazioni && prenotazioni.length === 0 && (
            <p className="stato-vuoto">
              Non hai prenotazioni da condividere: servono prenotazioni tue, future e con almeno un
              posto libero.
            </p>
          )}
          <ul className="elenco-membri elenco-prenotazioni">
            {prenotazioni.map((b) => (
              <li key={b.id}>
                <button type="button" disabled={inCorso} onClick={() => condividi(b)}>
                  <img src={b.immagine} alt="" loading="lazy" />
                  <span>
                    <strong>{b.campo}</strong>
                    <em>
                      {b.sport} · {new Date(b.data).toLocaleDateString('it-IT')} alle {b.ora} ·{' '}
                      {b.posti - b.iscritti === 1
                        ? '1 posto libero'
                        : `${b.posti - b.iscritti} posti liberi`}
                    </em>
                  </span>
                  <span className="freccia" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        </Modale>
      )}

      {/* su telefono la barra resta nascosta (senza-tabbar), su desktop e' la barra laterale */}
      <Navigazione />
    </div>
  );
}
