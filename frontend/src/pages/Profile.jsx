import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navigazione from '../components/Navigazione';
import { Conferma, Errore, Intestazione } from '../components/Ui';

function Voce({ icona, titolo, valore }) {
  return (
    <div className="voce">
      {icona}
      <div>
        <h3>{titolo}</h3>
        <p>{valore || 'Non indicato'}</p>
      </div>
    </div>
  );
}

export default function Profile() {
  const { utente, esci } = useAuth();
  const navigate = useNavigate();
  // 'esci' | 'elimina' | null: quale dialog di conferma e' aperto
  const [conferma, setConferma] = useState(null);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState('');

  if (!utente) return null;

  /** Esce dall'account dopo la conferma. */
  async function confermaUscita() {
    setInCorso(true);
    await esci();
    setConferma(null);
    setInCorso(false);
    navigate('/accedi', { replace: true });
  }

  /** Cancella definitivamente l'account e riporta alla schermata di accesso. */
  async function confermaEliminazione() {
    setInCorso(true);
    setErrore('');
    try {
      await api.del('/profile');
      setConferma(null);
      await esci();
      navigate('/accedi', { replace: true });
    } catch (err) {
      setErrore(err.message);
      setConferma(null);
    } finally {
      setInCorso(false);
    }
  }

  const nascita = utente.data_nascita
    ? new Date(utente.data_nascita).toLocaleDateString('it-IT')
    : '';

  return (
    <div className="app">
      <Intestazione titolo="Profilo" indietro={false} />

      <div className="profilo-testa">
        <img src={utente.avatar} alt="" />
        <div>
          <h1>{utente.nome}</h1>
          <p>{utente.bio}</p>
        </div>
      </div>

      <div className="profilo-azioni">
        <button
          type="button"
          className="btn-modifica"
          onClick={() => navigate('/profilo/modifica')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="m13.5 6.5 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Modifica profilo
        </button>
      </div>

      <Errore testo={errore} />

      <div className="saldo-sporteasy">
        <span className="saldo-icona" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <rect x="2.5" y="6" width="19" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M2.5 10.5h19" stroke="currentColor" strokeWidth="2" />
            <circle cx="17.5" cy="15" r="1.4" fill="currentColor" />
          </svg>
        </span>
        <span className="saldo-testo">
          <small>Saldo SportEasy</small>
          <strong>{Number(utente.saldo || 0).toFixed(2)} €</strong>
        </span>
        <span className="saldo-nota">
          {Number(utente.saldo || 0) > 0
            ? 'Utilizzabile per le prossime prenotazioni'
            : 'Qui arrivano i rimborsi delle prenotazioni annullate'}
        </span>
      </div>

      <div className="dati-profilo">
        <Voce
          titolo="Comune di residenza"
          valore={utente.comune}
          icona={
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          }
        />
        <Voce
          titolo="Data di nascita"
          valore={nascita}
          icona={
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          }
        />
        <Voce
          titolo="Sport preferiti"
          valore={utente.sport}
          icona={
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 3a9 9 0 0 0 0 18M12 3a9 9 0 0 1 0 18M3.5 9h17M3.5 15h17" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          }
        />
        <Voce
          titolo="Età"
          valore={utente.eta ? `${utente.eta} anni` : ''}
          icona={
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          }
        />
        <Voce
          titolo="Email"
          valore={utente.email}
          icona={
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          }
        />

        <button type="button" className="voce-link" onClick={() => navigate('/profilo/pagamenti')}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <rect x="2.5" y="5" width="19" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M2.5 10h19" stroke="currentColor" strokeWidth="2" />
          </svg>
          Metodi di pagamento
          <span className="freccia">›</span>
        </button>

        <button type="button" className="voce-link" onClick={() => navigate('/prenotazioni')}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 6.5V12l3.5 2.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Prenotazioni
          <span className="freccia">›</span>
        </button>

        <button type="button" className="voce-link esci" onClick={() => setConferma('esci')}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M10 8 6 12l4 4M6 12h9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Esci
          <span className="freccia">›</span>
        </button>

        {/* l'account DEMO non e' eliminabile: si azzera da solo all'uscita */}
        {!utente.demo && (
          <button type="button" className="voce-link elimina" onClick={() => setConferma('elimina')}>
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M5 7h14M10 7V5.2A1.2 1.2 0 0 1 11.2 4h1.6A1.2 1.2 0 0 1 14 5.2V7m-7 0 .9 12.1A1.5 1.5 0 0 0 9.4 20.5h5.2a1.5 1.5 0 0 0 1.5-1.4L17 7"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Elimina account
            <span className="freccia">›</span>
          </button>
        )}
      </div>

      {utente.demo && (
        <p className="nota-demo">
          Questo è l’account DEMO: non può essere eliminato e a ogni uscita i suoi dati tornano
          allo stato iniziale.
        </p>
      )}

      {conferma === 'esci' && (
        <Conferma
          titolo="Vuoi uscire?"
          messaggio={
            utente.demo
              ? 'Stai usando l’account DEMO: uscendo, tutto quello che hai fatto in questa sessione (post, prenotazioni, amicizie, modifiche al profilo) verrà annullato e l’account tornerà allo stato iniziale.'
              : 'Verrai disconnesso da SportEasy su questo dispositivo e tornerai alla schermata di accesso. I tuoi dati, le prenotazioni e le chat restano al loro posto: ti basterà accedere di nuovo.'
          }
          etichetta="Esci"
          inCorso={inCorso}
          onConferma={confermaUscita}
          onAnnulla={() => setConferma(null)}
        />
      )}

      {conferma === 'elimina' && (
        <Conferma
          titolo="Eliminare l’account?"
          messaggio={`L’account di ${utente.nome} verrà cancellato definitivamente insieme a profilo, prenotazioni, post, amicizie, gruppi, chat e notifiche. L’operazione non può essere annullata.`}
          etichetta="Elimina account"
          pericolo
          inCorso={inCorso}
          onConferma={confermaEliminazione}
          onAnnulla={() => setConferma(null)}
        />
      )}

      <Navigazione />
    </div>
  );
}
