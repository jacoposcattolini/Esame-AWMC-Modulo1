/**
 * Parti condivise dalle schermate del pannello di controllo.
 *
 * Il pannello e' una sezione del frontend come le altre: parla col backend
 * solo tramite le rotte /api/admin/* (client apiAdmin), che vogliono il token
 * dell'amministratore. Nessuna di queste schermate sa nulla del database.
 */
import { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { apiAdmin } from '../../api';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin.css';

const VOCI = [
  { a: '/admin', testo: 'Dashboard', esatta: true },
  { a: '/admin/prenotazioni', testo: 'Prenotazioni' },
  { a: '/admin/campi', testo: 'Campi' },
  { a: '/admin/post', testo: 'Post' },
  { a: '/admin/utenti', testo: 'Utenti' },
];

/** Cornice comune: barra in alto, contenuto centrato, uscita dal pannello. */
export function LayoutAdmin({ titolo, sottotitolo, children }) {
  const { esciDaAdmin } = useAuth();
  const navigate = useNavigate();

  function esci() {
    esciDaAdmin();
    navigate('/accedi', { replace: true });
  }

  return (
    <div className="pannello-admin">
      <header className="topbar">
        <div className="brand">
          <span className="dot" /> SportEasy
        </div>
        <nav>
          {VOCI.map((v) => (
            <NavLink
              key={v.a}
              to={v.a}
              end={v.esatta}
              className={({ isActive }) => (isActive ? 'attivo' : undefined)}
            >
              {v.testo}
            </NavLink>
          ))}
          <button type="button" className="link-esci" onClick={esci}>
            Esci
          </button>
        </nav>
      </header>

      <main className="contenuto-pannello">
        <h1>{titolo}</h1>
        {sottotitolo ? <p className="sottotitolo">{sottotitolo}</p> : null}
        {children}
      </main>
    </div>
  );
}

/** Riga di avviso dopo un'azione (verde se andata bene, rossa se no). */
export function Avviso({ avviso }) {
  if (!avviso || !avviso.testo) return null;
  return <p className={`avviso ${avviso.ok ? 'ok' : 'errore'}`}>{avviso.testo}</p>;
}

/**
 * Carica i dati di una schermata del pannello.
 * Se il token e' scaduto (401) chiude la sessione admin: la guardia delle
 * rotte riporta da sola alla schermata di accesso.
 */
export function useDatiAdmin(percorso) {
  const { esciDaAdmin } = useAuth();
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState('');
  const [caricamento, setCaricamento] = useState(true);

  const carica = useCallback(async () => {
    setCaricamento(true);
    try {
      setDati(await apiAdmin.get(percorso));
      setErrore('');
    } catch (err) {
      if (err.status === 401) esciDaAdmin();
      else setErrore(err.message);
    } finally {
      setCaricamento(false);
    }
  }, [percorso, esciDaAdmin]);

  useEffect(() => {
    carica();
  }, [carica]);

  return { dati, errore, caricamento, ricarica: carica };
}

/**
 * Esegue un'azione (eliminazione, cambio stato, creazione) e prepara il
 * messaggio da mostrare. Al termine ricarica i dati della schermata, cosi'
 * la tabella resta allineata a quello che c'e' davvero sul server.
 */
export function useAzioneAdmin({ ricarica }) {
  const { esciDaAdmin } = useAuth();
  const [avviso, setAvviso] = useState(null);
  const [inCorso, setInCorso] = useState(false);

  const esegui = useCallback(
    async (chiamata, messaggioOk) => {
      setInCorso(true);
      try {
        const risposta = await chiamata();
        const testo =
          typeof messaggioOk === 'function' ? messaggioOk(risposta) : messaggioOk;
        setAvviso({ ok: true, testo });
        await ricarica();
        return risposta;
      } catch (err) {
        if (err.status === 401) esciDaAdmin();
        else setAvviso({ ok: false, testo: err.message });
        return null;
      } finally {
        setInCorso(false);
      }
    },
    [ricarica, esciDaAdmin]
  );

  return { avviso, setAvviso, inCorso, esegui };
}

/** Date e importi come nelle tabelle del vecchio pannello. */
export const data = (v) => new Date(v).toLocaleDateString('it-IT');

export const dataOra = (v) =>
  new Date(v).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const euro = (v) => `${Number(v).toFixed(2)} €`;
