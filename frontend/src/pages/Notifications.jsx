import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Navigazione from '../components/Navigazione';
import { BarraRicerca, Caricamento, Errore, Intestazione } from '../components/Ui';

const UN_GIORNO = 24 * 60 * 60 * 1000;

/** Da quanto e' arrivata: "adesso", "12 min fa", "3 h fa", "5 g fa". */
function daQuanto(iso) {
  const minuti = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minuti < 1) return 'adesso';
  if (minuti < 60) return `${minuti} min fa`;
  const ore = Math.floor(minuti / 60);
  if (ore < 24) return `${ore} h fa`;
  const giorni = Math.floor(ore / 24);
  if (giorni < 7) return `${giorni} g fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** Orario esatto, mostrato sotto al tempo relativo. */
function orarioEsatto(iso) {
  const data = new Date(iso);
  return data.toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Schermata da aprire toccando la notifica. Di norma arriva dal server nel
 * campo "link"; per le notifiche piu' vecchie si ricade sul tipo.
 */
function destinazione(n) {
  if (n.link) return n.link;
  return n.tipo === 'prenotazione' ? '/prenotazioni' : '/amici';
}

function Riga({ n, onApri }) {
  return (
    <article
      className={`notifica${n.letta ? '' : ' non-letta'}`}
      role="button"
      tabIndex={0}
      onClick={() => onApri(n)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onApri(n))}
    >
      {n.tipo === 'prenotazione' || !n.avatar ? (
        <span className="icona">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="m4 12.5 5.2 5.2L20 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <img src={n.avatar} alt="" loading="lazy" />
      )}

      <div className="testo">
        <h3>{n.titolo}</h3>
        <p>{n.testo}</p>
      </div>

      <time className="quando" dateTime={n.created_at} title={orarioEsatto(n.created_at)}>
        {daQuanto(n.created_at)}
      </time>

      <span className="freccia" aria-hidden="true">›</span>
    </article>
  );
}

export default function Notifications() {
  const navigate = useNavigate();
  const [notifiche, setNotifiche] = useState([]);
  const [cerca, setCerca] = useState('');
  const [errore, setErrore] = useState('');
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    let vivo = true;
    api
      .get('/notifications')
      .then((r) => {
        if (!vivo) return;
        setNotifiche(r);
        return api.post('/notifications/read');
      })
      .catch((err) => vivo && setErrore(err.message))
      .finally(() => vivo && setCaricamento(false));
    return () => {
      vivo = false;
    };
  }, []);

  // la ricerca filtra su titolo e testo, poi restano i raggruppamenti per data
  const trovate = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (!q) return notifiche;
    return notifiche.filter((n) =>
      `${n.titolo} ${n.testo}`.toLowerCase().includes(q)
    );
  }, [notifiche, cerca]);

  const sezioni = useMemo(() => {
    const ora = Date.now();
    const gruppi = { oggi: [], settimana: [], precedenti: [] };
    for (const n of trovate) {
      const eta = ora - new Date(n.created_at).getTime();
      if (eta < UN_GIORNO) gruppi.oggi.push(n);
      else if (eta < 7 * UN_GIORNO) gruppi.settimana.push(n);
      else gruppi.precedenti.push(n);
    }
    return [
      { chiave: 'oggi', titolo: 'Oggi', righe: gruppi.oggi },
      { chiave: 'settimana', titolo: 'Ultimi 7 giorni', righe: gruppi.settimana },
      { chiave: 'precedenti', titolo: 'Precedenti', righe: gruppi.precedenti },
    ].filter((s) => s.righe.length > 0);
  }, [trovate]);

  const nonLette = notifiche.filter((n) => !n.letta).length;

  /** Porta alla schermata collegata all'evento della notifica. */
  function apri(n) {
    navigate(destinazione(n));
  }

  return (
    <div className="app">
      <Intestazione titolo="Notifiche" indietro={false} />

      <div className="ricerca-sezione">
        <BarraRicerca valore={cerca} onChange={setCerca} placeholder="Cerca fra le notifiche" />
      </div>

      <div className="contenuto">
        <Errore testo={errore} />
        {caricamento && <Caricamento />}

        {!caricamento && !cerca && nonLette > 0 && (
          <p className="riepilogo-notifiche">
            {nonLette === 1 ? '1 notifica non letta' : `${nonLette} notifiche non lette`}
          </p>
        )}

        {sezioni.map((s) => (
          <section key={s.chiave} className="sezione-notifiche">
            <h2 className="gruppo-notifiche">
              {s.titolo}
              <span>{s.righe.length}</span>
            </h2>
            {s.righe.map((n) => <Riga key={n.id} n={n} onApri={apri} />)}
          </section>
        ))}

        {!caricamento && trovate.length === 0 && (
          <p className="stato-vuoto">
            {cerca ? 'Nessuna notifica corrisponde alla ricerca.' : 'Nessuna notifica.'}
          </p>
        )}
      </div>

      <Navigazione />
    </div>
  );
}
