import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Caricamento, Errore, Modale } from './Ui';

/**
 * Invito di amici e gruppi a una propria prenotazione con posti liberi.
 * Non si puo' invitare piu' gente dei posti rimasti, e chi e' amico ed e'
 * anche in un gruppo scelto conta una volta sola: per questo dei gruppi si
 * leggono i membri veri. Il controllo definitivo lo fa comunque il server,
 * che sa anche chi si e' gia' aggiunto.
 */
export default function InvitaPartecipanti({ prenotazione, onChiudi, onInvitati }) {
  const { utente } = useAuth();
  const [amici, setAmici] = useState([]);
  const [gruppi, setGruppi] = useState([]);
  const [sceltiAmici, setSceltiAmici] = useState([]);
  const [sceltiGruppi, setSceltiGruppi] = useState([]);
  // membri dei gruppi, letti solo quando servono: { [idGruppo]: [id, id, ...] }
  const [membriGruppo, setMembriGruppo] = useState({});
  const [errore, setErrore] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [invio, setInvio] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([api.get('/friends'), api.get('/groups')])
      .then(([a, g]) => {
        if (!vivo) return;
        setAmici(a);
        setGruppi(g);
      })
      .catch((err) => vivo && setErrore(err.message))
      .finally(() => vivo && setCaricamento(false));
    return () => {
      vivo = false;
    };
  }, []);

  const liberi = Math.max(0, prenotazione.posti - prenotazione.iscritti);

  /* Quante persone si stanno invitando davvero: amici scelti + membri dei
     gruppi scelti, senza doppioni e senza se stessi. Finche' i membri di un
     gruppo non sono arrivati si usa il suo numero di membri come stima. */
  const invitati = useMemo(() => {
    const persone = new Set(sceltiAmici);
    for (const id of sceltiGruppi) {
      const membri = membriGruppo[id];
      if (membri) membri.forEach((m) => persone.add(m));
    }
    persone.delete(utente && utente.id);

    const stimati = sceltiGruppi
      .filter((id) => !membriGruppo[id])
      .reduce((somma, id) => {
        const g = gruppi.find((x) => x.id === id);
        return somma + (g ? Math.max(0, g.membri - 1) : 0);
      }, 0);

    return persone.size + stimati;
  }, [gruppi, membriGruppo, sceltiAmici, sceltiGruppi, utente]);

  // avviso, non blocco: chi fa gia' parte della prenotazione non viene
  // invitato di nuovo, e a saperlo e' solo il server
  const troppi = invitati > liberi;

  function alterna(elenco, imposta, id) {
    imposta(elenco.includes(id) ? elenco.filter((x) => x !== id) : [...elenco, id]);
  }

  /** Seleziona un gruppo leggendone i membri, per contare le persone vere. */
  async function alternaGruppo(id) {
    alterna(sceltiGruppi, setSceltiGruppi, id);
    if (membriGruppo[id]) return;
    try {
      const membri = await api.get(`/groups/${id}/members`);
      setMembriGruppo((m) => ({ ...m, [id]: membri.map((x) => x.id) }));
    } catch {
      /* senza i membri resta la stima sul numero del gruppo */
    }
  }

  async function invia(e) {
    e.preventDefault();
    setErrore('');
    setInvio(true);
    try {
      const esito = await api.post(`/bookings/${prenotazione.id}/invite`, {
        amici: sceltiAmici,
        gruppi: sceltiGruppi,
      });
      onInvitati(esito.invitati);
    } catch (err) {
      setErrore(err.message);
      setInvio(false);
    }
  }

  return (
    <Modale titolo="Invita a partecipare" onChiudi={onChiudi}>
      <form className="modulo-gruppo" onSubmit={invia}>
        <Errore testo={errore} />

        <p className="aiuto">
          {prenotazione.sport} a {prenotazione.campo},{' '}
          {new Date(prenotazione.data).toLocaleDateString('it-IT')} alle {prenotazione.ora}.
          {' '}
          {liberi === 0
            ? 'Non restano posti liberi.'
            : `${liberi === 1 ? 'Resta 1 posto libero' : `Restano ${liberi} posti liberi`} su ${prenotazione.posti}.`}
        </p>

        {caricamento && <Caricamento />}

        {!caricamento && (
          <>
            <span className="etichetta">Amici</span>
            {amici.length === 0 ? (
              <p className="aiuto">Non hai ancora amici da invitare.</p>
            ) : (
              <ul className="elenco-membri scelta-membri">
                {amici.map((a) => (
                  <li key={a.id}>
                    <label>
                      <img src={a.avatar} alt="" loading="lazy" />
                      <span>
                        <strong>{a.nome}</strong>
                        <em>{a.sport || 'Nessuno sport indicato'}</em>
                      </span>
                      <input
                        type="checkbox"
                        checked={sceltiAmici.includes(a.id)}
                        onChange={() => alterna(sceltiAmici, setSceltiAmici, a.id)}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <span className="etichetta">Gruppi</span>
            {gruppi.length === 0 ? (
              <p className="aiuto">Non fai ancora parte di nessun gruppo.</p>
            ) : (
              <ul className="elenco-membri scelta-membri">
                {gruppi.map((g) => (
                  <li key={g.id}>
                    <label>
                      <img src={g.immagine} alt="" loading="lazy" />
                      <span>
                        <strong>{g.nome}</strong>
                        <em>
                          {g.membri} membri · {Math.max(0, g.membri - 1)} da invitare
                        </em>
                      </span>
                      <input
                        type="checkbox"
                        checked={sceltiGruppi.includes(g.id)}
                        onChange={() => alternaGruppo(g.id)}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <p className={`aiuto${troppi ? ' avviso' : ''}`}>
              {invitati === 0
                ? 'Scegli chi invitare.'
                : troppi
                  ? `Stai invitando ${invitati} persone ma ${liberi === 1 ? 'resta 1 posto libero' : `restano ${liberi} posti liberi`}: chi fa già parte della prenotazione non verrà invitato di nuovo, per gli altri togli qualche nome.`
                  : `${invitati === 1 ? '1 persona' : `${invitati} persone`} da invitare sui ${liberi} posti liberi.`}
            </p>
          </>
        )}

        <div className="modale-azioni">
          <button type="button" className="btn btn-bordo" onClick={onChiudi} disabled={invio}>
            Annulla
          </button>
          <button
            type="submit"
            className="btn btn-verde"
            disabled={invio || caricamento || invitati === 0 || liberi === 0}
          >
            {invio ? 'Invio...' : 'Invita'}
          </button>
        </div>
      </form>
    </Modale>
  );
}
