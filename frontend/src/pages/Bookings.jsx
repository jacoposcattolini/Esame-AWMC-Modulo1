import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Navigazione from '../components/Navigazione';
import { useAuth } from '../context/AuthContext';
import { BarraRicerca, Caricamento, Conferma, Errore, Intestazione } from '../components/Ui';
import InvitaPartecipanti from '../components/InvitaPartecipanti';
import { prenotazionePassata } from '../orario';

export default function Bookings() {
  const { variaSaldo } = useAuth();
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [cerca, setCerca] = useState('');
  const [errore, setErrore] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  // prenotazione per cui e' aperto il dialog di conferma
  const [daAnnullare, setDaAnnullare] = useState(null);
  // prenotazione altrui da cui si sta per uscire (stessa conferma)
  const [daLasciare, setDaLasciare] = useState(null);
  const [inCorso, setInCorso] = useState(false);
  // prenotazione per cui e' aperta la finestra degli inviti, e l'esito
  const [daInvitare, setDaInvitare] = useState(null);
  const [invitiFatti, setInvitiFatti] = useState('');

  useEffect(() => {
    let vivo = true;
    api
      .get('/bookings')
      .then((r) => vivo && setPrenotazioni(r))
      .catch((err) => vivo && setErrore(err.message))
      .finally(() => vivo && setCaricamento(false));
    return () => {
      vivo = false;
    };
  }, []);

  /** Eseguita solo dopo la conferma esplicita nel dialog. */
  async function annulla() {
    setInCorso(true);
    try {
      const aggiornata = await api.del(`/bookings/${daAnnullare.id}`);
      // "mio" non torna dalla risposta: si conserva quello gia' noto
      setPrenotazioni((elenco) =>
        elenco.map((b) => (b.id === aggiornata.id ? { ...aggiornata, mio: b.mio } : b))
      );
      // il rimborso finisce sul saldo: il contatore si aggiorna subito
      variaSaldo(aggiornata.rimborsato);
      setDaAnnullare(null);
    } catch (err) {
      setErrore(err.message);
      setDaAnnullare(null);
    } finally {
      setInCorso(false);
    }
  }

  /** Ci si toglie da una prenotazione altrui: anche qui si conferma prima. */
  async function esci() {
    setInCorso(true);
    try {
      const aggiornata = await api.del(`/bookings/${daLasciare.id}/join`);
      setPrenotazioni((elenco) => elenco.filter((x) => x.id !== daLasciare.id));
      variaSaldo(aggiornata.rimborsato);
      setDaLasciare(null);
    } catch (err) {
      setErrore(err.message);
      setDaLasciare(null);
    } finally {
      setInCorso(false);
    }
  }

  /**
   * Inviti spediti: si chiude la finestra, si conferma quanti sono partiti e
   * si rilegge l'elenco, cosi' i posti liberi mostrati restano quelli veri
   * (qualcuno potrebbe essersi aggiunto nel frattempo).
   */
  function fineInviti(quanti) {
    setDaInvitare(null);
    setInvitiFatti(
      quanti === 1 ? 'Invito inviato a 1 persona.' : `Invito inviato a ${quanti} persone.`
    );
    api.get('/bookings').then(setPrenotazioni).catch(() => {});
  }

  // la ricerca guarda campo, sport, organizzatore e stato
  const elenco = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (!q) return prenotazioni;
    return prenotazioni.filter((b) =>
      [b.campo, b.sport, b.organizzatore, b.stato.replace('_', ' ')]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [prenotazioni, cerca]);

  return (
    <div className="app">
      <Intestazione titolo="Prenotazioni" indietro={false} />

      <div className="ricerca-sezione">
        <BarraRicerca valore={cerca} onChange={setCerca} placeholder="Cerca fra le tue prenotazioni" />
      </div>

      {/* "lista-verticale": una prenotazione per riga, anche su desktop */}
      <div className="contenuto lista-verticale">
        <Errore testo={errore} />
        {invitiFatti && <p className="aiuto">{invitiFatti}</p>}
        {caricamento && <Caricamento />}

        {elenco.map((b) => {
          /* Una prenotazione la cui ora e' gia' cominciata non si tocca piu':
             la partita e' andata, non c'e' niente da annullare, da lasciare o
             a cui invitare qualcuno (e il server rifiuta comunque). */
          const passata = prenotazionePassata(b);
          // una prenotazione propria rimasta "in attesa" non e' mai stata pagata:
          // toccandola si torna alla schermata di pagamento, dove ci si era fermati
          const daCompletare = b.mio && b.stato === 'in_attesa' && !passata;
          const dettagli = (
            <>
              <img src={b.immagine} alt="" loading="lazy" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>{b.campo}</h3>
                <p>
                  {b.sport} · {new Date(b.data).toLocaleDateString('it-IT')} alle {b.ora}
                  <br />
                  {b.iscritti} di {b.posti} posti occupati
                  {b.iscritti >= b.posti ? ' (al completo)' : ''} · {Number(b.totale).toFixed(2)} €
                  {!b.mio && (
                    <>
                      <br />
                      Organizzata da {b.organizzatore}
                    </>
                  )}
                </p>
                <span className={`badge ${b.stato}`}>{b.stato.replace('_', ' ')}</span>
                {passata && b.stato !== 'annullata' && <span className="badge passata">già svolta</span>}
                {daCompletare && (
                  <span className="riprendi-nota">Tocca per completare il pagamento ›</span>
                )}
              </div>
            </>
          );

          return (
          <div key={b.id} className={`riga-prenotazione${daCompletare ? ' da-completare' : ''}`}>
            {daCompletare ? (
              <Link className="riga-riprendi" to={`/pagamento/${b.id}`}>
                {dettagli}
              </Link>
            ) : (
              dettagli
            )}

            {b.stato !== 'annullata' && passata && (
              <span className="nota-passata">
                {b.mio ? 'Non più annullabile' : 'Non puoi più uscirne'}
              </span>
            )}

            {b.stato !== 'annullata' && !passata &&
              (b.mio ? (
                <span className="azioni-prenotazione">
                  {/* con posti ancora liberi si possono invitare amici e gruppi */}
                  {b.iscritti < b.posti && (
                    <button type="button" className="btn-testo" onClick={() => setDaInvitare(b)}>
                      Invita
                    </button>
                  )}
                  <button type="button" className="btn-testo pericolo" onClick={() => setDaAnnullare(b)}>
                    Annulla
                  </button>
                </span>
              ) : (
                <button type="button" className="btn-testo" onClick={() => setDaLasciare(b)}>
                  Esci
                </button>
              ))}
          </div>
          );
        })}

        {!caricamento && elenco.length === 0 && (
          <p className="stato-vuoto">
            {cerca
              ? 'Nessuna prenotazione corrisponde alla ricerca.'
              : 'Non hai ancora prenotazioni. Scegli uno sport dalla Home!'}
          </p>
        )}
      </div>

      {daInvitare && (
        <InvitaPartecipanti
          prenotazione={daInvitare}
          onChiudi={() => setDaInvitare(null)}
          onInvitati={fineInviti}
        />
      )}

      {daLasciare && (
        <Conferma
          titolo="Uscire dalla prenotazione?"
          messaggio={`Non risulterai più iscritto al ${daLasciare.sport.toLowerCase()} a ${
            daLasciare.campo
          } del ${new Date(daLasciare.data).toLocaleDateString('it-IT')} alle ${daLasciare.ora}${
            daLasciare.prezzo > 0
              ? `, e i ${Number(daLasciare.prezzo).toFixed(2)} € della tua quota torneranno sul saldo SportEasy`
              : ''
          }. Il posto tornerà libero per qualcun altro.`}
          etichetta="Sì, esci"
          etichettaAnnulla="Torna indietro"
          pericolo
          inCorso={inCorso}
          onConferma={esci}
          onAnnulla={() => setDaLasciare(null)}
        />
      )}

      {daAnnullare && (
        <Conferma
          titolo="Annullare la prenotazione?"
          messaggio={`La prenotazione di ${daAnnullare.sport} a ${daAnnullare.campo} del ${new Date(
            daAnnullare.data
          ).toLocaleDateString('it-IT')} alle ${daAnnullare.ora} verrà annullata, il campo tornerà libero per quell’orario e chi si era aggiunto non risulterà più iscritto.`}
          etichetta="Sì, annulla"
          etichettaAnnulla="Torna indietro"
          pericolo
          inCorso={inCorso}
          onConferma={annulla}
          onAnnulla={() => setDaAnnullare(null)}
        />
      )}

      <Navigazione />
    </div>
  );
}
