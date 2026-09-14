import { Caricamento, Errore } from '../../components/Ui';
import { LayoutAdmin, useDatiAdmin, data, euro } from './comuni';

/** Pannello di controllo: numeri d'insieme e ultime prenotazioni. */
export default function Dashboard() {
  const { dati, errore, caricamento } = useDatiAdmin('/statistiche');

  return (
    <LayoutAdmin
      titolo="Pannello di controllo"
      sottotitolo="Dati letti dal database attraverso le API di amministrazione."
    >
      {caricamento && !dati ? <Caricamento /> : null}
      <Errore testo={errore} />

      {dati ? (
        <>
          <section className="statistiche">
            <div className="card">
              <span className="numero">{dati.statistiche.utenti}</span>
              <span className="etichetta-dato">Utenti</span>
            </div>
            <div className="card">
              <span className="numero">{dati.statistiche.campi}</span>
              <span className="etichetta-dato">Campi</span>
            </div>
            <div className="card">
              <span className="numero">{dati.statistiche.prenotazioni}</span>
              <span className="etichetta-dato">Prenotazioni</span>
            </div>
            <div className="card">
              <span className="numero">{dati.statistiche.post}</span>
              <span className="etichetta-dato">Post</span>
            </div>
          </section>

          <section>
            <h2>Sport disponibili</h2>
            <div className="chips">
              {dati.sport.map((s) => (
                <span className="chip" key={s.id}>
                  {s.nome}
                </span>
              ))}
            </div>
          </section>

          <section>
            <h2>Ultime prenotazioni</h2>
            {dati.ultime.length === 0 ? (
              <p className="vuoto">Nessuna prenotazione registrata.</p>
            ) : (
              <div className="tabella-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Sport</th>
                      <th>Campo</th>
                      <th>Data</th>
                      <th>Ora</th>
                      <th>Persone</th>
                      <th>Totale</th>
                      <th>Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dati.ultime.map((b) => (
                      <tr key={b.id}>
                        <td>{b.id}</td>
                        <td>{b.sport}</td>
                        <td>{b.campo}</td>
                        <td>{data(b.data)}</td>
                        <td>{b.ora}</td>
                        <td>{b.partecipanti}</td>
                        <td>{euro(b.totale)}</td>
                        <td>
                          <span className={`stato ${b.stato}`}>{b.stato.replace('_', ' ')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </LayoutAdmin>
  );
}
