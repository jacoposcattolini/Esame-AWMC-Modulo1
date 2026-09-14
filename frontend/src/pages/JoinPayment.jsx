import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navigazione from '../components/Navigazione';
import { Caricamento, Errore, Intestazione } from '../components/Ui';
import SceltaPagamento from '../components/SceltaPagamento';

/**
 * PAGAMENTO DELLA PARTECIPAZIONE.
 *
 * Aggiungersi a una prenotazione trovata in un post non e' piu' immediato:
 * prima si paga la propria quota (il prezzo a persona del campo), con lo
 * stesso stile della schermata di pagamento di una prenotazione. Se il campo
 * e' gratuito il feed salta direttamente questa schermata.
 * L'iscrizione avviene solo alla conferma: finche' si resta qui, nessuno
 * risulta iscritto.
 */
export default function JoinPayment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { variaSaldo } = useAuth();

  const [riepilogo, setRiepilogo] = useState(null);
  const [metodo, setMetodo] = useState(null);
  const [usaSaldo, setUsaSaldo] = useState(false);
  // quante carte ha salvato l'utente (null finche' non si sa)
  const [carte, setCarte] = useState(null);
  const [errore, setErrore] = useState('');
  const [invio, setInvio] = useState(false);

  useEffect(() => {
    let vivo = true;
    api
      .get(`/bookings/${id}/join`)
      .then((r) => {
        if (!vivo) return;
        setRiepilogo(r);
        setUsaSaldo(r.saldo > 0);
      })
      .catch((err) => vivo && setErrore(err.message));
    return () => {
      vivo = false;
    };
  }, [id]);

  async function conferma() {
    setInvio(true);
    setErrore('');
    try {
      const b = await api.post(`/bookings/${id}/join`, { usaSaldo });
      // il saldo cambia: il contatore si aggiorna subito, senza ricaricare
      if (b.conto) variaSaldo(-b.conto.dalSaldo);
      navigate('/prenotazioni', { replace: true });
    } catch (err) {
      setErrore(err.message);
      setInvio(false);
    }
  }

  const p = riepilogo && riepilogo.prenotazione;
  const quota = riepilogo ? riepilogo.quota : 0;
  const saldo = riepilogo ? riepilogo.saldo : 0;
  const dalSaldo = usaSaldo ? Math.min(saldo, quota) : 0;
  const daPagare = Math.max(0, quota - dalSaldo);
  // senza carte salvate si puo' partecipare solo se il saldo copre la quota
  const senzaFondi = daPagare > 0 && carte === 0;

  return (
    <div className="app senza-tabbar">
      <Intestazione titolo="Partecipa" />

      <div className="pagamento">
        <Errore testo={errore} />
        {!riepilogo && !errore && <Caricamento />}

        {p && (
          <>
            <div className="riepilogo">
              <div><span>Sport</span><strong>{p.sport}</strong></div>
              <div><span>Campo</span><strong>{p.campo}</strong></div>
              <div><span>Data</span><strong>{new Date(p.data).toLocaleDateString('it-IT')}</strong></div>
              <div><span>Orario</span><strong>{p.ora}</strong></div>
              <div><span>Organizzata da</span><strong>{p.organizzatore}</strong></div>
              <div><span>Posti</span><strong>{p.iscritti} di {p.posti} occupati</strong></div>
              <div className="totale"><span>La tua quota</span><span>{quota.toFixed(2)} €</span></div>
            </div>

            <SceltaPagamento
              importo={quota}
              saldo={saldo}
              usaSaldo={usaSaldo}
              onUsaSaldo={setUsaSaldo}
              metodo={metodo}
              onMetodo={setMetodo}
              onCarte={setCarte}
            />

            <button
              type="button"
              className="btn btn-verde paga"
              onClick={conferma}
              disabled={invio || senzaFondi}
            >
              {invio
                ? 'Conferma in corso...'
                : senzaFondi
                  ? 'Nessun metodo di pagamento'
                  : daPagare === 0
                    ? 'Partecipa (coperto dal saldo)'
                    : `Paga ${daPagare.toFixed(2)} € e partecipa`}
            </button>

            <p className="stato-vuoto">
              Pagamento simulato a scopo didattico: nessun importo viene realmente addebitato.
              La quota va sul saldo SportEasy di {p.organizzatore}, che ha prenotato il campo;
              se la prenotazione viene annullata torna sul tuo.
            </p>
          </>
        )}
      </div>
      <Navigazione />
    </div>
  );
}
