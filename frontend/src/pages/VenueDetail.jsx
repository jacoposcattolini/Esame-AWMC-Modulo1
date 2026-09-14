import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { BottoneIndietro, Caricamento, Errore } from '../components/Ui';
import Navigazione from '../components/Navigazione';
// data/ora "sui campi" e slot gia' passati: stesso conto usato dalle altre schermate
import { adessoAiCampi, slotPassato } from '../orario';

/** Genera gli slot orari a partire dagli orari di apertura del campo. */
function slotOrari(apertura, chiusura) {
  const ora = (s) => {
    const n = parseInt(String(s).split('.')[0], 10);
    return Number.isNaN(n) ? 0 : n;
  };
  const inizio = ora(apertura);
  let fine = ora(chiusura);
  if (fine <= inizio) fine = 24;

  const slot = [];
  for (let h = inizio; h < fine; h++) {
    slot.push(`${String(h).padStart(2, '0')}.00`);
  }
  return slot;
}

export default function VenueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campo, setCampo] = useState(null);
  // si aggiorna da solo ogni minuto: se la pagina resta aperta a cavallo
  // dell'ora, gli slot appena scaduti si disattivano senza ricaricare
  const [adesso, setAdesso] = useState(adessoAiCampi);
  const [data, setData] = useState(() => adessoAiCampi().data);
  const [ora, setOra] = useState('');
  const [partecipanti, setPartecipanti] = useState(1);
  const [errore, setErrore] = useState('');
  const [invio, setInvio] = useState(false);

  useEffect(() => {
    const battito = setInterval(() => {
      setAdesso((prec) => {
        const ora = adessoAiCampi();
        // si cambia stato solo quando scatta l'ora, non a ogni minuto
        return prec.data === ora.data && prec.ora === ora.ora ? prec : ora;
      });
    }, 60000);
    return () => clearInterval(battito);
  }, []);

  useEffect(() => {
    let vivo = true;
    api
      .get(`/venues/${id}?data=${data}`)
      .then((c) => {
        if (!vivo) return;
        setCampo(c);
        setOra((precedente) => (c.orariOccupati.includes(precedente) ? '' : precedente));
      })
      .catch((err) => vivo && setErrore(err.message));
    return () => {
      vivo = false;
    };
  }, [id, data]);

  const slot = useMemo(
    () => (campo ? slotOrari(campo.apertura, campo.chiusura) : []),
    [campo]
  );

  /** Ogni slot con il motivo per cui non e' selezionabile (se non lo e'). */
  const slotDisponibili = useMemo(
    () =>
      slot.map((s) => ({
        ora: s,
        occupato: campo ? campo.orariOccupati.includes(s) : false,
        passato: slotPassato(data, s, adesso),
      })),
    [slot, campo, data, adesso]
  );

  const nessunoLibero =
    slotDisponibili.length > 0 && slotDisponibili.every((s) => s.occupato || s.passato);

  // se l'orario scelto nel frattempo e' scaduto (o e' stato occupato), si azzera
  useEffect(() => {
    if (!ora) return;
    const scelto = slotDisponibili.find((s) => s.ora === ora);
    if (scelto && (scelto.passato || scelto.occupato)) setOra('');
  }, [slotDisponibili, ora]);

  // ogni sport ha il suo tetto (sports.max_partecipanti): il contatore non lo supera
  const massimo = (campo && campo.max_partecipanti) || 22;

  // se si arriva da un campo con tetto piu' alto, il numero si riallinea
  useEffect(() => {
    setPartecipanti((n) => Math.min(n, massimo));
  }, [massimo]);

  const totale = campo ? Number(campo.prezzo) * partecipanti : 0;

  async function prenota() {
    setErrore('');
    if (!ora) {
      setErrore('Seleziona un orario');
      return;
    }
    if (slotPassato(data, ora, adessoAiCampi())) {
      setErrore('Questo orario è già passato, scegline uno successivo');
      setOra('');
      return;
    }
    setInvio(true);
    try {
      const prenotazione = await api.post('/bookings', {
        venueId: campo.id,
        data,
        ora,
        partecipanti,
      });
      navigate(`/pagamento/${prenotazione.id}`);
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInvio(false);
    }
  }

  if (!campo) {
    return (
      <div className="app senza-tabbar">
        <Errore testo={errore} />
        <Caricamento />
      </div>
    );
  }

  return (
    <div className="app senza-tabbar">
      <div className="campo-hero">
        <img src={campo.immagine} alt={campo.nome} />
        <BottoneIndietro />
      </div>

      <div className="campo-corpo">
        <h1>{campo.nome}</h1>
        <p className="indirizzo">
          {campo.sport_nome}
          {campo.indirizzo ? ` · ${campo.indirizzo}` : ''}
        </p>

        <Errore testo={errore} />

        <div className="gruppo-campo">
          <label htmlFor="data">Data</label>
          <input
            id="data"
            type="date"
            min={adesso.data}
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </div>

        <div className="gruppo-campo">
          <label htmlFor="ora">Orario</label>
          <select id="ora" value={ora} onChange={(e) => setOra(e.target.value)}>
            <option value="">Seleziona un orario</option>
            {slotDisponibili.map((s) => (
              <option key={s.ora} value={s.ora} disabled={s.occupato || s.passato}>
                {s.ora}
                {s.passato ? ' - orario passato' : s.occupato ? ' - occupato' : ''}
              </option>
            ))}
          </select>
          {nessunoLibero && (
            <p className="aiuto">
              {data === adesso.data
                ? 'Per oggi non ci sono più orari disponibili: scegli un altro giorno.'
                : 'Tutti gli orari di questo giorno sono già occupati: scegli un altro giorno.'}
            </p>
          )}
        </div>

        <div className="gruppo-campo">
          <label>Numero partecipanti</label>
          <div className="contatore">
            <button
              type="button"
              aria-label="Togli un partecipante"
              disabled={partecipanti <= 1}
              onClick={() => setPartecipanti((n) => Math.max(1, n - 1))}
            >
              −
            </button>
            <span>{partecipanti}</span>
            <button
              type="button"
              aria-label="Aggiungi un partecipante"
              disabled={partecipanti >= massimo}
              onClick={() => setPartecipanti((n) => Math.min(massimo, n + 1))}
            >
              +
            </button>
          </div>
          <p className="aiuto aiuto-staccato">
            {partecipanti >= massimo
              ? `Hai raggiunto il massimo per il ${String(campo.sport_nome).toLowerCase()}: ${massimo} partecipanti.`
              : `Massimo ${massimo} partecipanti per il ${String(campo.sport_nome).toLowerCase()}.`}
          </p>
        </div>
      </div>

      <div className="barra-prenota">
        <div className="prezzo">
          {Number(campo.prezzo) === 0 ? 'Gratuito' : `${totale.toFixed(2)} €`}
          <small>{Number(campo.prezzo) === 0 ? 'campo pubblico' : `${Number(campo.prezzo).toFixed(0)} € a persona`}</small>
        </div>
        <button type="button" className="btn btn-pillola" onClick={prenota} disabled={invio}>
          {invio ? 'Attendi...' : 'Prenota'}
        </button>
      </div>
      <Navigazione />
    </div>
  );
}
