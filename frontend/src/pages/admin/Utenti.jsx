import { useState } from 'react';
import { apiAdmin } from '../../api';
import { Caricamento, Conferma, Errore } from '../../components/Ui';
import { Avviso, LayoutAdmin, useAzioneAdmin, useDatiAdmin, data } from './comuni';

/**
 * Account registrati.
 * L'account DEMO non e' eliminabile (si azzera da solo a ogni uscita): il
 * server rifiuta comunque la richiesta, qui il pulsante non compare proprio.
 */
export default function Utenti() {
  const { dati, errore, caricamento, ricarica } = useDatiAdmin('/utenti');
  const { avviso, inCorso, esegui } = useAzioneAdmin({ ricarica });
  const [daEliminare, setDaEliminare] = useState(null);

  const utenti = dati ? dati.utenti : [];

  async function elimina() {
    const u = daEliminare;
    setDaEliminare(null);
    await esegui(
      () => apiAdmin.del(`/utenti/${u.id}`),
      'Account eliminato: prenotazioni, post, chat e amicizie sono stati rimossi con lui.'
    );
  }

  return (
    <LayoutAdmin
      titolo="Utenti registrati"
      sottotitolo={`${utenti.length} account. Le password sono salvate solo come hash bcrypt e non sono visualizzabili.`}
    >
      {caricamento && !dati ? <Caricamento /> : null}
      <Errore testo={errore} />
      <Avviso avviso={avviso} />

      {utenti.length > 0 ? (
        <div className="tabella-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th />
                <th>Nome</th>
                <th>Email</th>
                <th>Comune</th>
                <th>Sport</th>
                <th>Iscritto il</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {utenti.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>
                    <img className="avatar" src={u.avatar} alt="" />
                  </td>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{u.comune || '-'}</td>
                  <td>{u.sport || '-'}</td>
                  <td>{data(u.created_at)}</td>
                  <td className="azioni">
                    {u.demo ? (
                      <span className="pillola">account DEMO</span>
                    ) : (
                      <button
                        type="button"
                        className="btn-piccolo pericolo"
                        disabled={inCorso}
                        onClick={() => setDaEliminare(u)}
                      >
                        Elimina
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {daEliminare ? (
        <Conferma
          titolo={`Eliminare l’account di ${daEliminare.nome}?`}
          messaggio="Verranno cancellati anche le sue prenotazioni, i post, le chat e le amicizie. L’operazione non si può annullare."
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
