import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

/**
 * Blocco "Metodo di pagamento", usato sia per pagare una prenotazione sia per
 * la quota di partecipazione. Prima il saldo SportEasy (e' credito che
 * l'utente ha gia'), poi le carte salvate, poi il collegamento per gestirle.
 * Le carte sono l'unico metodo: se non ce ne sono e resta qualcosa da pagare,
 * l'utente viene mandato ad aggiungerne una (onCarte dice alla schermata
 * quante ne ha).
 */

const dueCifre = (n) => String(n).padStart(2, '0');

export default function SceltaPagamento({
  importo,
  saldo = 0,
  usaSaldo,
  onUsaSaldo,
  metodo,
  onMetodo,
  onCarte,
}) {
  const [carte, setCarte] = useState([]);

  useEffect(() => {
    let vivo = true;
    api
      .get('/payment-methods')
      .then((r) => {
        if (!vivo) return;
        setCarte(r);
        if (onCarte) onCarte(r.length);
        // si parte dalla carta predefinita, se ce n'e' una
        const predefinita = r.find((c) => c.predefinito) || r[0];
        onMetodo(predefinita ? `carta-${predefinita.id}` : null);
      })
      .catch(() => {
        if (!vivo) return;
        if (onCarte) onCarte(0);
        onMetodo(null);
      });
    return () => {
      vivo = false;
    };
    // onMetodo e' stabile: si carica una sola volta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dalSaldo = usaSaldo ? Math.min(saldo, importo) : 0;
  const residuo = Math.max(0, importo - dalSaldo);

  return (
    <>
      {saldo > 0 && (
        <>
          <span className="etichetta">Saldo SportEasy</span>
          <button
            type="button"
            className={`metodo saldo${usaSaldo ? ' scelto' : ''}`}
            aria-pressed={usaSaldo}
            onClick={() => onUsaSaldo(!usaSaldo)}
          >
            <span className="segno-scelta" aria-hidden="true" />
            <span className="metodo-testo">
              <strong>Usa il saldo · {saldo.toFixed(2)} € disponibili</strong>
              <small>
                {usaSaldo
                  ? `Scalati ${dalSaldo.toFixed(2)} €${residuo > 0 ? `, restano ${residuo.toFixed(2)} € da pagare` : ', importo interamente coperto'}`
                  : 'Credito accumulato dalle prenotazioni annullate'}
              </small>
            </span>
          </button>
        </>
      )}

      {residuo > 0 && (
        <>
          <span className="etichetta">Metodo di pagamento</span>

          {carte.map((c) => {
            const chiave = `carta-${c.id}`;
            return (
              <button
                key={chiave}
                type="button"
                className={`metodo${metodo === chiave ? ' scelto' : ''}`}
                aria-pressed={metodo === chiave}
                onClick={() => onMetodo(chiave)}
              >
                <span className="segno-scelta" aria-hidden="true" />
                <span className="metodo-testo">
                  <strong>{c.circuito} ···· {c.ultime4}</strong>
                  <small>
                    {c.intestatario} · scade il {dueCifre(c.scadenza_mese)}/{c.scadenza_anno}
                    {c.predefinito ? ' · predefinita' : ''}
                  </small>
                </span>
              </button>
            );
          })}

          {carte.length === 0 && (
            <p className="aiuto avviso">
              {saldo > 0
                ? `Il saldo SportEasy non basta: restano ${residuo.toFixed(2)} € da coprire e non hai nessuna carta salvata. Aggiungine una per completare il pagamento.`
                : 'Nessun metodo di pagamento disponibile: aggiungi una carta per completare il pagamento.'}
            </p>
          )}

          <Link className="metodo chiaro" to="/profilo/pagamenti">
            <span className="metodo-testo">
              <strong>{carte.length === 0 ? 'Aggiungi una carta' : 'Gestisci le tue carte'}</strong>
              <small>Schermata «Metodi di pagamento» del profilo</small>
            </span>
            <span className="freccia" aria-hidden="true">›</span>
          </Link>
        </>
      )}
    </>
  );
}
