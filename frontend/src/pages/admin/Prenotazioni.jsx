import { useState } from 'react';
import { apiAdmin } from '../../api';
import { Caricamento, Conferma, Errore } from '../../components/Ui';
import { Avviso, LayoutAdmin, useAzioneAdmin, useDatiAdmin, data, euro } from './comuni';

const STATI = [
  { valore: 'in_attesa', testo: 'in attesa' },
  { valore: 'confermata', testo: 'confermata' },
  { valore: 'annullata', testo: 'annullata' },
];

/**
 * Tutte le prenotazioni dell'app.
 * Annullando o eliminando una prenotazione il server rimborsa chi aveva
 * pagato: qui non si tocca nessun saldo a mano.
 */
export default function Prenotazioni() {
  const { dati, errore, caricamento, ricarica } = useDatiAdmin('/prenotazioni');
  const { avviso, inCorso, esegui } = useAzioneAdmin({ ricarica });
  // stato scelto nella tendina, prima di premere "Salva"
  const [scelte, setScelte] = useState({});
  const [daEliminare, setDaEliminare] = useState(null);

  const prenotazioni = dati ? dati.prenotazioni : [];

  function statoScelto(b) {
    return scelte[b.id] ?? b.stato;
  }

  async function salvaStato(b) {
    const stato = statoScelto(b);
    if (stato === b.stato) return;
    await esegui(
      () => apiAdmin.put(`/prenotazioni/${b.id}/stato`, { stato }),
      'Stato aggiornato.'
    );
    setScelte((s) => ({ ...s, [b.id]: undefined }));
  }

  async function elimina() {
    const b = daEliminare;
    setDaEliminare(null);
    await esegui(() => apiAdmin.del(`/prenotazioni/${b.id}`), 'Prenotazione eliminata.');
  }

  return (
    <LayoutAdmin
      titolo="Tutte le prenotazioni"
      sottotitolo={`${prenotazioni.length} prenotazioni registrate. Da qui puoi cambiarne lo stato o cancellarle.`}
    >
      {caricamento && !dati ? <Caricamento /> : null}
      <Errore testo={errore} />
      <Avviso avviso={avviso} />

      {dati && prenotazioni.length === 0 ? (
        <p className="vuoto">Nessuna prenotazione registrata.</p>
      ) : null}

      {prenotazioni.length > 0 ? (
        <div className="tabella-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Sport</th>
                <th>Campo</th>
                <th>Data</th>
                <th>Ora</th>
                <th>Organizzatore</th>
                <th>Iscritti</th>
                <th>Totale</th>
                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {prenotazioni.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{b.sport}</td>
                  <td>{b.campo}</td>
                  <td>{data(b.data)}</td>
                  <td>{b.ora}</td>
                  <td>{b.organizzatore}</td>
                  <td>
                    {b.iscritti} / {b.posti}
                  </td>
                  <td>{euro(b.totale)}</td>
                  <td>
                    <span className={`stato ${b.stato}`}>{b.stato.replace('_', ' ')}</span>
                  </td>
                  <td className="azioni">
                    <span className="gruppo-azione">
                      <select
                        value={statoScelto(b)}
                        aria-label={`Stato della prenotazione ${b.id}`}
                        onChange={(e) => setScelte((s) => ({ ...s, [b.id]: e.target.value }))}
                      >
                        {STATI.map((s) => (
                          <option key={s.valore} value={s.valore}>
                            {s.testo}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-piccolo"
                        disabled={inCorso || statoScelto(b) === b.stato}
                        onClick={() => salvaStato(b)}
                      >
                        Salva
                      </button>
                    </span>
                    <span className="gruppo-azione">
                      <button
                        type="button"
                        className="btn-piccolo pericolo"
                        disabled={inCorso}
                        onClick={() => setDaEliminare(b)}
                      >
                        Elimina
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {daEliminare ? (
        <Conferma
          titolo={`Eliminare la prenotazione #${daEliminare.id}?`}
          messaggio={
            'La prenotazione viene cancellata definitivamente. Se non era gia’ annullata, ' +
            'quanto pagato torna sul saldo SportEasy di chi lo aveva versato.'
          }
          etichetta="Elimina"
          pericolo
          inCorso={inCorso}
          onConferma={elimina}
          onAnnulla={() => setDaEliminare(null)}
        />
      ) : null}
    </LayoutAdmin>
  );
}
