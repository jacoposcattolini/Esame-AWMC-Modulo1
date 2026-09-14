import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import Navigazione from '../components/Navigazione';
import { BarraRicerca, BottoneIndietro, Caricamento, Errore, Stelle } from '../components/Ui';

const DIM_TILE = 256;
const ZOOM_MAX = 16;
const ZOOM_MIN = 11;
const MARGINE = 96; // pixel liberi ai bordi, cosi' i pin non finiscono tagliati

/** Proiezione Web Mercator: da lat/lng ai pixel assoluti di un livello di zoom. */
function aPixel(lat, lng, zoom) {
  const n = DIM_TILE * 2 ** zoom;
  const sen = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * n,
    y: (0.5 - Math.log((1 + sen) / (1 - sen)) / (4 * Math.PI)) * n,
  };
}

/**
 * Mappa dei campi: tasselli OpenStreetMap con un pin per ogni campo dello
 * sport scelto (prima ne compariva uno solo). Toccando un pin si apre la
 * schermata di prenotazione di quel campo.
 */
function Mappa({ campi }) {
  const navigate = useNavigate();
  const cornice = useRef(null);
  const [dim, setDim] = useState({ larghezza: 0, altezza: 0 });

  // la mappa si ridisegna quando cambia la dimensione (telefono / desktop)
  useEffect(() => {
    const el = cornice.current;
    if (!el) return undefined;
    const misura = () => setDim({ larghezza: el.clientWidth, altezza: el.clientHeight });
    misura();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const osservatore = new ResizeObserver(misura);
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, []);

  const vista = useMemo(() => {
    const punti = campi.filter((c) => c.lat && c.lng);
    if (punti.length === 0 || dim.larghezza === 0 || dim.altezza === 0) return null;

    // si sceglie lo zoom piu' ravvicinato che tiene tutti i campi nella cornice
    let zoom = ZOOM_MIN;
    for (let z = ZOOM_MAX; z >= ZOOM_MIN; z--) {
      const p = punti.map((c) => aPixel(c.lat, c.lng, z));
      const larghezza = Math.max(...p.map((q) => q.x)) - Math.min(...p.map((q) => q.x));
      const altezza = Math.max(...p.map((q) => q.y)) - Math.min(...p.map((q) => q.y));
      if (larghezza <= dim.larghezza - MARGINE && altezza <= dim.altezza - MARGINE) {
        zoom = z;
        break;
      }
    }

    const proiettati = punti.map((c) => ({ campo: c, ...aPixel(c.lat, c.lng, zoom) }));
    const centro = {
      x: (Math.min(...proiettati.map((p) => p.x)) + Math.max(...proiettati.map((p) => p.x))) / 2,
      y: (Math.min(...proiettati.map((p) => p.y)) + Math.max(...proiettati.map((p) => p.y))) / 2,
    };
    const origine = { x: centro.x - dim.larghezza / 2, y: centro.y - dim.altezza / 2 };

    // i tasselli necessari a coprire la cornice
    const ultimo = 2 ** zoom - 1;
    const tasselli = [];
    const daX = Math.floor(origine.x / DIM_TILE);
    const aX = Math.floor((origine.x + dim.larghezza) / DIM_TILE);
    const daY = Math.floor(origine.y / DIM_TILE);
    const aY = Math.floor((origine.y + dim.altezza) / DIM_TILE);
    for (let tx = daX; tx <= aX; tx++) {
      for (let ty = daY; ty <= aY; ty++) {
        if (ty < 0 || ty > ultimo) continue;
        const x = ((tx % (ultimo + 1)) + ultimo + 1) % (ultimo + 1);
        tasselli.push({
          chiave: `${tx}-${ty}`,
          url: `https://tile.openstreetmap.org/${zoom}/${x}/${ty}.png`,
          sinistra: tx * DIM_TILE - origine.x,
          alto: ty * DIM_TILE - origine.y,
        });
      }
    }

    const pin = proiettati.map((p) => ({
      campo: p.campo,
      sinistra: p.x - origine.x,
      alto: p.y - origine.y,
    }));

    return { tasselli, pin };
  }, [campi, dim]);

  return (
    <div className="mappa" ref={cornice}>
      {vista && (
        <>
          <div className="mappa-tasselli" aria-hidden="true">
            {vista.tasselli.map((t) => (
              <img
                key={t.chiave}
                src={t.url}
                alt=""
                style={{ left: `${t.sinistra}px`, top: `${t.alto}px` }}
              />
            ))}
          </div>

          {vista.pin.map(({ campo, sinistra, alto }) => (
            <button
              key={campo.id}
              type="button"
              className="mappa-pin"
              style={{ left: `${sinistra}px`, top: `${alto}px` }}
              title={`Prenota ${campo.nome}`}
              onClick={() => navigate(`/campo/${campo.id}`)}
            >
              <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
                <path
                  d="M12 22.5c0-.5-8-8.3-8-13.1a8 8 0 1 1 16 0c0 4.8-8 12.6-8 13.1Z"
                  fill="var(--verde)"
                  stroke="#ffffff"
                  strokeWidth="1.6"
                />
                <circle cx="12" cy="9.2" r="3" fill="#ffffff" />
              </svg>
              <span className="mappa-pin-etichetta">
                {campo.nome}
                <small>{Number(campo.prezzo) === 0 ? 'Gratuito' : `${Number(campo.prezzo).toFixed(0)} €`}</small>
              </span>
            </button>
          ))}

          <span className="mappa-crediti">© OpenStreetMap</span>
        </>
      )}
    </div>
  );
}

export default function SportVenues() {
  const { slug } = useParams();
  const [dati, setDati] = useState({ sport: null, campi: [] });
  const [cerca, setCerca] = useState('');
  const [errore, setErrore] = useState('');
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCaricamento(true);
    api
      .get(`/sports/${slug}/venues`)
      .then((r) => vivo && setDati(r))
      .catch((err) => vivo && setErrore(err.message))
      .finally(() => vivo && setCaricamento(false));
    return () => {
      vivo = false;
    };
  }, [slug]);

  const campi = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (!q) return dati.campi;
    return dati.campi.filter((c) => c.nome.toLowerCase().includes(q));
  }, [dati.campi, cerca]);

  return (
    <div className="app">
      <div className="home-top">
        <BottoneIndietro a="/" />
        <BarraRicerca valore={cerca} onChange={setCerca} placeholder="Cerca campo" />
      </div>

      <Mappa campi={dati.campi} />

      <div className="foglio">
        {/* l'indicazione riguarda la mappa qui sopra: sta fra la mappa e il titolo */}
        <p className="aiuto centrato">Tocca un pin sulla mappa o scegli un campo dall’elenco.</p>
        <h2>Seleziona il campo</h2>

        <Errore testo={errore} />
        {caricamento && <Caricamento />}

        <div className="griglia griglia-campi">
          {campi.map((c) => (
            <Link key={c.id} className="card-campo" to={`/campo/${c.id}`}>
              <img src={c.immagine} alt={c.nome} loading="lazy" />
              <div className="card-campo-testo">
                <h3>{c.nome}</h3>
                <p className="card-campo-meta">
                  <span className="pillola-info">
                    {Number(c.prezzo) === 0 ? 'Gratuito' : Number(c.prezzo).toFixed(0) + ' € a persona'}
                  </span>
                  <span className="pillola-info chiara">{c.apertura} - {c.chiusura}</span>
                </p>
                <Stelle voto={c.rating} />
              </div>
            </Link>
          ))}
        </div>

        {!caricamento && campi.length === 0 && <p className="stato-vuoto">Nessun campo disponibile.</p>}
      </div>

      <Navigazione />
    </div>
  );
}
