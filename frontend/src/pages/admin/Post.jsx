import { useState } from 'react';
import { apiAdmin } from '../../api';
import { Caricamento, Conferma, Errore } from '../../components/Ui';
import { Avviso, LayoutAdmin, useAzioneAdmin, useDatiAdmin, data, dataOra } from './comuni';

/** Post pubblicati nel feed: si leggono per intero e si eliminano. */
export default function Post() {
  const { dati, errore, caricamento, ricarica } = useDatiAdmin('/post');
  const { avviso, inCorso, esegui } = useAzioneAdmin({ ricarica });
  const [daEliminare, setDaEliminare] = useState(null);

  const post = dati ? dati.post : [];

  async function elimina() {
    const p = daEliminare;
    setDaEliminare(null);
    await esegui(() => apiAdmin.del(`/post/${p.id}`), 'Post eliminato.');
  }

  return (
    <LayoutAdmin
      titolo="Post pubblicati"
      sottotitolo={`${post.length} post nel feed. Da qui puoi leggerli per intero ed eliminare quelli non adatti.`}
    >
      {caricamento && !dati ? <Caricamento /> : null}
      <Errore testo={errore} />
      <Avviso avviso={avviso} />

      {dati && post.length === 0 ? <p className="vuoto">Nessun post pubblicato.</p> : null}

      {post.length > 0 ? (
        <div className="tabella-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th />
                <th>Autore</th>
                <th>Contenuto</th>
                <th>Prenotazione allegata</th>
                <th>Pubblicato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {post.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>
                    <img className="avatar" src={p.avatar} alt="" />
                  </td>
                  <td>{p.autore}</td>
                  <td className="testo-lungo">{p.contenuto}</td>
                  <td>
                    {p.booking_id ? (
                      <>
                        {p.booking_sport} · {p.booking_campo}
                        <br />
                        {data(p.booking_data)} alle {p.booking_ora}
                      </>
                    ) : p.prenotazione_rimossa ? (
                      <span className="pillola">prenotazione eliminata</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{dataOra(p.created_at)}</td>
                  <td className="azioni">
                    <button
                      type="button"
                      className="btn-piccolo pericolo"
                      disabled={inCorso}
                      onClick={() => setDaEliminare(p)}
                    >
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {daEliminare ? (
        <Conferma
          titolo={`Eliminare il post #${daEliminare.id}?`}
          messaggio={`Il post di ${daEliminare.nome || daEliminare.autore} sparisce dal feed di tutti. L’operazione non si può annullare.`}
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
