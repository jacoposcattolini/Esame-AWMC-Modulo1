import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navigazione from '../components/Navigazione';
import { Caricamento, Conferma, Errore, Intestazione } from '../components/Ui';

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { variaSaldo } = useAuth();

  const [utente, setUtente] = useState(null);
  // prenotazioni ancora aperte organizzate da questa persona
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [errore, setErrore] = useState('');
  const [inCorso, setInCorso] = useState(0);
  const [amiciziaInCorso, setAmiciziaInCorso] = useState(false);
  const [daLasciare, setDaLasciare] = useState(null);

  useEffect(() => {
    let vivo = true;
    setPrenotazioni([]);
    api
      .get(`/users/${id}`)
      .then((u) => vivo && setUtente(u))
      .catch((err) => vivo && setErrore(err.message));

    // se le prenotazioni non arrivano, il profilo resta comunque leggibile
    api
      .get(`/users/${id}/bookings`)
      .then((b) => vivo && setPrenotazioni(b))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [id]);

  /**
   * Un solo bottone per tutti gli stati dell'amicizia: manda la richiesta,
   * la annulla se e' ancora in attesa, accetta quella ricevuta oppure toglie
   * l'amicizia.
   */
  async function alterna() {
    setErrore('');
    setAmiciziaInCorso(true);
    try {
      if (utente.amicizia === 'accettata') {
        await api.del(`/friends/${utente.id}`);
        setUtente((u) => ({ ...u, amico: false, amicizia: 'nessuna' }));
      } else if (utente.amicizia === 'inviata') {
        // richiesta ancora in attesa: la si ritira, e sparisce anche a chi
        // l'aveva ricevuta
        await api.del(`/friends/requests/${utente.id}`);
        setUtente((u) => ({ ...u, amico: false, amicizia: 'nessuna' }));
      } else if (utente.amicizia === 'ricevuta') {
        await api.post(`/friends/requests/${utente.id}/accept`);
        setUtente((u) => ({ ...u, amico: true, amicizia: 'accettata' }));
      } else {
        const esito = await api.post(`/friends/${utente.id}`);
        setUtente((u) => ({
          ...u,
          amico: esito.stato === 'accettata',
          amicizia: esito.stato === 'accettata' ? 'accettata' : 'inviata',
        }));
      }
    } catch (err) {
      setErrore(err.message);
    } finally {
      setAmiciziaInCorso(false);
    }
  }

  /** Testo del bottone in base allo stato dell'amicizia. */
  const etichettaAmicizia = {
    accettata: 'Rimuovi dagli amici',
    inviata: 'Annulla la richiesta',
    ricevuta: 'Accetta la richiesta',
  }[utente && utente.amicizia] || 'Aggiungi agli amici';

  /** Aggiorna una riga dopo un'iscrizione o un'uscita. */
  function aggiorna(bookingId, iscritti, partecipo) {
    setPrenotazioni((elenco) =>
      elenco.map((b) => (b.id === bookingId ? { ...b, iscritti, partecipo } : b))
    );
  }

  /**
   * Come dal feed dei post: se il campo e' a pagamento si passa dalla
   * schermata di pagamento della quota, altrimenti ci si aggiunge subito.
   * I limiti di partecipanti per sport li applica comunque il server.
   */
  async function partecipa(b) {
    if (Number(b.prezzo) > 0) {
      navigate(`/partecipa/${b.id}`);
      return;
    }
    setInCorso(b.id);
    setErrore('');
    try {
      const agg = await api.post(`/bookings/${b.id}/join`);
      aggiorna(b.id, agg.iscritti, true);
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInCorso(0);
    }
  }

  async function esci() {
    const b = daLasciare;
    setInCorso(b.id);
    setErrore('');
    try {
      const agg = await api.del(`/bookings/${b.id}/join`);
      aggiorna(b.id, agg.iscritti, false);
      variaSaldo(agg.rimborsato);
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
      <Intestazione titolo={utente ? utente.nome : 'Profilo'} />

      <Errore testo={errore} />
      {!utente && !errore && <Caricamento />}

      {utente && (
        <>
          <div className="profilo-testa">
            <img src={utente.avatar} alt="" />
            <div>
              <h1>{utente.nome}</h1>
              <p>{utente.bio}</p>
            </div>
          </div>

          <div className="contenuto">
            <button
              type="button"
              className="btn btn-pillola"
              style={{ marginTop: 18 }}
              disabled={amiciziaInCorso}
              onClick={alterna}
            >
              {etichettaAmicizia}
            </button>
          </div>

          <div className="dati-profilo">
            <div className="voce">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div>
                <h3>Sport preferito</h3>
                <p>{utente.sport || 'Non indicato'}</p>
              </div>
            </div>
            <div className="voce">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
              <div>
                <h3>Comune di residenza</h3>
                <p>{utente.comune || 'Non indicato'}</p>
              </div>
            </div>
          </div>

          <div className="contenuto prenotazioni-utente">
            <h2>Prenotazioni aperte</h2>
            <p className="aiuto">
              {prenotazioni.length === 0
                ? `${utente.nome.split(' ')[0]} non ha prenotazioni aperte al momento.`
                : 'Partite ancora da giocare: puoi aggiungerti direttamente da qui.'}
            </p>

            {prenotazioni.map((b) => {
              const pieno = b.iscritti >= b.posti;
              return (
                <div key={b.id} className="riga-prenotazione">
                  <img src={b.immagine} alt="" loading="lazy" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3>{b.campo}</h3>
                    <p>
                      {b.sport} · {new Date(b.data).toLocaleDateString('it-IT')} alle {b.ora}
                      <br />
                      {b.iscritti} di {b.posti} posti occupati
                      {pieno ? ' (al completo)' : ''}
                      {Number(b.prezzo) > 0 ? ` · ${Number(b.prezzo).toFixed(2)} € a persona` : ' · gratuito'}
                    </p>
                    <span className={`badge ${b.stato}`}>{b.stato.replace('_', ' ')}</span>
                  </div>

                  {b.partecipo ? (
                    <button
                      type="button"
                      className="btn-testo partecipa"
                      disabled={inCorso === b.id}
                      onClick={() => setDaLasciare(b)}
                    >
                      Esci
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-pillola partecipa"
                      disabled={pieno || inCorso === b.id}
                      onClick={() => partecipa(b)}
                    >
                      {pieno
                        ? 'Posti esauriti'
                        : inCorso === b.id
                          ? 'Attendi...'
                          : Number(b.prezzo) > 0
                            ? `Partecipa · ${Number(b.prezzo).toFixed(2)} €`
                            : 'Partecipa'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {daLasciare && (
        <Conferma
          titolo="Uscire dalla prenotazione?"
          messaggio={`Non risulterai più iscritto al ${String(daLasciare.sport).toLowerCase()} a ${
            daLasciare.campo
          } del ${new Date(daLasciare.data).toLocaleDateString('it-IT')} alle ${daLasciare.ora}${
            Number(daLasciare.prezzo) > 0
              ? `, e i ${Number(daLasciare.prezzo).toFixed(2)} € della tua quota torneranno sul saldo SportEasy`
              : ''
          }. Il posto tornerà libero per qualcun altro.`}
          etichetta="Sì, esci"
          etichettaAnnulla="Torna indietro"
          pericolo
          inCorso={inCorso === daLasciare.id}
          onConferma={esci}
          onAnnulla={() => setDaLasciare(null)}
        />
      )}

      <Navigazione />
    </div>
  );
}
