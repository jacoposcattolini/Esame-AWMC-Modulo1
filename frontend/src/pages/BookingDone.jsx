import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import Navigazione from '../components/Navigazione';
import InvitaPartecipanti from '../components/InvitaPartecipanti';

export default function BookingDone() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prenotazione, setPrenotazione] = useState(null);
  // finestra degli inviti: e' il momento naturale per chiamare gli altri
  const [inviti, setInviti] = useState(false);
  const [invitiFatti, setInvitiFatti] = useState('');

  useEffect(() => {
    let vivo = true;
    api
      .get('/bookings')
      .then((elenco) => {
        if (vivo) setPrenotazione(elenco.find((b) => String(b.id) === String(id)) || null);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [id]);

  return (
    <div className="app senza-tabbar esito">
      <h1>Prenotazione Effettuata</h1>

      <div className="segno">
        <svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true">
          <path d="m4 12.5 5.2 5.2L20 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {prenotazione && (
        <p className="dettagli">
          {prenotazione.campo}
          <br />
          {new Date(prenotazione.data).toLocaleDateString('it-IT')} alle {prenotazione.ora}
          <br />
          {prenotazione.partecipanti} {prenotazione.partecipanti === 1 ? 'partecipante' : 'partecipanti'} · {Number(prenotazione.totale).toFixed(2)} €
        </p>
      )}

      {/* con posti ancora liberi si possono chiamare amici e gruppi */}
      {prenotazione && prenotazione.stato !== 'annullata' && prenotazione.iscritti < prenotazione.posti && (
        <button type="button" className="btn btn-bordo invita" onClick={() => setInviti(true)}>
          Invita amici o gruppi ·{' '}
          {prenotazione.posti - prenotazione.iscritti === 1
            ? '1 posto libero'
            : `${prenotazione.posti - prenotazione.iscritti} posti liberi`}
        </button>
      )}

      {invitiFatti && <p className="dettagli">{invitiFatti}</p>}

      <button type="button" className="btn btn-pillola" onClick={() => navigate('/prenotazioni', { replace: true })}>
        Le mie prenotazioni
      </button>
      <button type="button" className="btn-testo" onClick={() => navigate('/', { replace: true })}>
        Fine
      </button>
      {inviti && (
        <InvitaPartecipanti
          prenotazione={prenotazione}
          onChiudi={() => setInviti(false)}
          onInvitati={(quanti) => {
            setInviti(false);
            setInvitiFatti(
              quanti === 1 ? 'Invito inviato a 1 persona.' : `Invito inviato a ${quanti} persone.`
            );
          }}
        />
      )}

      <Navigazione />
    </div>
  );
}
