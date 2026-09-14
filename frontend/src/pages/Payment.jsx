import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Caricamento, Errore, Intestazione } from '../components/Ui';
import Navigazione from '../components/Navigazione';
import SceltaPagamento from '../components/SceltaPagamento';

/** Pagina di pagamento (simulato): conferma la prenotazione creata. */
export default function Payment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { utente, variaSaldo } = useAuth();

  const [prenotazione, setPrenotazione] = useState(null);
  const [errore, setErrore] = useState('');
  const [invio, setInvio] = useState(false);
  const [metodo, setMetodo] = useState(null);
  const [usaSaldo, setUsaSaldo] = useState(false);
  // quante carte ha salvato l'utente (null finche' non si sa)
  const [carte, setCarte] = useState(null);

  const saldo = (utente && utente.saldo) || 0;

  useEffect(() => {
    let vivo = true;
    api
      .get('/bookings')
      .then((elenco) => {
        if (!vivo) return;
        const trovata = elenco.find((b) => String(b.id) === String(id));
        if (!trovata) setErrore('Prenotazione non trovata');
        setPrenotazione(trovata || null);
      })
      .catch((err) => vivo && setErrore(err.message));
    return () => {
      vivo = false;
    };
  }, [id]);

  // di default il saldo si usa: e' credito che l'utente ha gia'
  useEffect(() => {
    if (saldo > 0) setUsaSaldo(true);
  }, [saldo]);

  const totale = prenotazione ? Number(prenotazione.totale) : 0;
  const dalSaldo = usaSaldo ? Math.min(saldo, totale) : 0;
  const daPagare = Math.max(0, totale - dalSaldo);
  // senza carte salvate si puo' pagare solo se il saldo copre tutto
  const senzaFondi = daPagare > 0 && carte === 0;

  async function paga() {
    setInvio(true);
    setErrore('');
    try {
      const b = await api.post(`/bookings/${id}/pay`, { usaSaldo });
      if (b.conto) variaSaldo(-b.conto.dalSaldo);
      navigate(`/prenotazione-effettuata/${id}`, { replace: true });
    } catch (err) {
      setErrore(err.message);
      setInvio(false);
    }
  }

  return (
    <div className="app senza-tabbar">
      <Intestazione titolo="Pagamento" />

      <div className="pagamento">
        <Errore testo={errore} />
        {!prenotazione && !errore && <Caricamento />}

        {prenotazione && (
          <>
            <div className="riepilogo">
              <div><span>Sport</span><strong>{prenotazione.sport}</strong></div>
              <div><span>Campo</span><strong>{prenotazione.campo}</strong></div>
              <div><span>Data</span><strong>{new Date(prenotazione.data).toLocaleDateString('it-IT')}</strong></div>
              <div><span>Orario</span><strong>{prenotazione.ora}</strong></div>
              <div><span>Partecipanti</span><strong>{prenotazione.partecipanti}</strong></div>
              <div className="totale"><span>Totale</span><span>{totale.toFixed(2)} €</span></div>
            </div>

            <SceltaPagamento
              importo={totale}
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
              onClick={paga}
              disabled={invio || senzaFondi}
            >
              {invio
                ? 'Pagamento in corso...'
                : senzaFondi
                  ? 'Nessun metodo di pagamento'
                  : daPagare === 0
                    ? 'Conferma (coperto dal saldo)'
                    : `Paga ${daPagare.toFixed(2)} €`}
            </button>

            <p className="stato-vuoto">
              Pagamento simulato a scopo didattico: nessun importo viene realmente addebitato.
              Se annulli la prenotazione, quanto versato torna sul tuo saldo SportEasy.
            </p>
          </>
        )}
      </div>
      <Navigazione />
    </div>
  );
}
