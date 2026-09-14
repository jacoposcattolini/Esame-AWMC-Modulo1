import { useEffect, useState } from 'react';
import { apiAdmin } from '../../api';
import { Caricamento, Conferma, Errore } from '../../components/Ui';
import { Avviso, LayoutAdmin, useAzioneAdmin, useDatiAdmin, euro } from './comuni';

const MODULO_VUOTO = {
  sport_id: '',
  nome: '',
  indirizzo: '',
  lat: '',
  lng: '',
  apertura: '9',
  chiusura: '22',
  prezzo: '5',
  immagine: '',
  rating: '5',
  ordine: '0',
};

const ore = (da, a) => Array.from({ length: a - da + 1 }, (_, i) => da + i);

/**
 * Campi sportivi: modulo guidato per aggiungerne di nuovi ed elenco di quelli
 * presenti. La validazione dei dati resta sul server (una regola sola per
 * tutti): qui si mostra il messaggio che il server rimanda indietro.
 */
export default function Campi() {
  const { dati, errore, caricamento, ricarica } = useDatiAdmin('/campi');
  const { avviso, setAvviso, inCorso, esegui } = useAzioneAdmin({ ricarica });
  const [modulo, setModulo] = useState(MODULO_VUOTO);
  const [daEliminare, setDaEliminare] = useState(null);

  const campi = dati ? dati.campi : [];
  const sport = dati ? dati.sport : [];
  const immagini = dati ? dati.immagini : [];

  // le tendine "Sport" e "Foto" si riempiono quando arrivano i dati
  useEffect(() => {
    setModulo((m) => ({
      ...m,
      sport_id: m.sport_id || (sport[0] ? String(sport[0].id) : ''),
      immagine: m.immagine || immagini[0] || '',
    }));
  }, [sport, immagini]);

  const cambia = (campo) => (e) => setModulo((m) => ({ ...m, [campo]: e.target.value }));

  async function aggiungi(e) {
    e.preventDefault();
    const risposta = await esegui(
      () => apiAdmin.post('/campi', modulo),
      (r) => `Campo aggiunto: «${r.campo.nome}» è già prenotabile dall’app.`
    );
    if (risposta) {
      setModulo({ ...MODULO_VUOTO, sport_id: modulo.sport_id, immagine: immagini[0] || '' });
    }
  }

  async function elimina() {
    const c = daEliminare;
    setDaEliminare(null);
    await esegui(
      () => apiAdmin.del(`/campi/${c.id}`),
      `Campo «${c.nome}» eliminato, insieme alle sue prenotazioni.`
    );
  }

  return (
    <LayoutAdmin
      titolo="Campi sportivi"
      sottotitolo={`${campi.length} campi disponibili nell’app. Da qui puoi aggiungerne di nuovi o eliminarli.`}
    >
      {caricamento && !dati ? <Caricamento /> : null}
      <Errore testo={errore} />
      <Avviso avviso={avviso} />

      {/* ------------------------- MODULO GUIDATO ------------------------- */}
      <section className="riquadro">
        <h2>Aggiungi un campo</h2>
        <p className="sottotitolo">
          Quattro passaggi: cosa si gioca, dove si trova, quando è aperto e quanto costa, com’è
          fatto. I campi con un asterisco sono obbligatori.
        </p>

        <form className="modulo-guidato" onSubmit={aggiungi}>
          <fieldset>
            <legend>
              <span className="passo">1</span> Sport e nome
            </legend>

            <label>
              Sport *
              <select value={modulo.sport_id} onChange={cambia('sport_id')} required>
                {sport.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} (max {s.max_partecipanti} partecipanti)
                  </option>
                ))}
              </select>
              <small>Il campo comparirà nella schermata di questo sport.</small>
            </label>

            <label>
              Nome del campo *
              <input
                type="text"
                maxLength={120}
                placeholder="Es. Campo Helvia Recina"
                value={modulo.nome}
                onChange={cambia('nome')}
                required
              />
              <small>
                Come lo vedranno gli utenti. Due campi dello stesso sport non possono avere lo
                stesso nome.
              </small>
            </label>
          </fieldset>

          <fieldset>
            <legend>
              <span className="passo">2</span> Dove si trova
            </legend>

            <label>
              Indirizzo
              <input
                type="text"
                maxLength={160}
                placeholder="Es. Via dei Velini 12, Macerata"
                value={modulo.indirizzo}
                onChange={cambia('indirizzo')}
              />
              <small>Mostrato nella scheda del campo.</small>
            </label>

            <div className="coppia">
              <label>
                Latitudine
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="43.302..."
                  value={modulo.lat}
                  onChange={cambia('lat')}
                />
              </label>
              <label>
                Longitudine
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="13.453..."
                  value={modulo.lng}
                  onChange={cambia('lng')}
                />
              </label>
            </div>
            <p className="nota-campo">
              Servono al segnaposto sulla mappa: si copiano da Google Maps (tasto destro sul punto →
              le due cifre in cima al menu). Lasciandole vuote il campo resta prenotabile, ma senza
              pin.
            </p>
          </fieldset>

          <fieldset>
            <legend>
              <span className="passo">3</span> Orari e prezzo
            </legend>

            <div className="coppia">
              <label>
                Apre alle *
                <select value={modulo.apertura} onChange={cambia('apertura')} required>
                  {ore(6, 22).map((h) => (
                    <option key={h} value={h}>
                      {h}.00
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Chiude alle *
                <select value={modulo.chiusura} onChange={cambia('chiusura')} required>
                  {ore(7, 24).map((h) => (
                    <option key={h} value={h}>
                      {h}.00
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="nota-campo">
              Gli utenti potranno prenotare le ore piene comprese fra questi due orari.
            </p>

            <label>
              Prezzo a persona (€) *
              <input
                type="text"
                inputMode="decimal"
                value={modulo.prezzo}
                onChange={cambia('prezzo')}
                required
              />
              <small>Metti 0 se il campo è gratuito: in quel caso ci si aggiunge senza pagare.</small>
            </label>
          </fieldset>

          <fieldset>
            <legend>
              <span className="passo">4</span> Foto e presentazione
            </legend>

            <label>
              Foto *
              <select value={modulo.immagine} onChange={cambia('immagine')} required>
                {immagini.map((img) => (
                  <option key={img} value={img}>
                    {img.replace('/img/', '')}
                  </option>
                ))}
              </select>
              <small>
                Sono le immagini già presenti nel progetto (cartella <code>frontend/public/img</code>).
                Per usarne una nuova, copiala lì e ricarica questa pagina.
              </small>
            </label>

            <div className="coppia">
              <label>
                Valutazione
                <select value={modulo.rating} onChange={cambia('rating')}>
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>
                      {r} stelle
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ordine nell’elenco
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={modulo.ordine}
                  onChange={cambia('ordine')}
                />
                <small>Più basso = più in alto nella lista.</small>
              </label>
            </div>
          </fieldset>

          <div className="azioni-modulo">
            <button type="submit" className="btn-piccolo primario" disabled={inCorso}>
              {inCorso ? 'Attendi...' : 'Aggiungi il campo'}
            </button>
          </div>
        </form>
      </section>

      {/* --------------------------- ELENCO CAMPI -------------------------- */}
      <h2 className="titolo-elenco">Campi già presenti</h2>

      {dati && campi.length === 0 ? <p className="vuoto">Nessun campo registrato.</p> : null}

      {campi.length > 0 ? (
        <div className="tabella-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th />
                <th>Sport</th>
                <th>Nome</th>
                <th>Indirizzo</th>
                <th>Orari</th>
                <th>Prezzo</th>
                <th>Mappa</th>
                <th>Prenotazioni</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {campi.map((v) => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>
                    <img className="miniatura" src={v.immagine} alt="" />
                  </td>
                  <td>{v.sport_nome}</td>
                  <td>{v.nome}</td>
                  <td>{v.indirizzo || '-'}</td>
                  <td>
                    {v.apertura} - {v.chiusura}
                  </td>
                  <td>{euro(v.prezzo)}</td>
                  <td>{v.lat !== null && v.lng !== null ? 'sì' : 'no'}</td>
                  <td>{v.prenotazioni}</td>
                  <td className="azioni">
                    <button
                      type="button"
                      className="btn-piccolo pericolo"
                      disabled={inCorso}
                      onClick={() => {
                        setAvviso(null);
                        setDaEliminare(v);
                      }}
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
          titolo={`Eliminare il campo «${daEliminare.nome}»?`}
          messaggio={
            Number(daEliminare.prenotazioni) > 0
              ? `Verranno eliminate anche le sue ${daEliminare.prenotazioni} prenotazioni, con rimborso di quanto pagato.`
              : 'Il campo sparisce dall’app. L’operazione non si può annullare.'
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
