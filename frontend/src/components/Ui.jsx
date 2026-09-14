import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Bottone tondo "indietro" (come nel design Figma). */
export function BottoneIndietro({ a }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="btn-indietro"
      aria-label="Indietro"
      onClick={() => (a ? navigate(a) : navigate(-1))}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * Intestazione di schermata.
 * - con la freccia indietro (schermate di dettaglio): titolo centrato fra la
 *   freccia e l'eventuale azione a destra;
 * - senza freccia (schermate raggiungibili dalla barra di navigazione): il
 *   titolo parte da sinistra, allineato al contenuto sottostante;
 * - `centrato` forza il titolo al centro anche senza freccia (schermata Swipe).
 */
export function Intestazione({ titolo, indietro = true, azione = null, centrato = false }) {
  const senzaFreccia = !indietro;
  const classi = ['intestazione'];
  if (senzaFreccia) classi.push(centrato ? 'intestazione-centrata' : 'intestazione-sinistra');

  return (
    <header className={classi.join(' ')}>
      {indietro && <BottoneIndietro />}
      <h1>{titolo}</h1>
      <span className="azione">{azione}</span>
    </header>
  );
}

/** Barra di ricerca in stile Material (come nel design). */
export function BarraRicerca({ valore, onChange, placeholder = 'Cerca' }) {
  return (
    <div className="barra-ricerca">
      <input
        type="search"
        value={valore}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      />
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function Stelle({ voto = 5 }) {
  return (
    <div className="stelle" aria-label={`Valutazione ${voto} su 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9z"
            fill={n <= voto ? '#82ca25' : 'none'}
            stroke="#82ca25"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </div>
  );
}

/** Campanella con pallino verde per le notifiche. */
export function Campanella({ onClick, nuove = false }) {
  return (
    <button type="button" className="campanella" onClick={onClick} aria-label="Notifiche">
      <svg viewBox="0 0 26 26" width="26" height="26" aria-hidden="true">
        <path d="M6 10a7 7 0 0 1 14 0c0 4 1.4 5.6 2 6.4H4c.6-.8 2-2.4 2-6.4Z"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M10.6 20.2a2.8 2.8 0 0 0 4.8 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {nuove && <span className="pallino" />}
    </button>
  );
}

export function Caricamento({ testo = 'Caricamento...' }) {
  return <p className="stato-vuoto">{testo}</p>;
}

export function Errore({ testo }) {
  if (!testo) return null;
  return <p className="messaggio-errore">{testo}</p>;
}

/**
 * Finestra modale generica: sfondo scurito, scheda centrata, chiusura con
 * Esc o toccando fuori. La usano l'elenco dei membri del gruppo e i dialog
 * di conferma.
 */
export function Modale({ titolo, onChiudi, children, classe = '' }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onChiudi();
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [onChiudi]);

  return (
    <div className="modale-sfondo" onClick={onChiudi} role="presentation">
      <div
        className={`modale ${classe}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={titolo}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modale-testa">
          <h2>{titolo}</h2>
          <button type="button" className="modale-chiudi" onClick={onChiudi} aria-label="Chiudi">
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

/**
 * Dialog di conferma per le azioni non annullabili (uscita, cancellazione di
 * una prenotazione o dell'account). Spiega sempre cosa sta per succedere.
 */
export function Conferma({
  titolo,
  messaggio,
  etichetta = 'Conferma',
  etichettaAnnulla = 'Annulla',
  pericolo = false,
  onConferma,
  onAnnulla,
  inCorso = false,
}) {
  return (
    <Modale titolo={titolo} onChiudi={onAnnulla} classe="modale-conferma">
      <p className="modale-messaggio">{messaggio}</p>
      <div className="modale-azioni">
        <button type="button" className="btn btn-bordo" onClick={onAnnulla} disabled={inCorso}>
          {etichettaAnnulla}
        </button>
        <button
          type="button"
          className={`btn ${pericolo ? 'btn-pericolo' : 'btn-verde'}`}
          onClick={onConferma}
          disabled={inCorso}
        >
          {inCorso ? 'Attendi...' : etichetta}
        </button>
      </div>
    </Modale>
  );
}
