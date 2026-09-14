import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import Navigazione from '../components/Navigazione';
import { Caricamento, Conferma, Errore, Intestazione } from '../components/Ui';

/**
 * METODI DI PAGAMENTO del profilo.
 *
 * Non c'e' nessun gateway di pagamento collegato: qui si gestiscono solo i
 * dati della carta. Il numero completo NON viene mai inviato al server: resta
 * in questa pagina il tempo di controllarlo e di ricavarne le ultime quattro
 * cifre, che sono l'unica parte salvata insieme a circuito, intestatario e
 * scadenza. Lo stesso vale per il CVV: viene chiesto e validato come in un
 * vero modulo di pagamento, ma non lascia il browser e non viene salvato
 * (i codici di sicurezza non si conservano mai, nemmeno cifrati).
 */

/** Riconosce il circuito dalle prime cifre, come fanno i moduli di pagamento. */
function circuitoDa(numero) {
  const n = numero.replace(/\D/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'Mastercard';
  if (/^(50|5[6-9]|6)/.test(n)) return 'Maestro';
  if (/^3[47]/.test(n)) return 'American Express';
  return 'Carta';
}

/** Il numero della carta deve avere esattamente questo numero di cifre. */
const CIFRE_CARTA = 16;

/** American Express usa un CVV di 4 cifre, tutti gli altri circuiti 3. */
const cifreCvv = (circuito) => (circuito === 'American Express' ? 4 : 3);

/** Solo le cifre: quello che si digita viene ripulito subito. */
const soloCifre = (testo) => String(testo).replace(/\D/g, '').slice(0, CIFRE_CARTA);

/*
 * Niente verifica di Luhn: i pagamenti sono simulati, e pretendere la somma
 * di controllo dei circuiti veri voleva dire rifiutare qualsiasi numero
 * inventato. Restano 16 cifre, solo numeri, scadenza valida e CVV.
 */

/** "4539 1488 0343 6467" mentre si scrive. */
const raggruppa = (numero) => soloCifre(numero).replace(/(.{4})/g, '$1 ').trim();

/**
 * Dove sta il cursore nel testo formattato dopo un certo numero di cifre.
 * Serve perche' il campo mostra il numero a gruppi di quattro: ogni spazio
 * aggiunto sposta di uno tutto quello che viene dopo, e senza ricalcolare la
 * posizione il cursore resterebbe indietro (le cifre digitate finirebbero
 * prima dell'ultima invece che in fondo).
 */
function posizioneCursore(cifrePrima) {
  if (cifrePrima <= 0) return 0;
  return cifrePrima + Math.floor((cifrePrima - 1) / 4);
}

const dueCifre = (n) => String(n).padStart(2, '0');

const VUOTA = { intestatario: '', numero: '', cvv: '', mese: '', anno: '' };

export default function PaymentMethods() {
  const [carte, setCarte] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');
  const [inCorso, setInCorso] = useState(false);
  // null = nessun modulo aperto | 'nuova' = aggiunta | <id> = modifica
  const [modulo, setModulo] = useState(null);
  const [bozza, setBozza] = useState(VUOTA);
  const [daEliminare, setDaEliminare] = useState(null);
  // il campo del numero si riscrive a ogni tasto (gruppi di quattro): questi
  // due servono a rimettere il cursore dove l'utente lo aveva lasciato
  const campoNumero = useRef(null);
  const cursoreDaRipristinare = useRef(null);

  const annoCorrente = new Date().getFullYear();
  const anni = useMemo(
    () => Array.from({ length: 12 }, (_, i) => annoCorrente + i),
    [annoCorrente]
  );

  useEffect(() => {
    let vivo = true;
    api
      .get('/payment-methods')
      .then((r) => vivo && setCarte(r))
      .catch((err) => vivo && setErrore(err.message))
      .finally(() => vivo && setCaricamento(false));
    return () => {
      vivo = false;
    };
  }, []);

  const aggiorna = (campo) => (e) => setBozza((d) => ({ ...d, [campo]: e.target.value }));

  /**
   * Numero della carta: si tiene in memoria solo la sequenza di cifre, mentre
   * a schermo si mostra a gruppi di quattro. Qualunque carattere non numerico
   * viene scartato, da qualsiasi parte arrivi (tastiera, incolla, riempimento
   * automatico del browser), e oltre le 16 cifre non si va.
   */
  function scriviNumero(e) {
    const campo = e.target;
    const testo = campo.value;
    const fine = campo.selectionStart === null ? testo.length : campo.selectionStart;
    // quante cifre ci sono prima del cursore: e' l'unica misura che non
    // cambia quando la formattazione aggiunge o toglie uno spazio
    const cifrePrima = soloCifre(testo.slice(0, fine)).length;

    cursoreDaRipristinare.current = posizioneCursore(cifrePrima);
    setBozza((d) => ({ ...d, numero: soloCifre(testo) }));
  }

  // subito dopo il ridisegno il cursore torna al posto giusto
  useLayoutEffect(() => {
    const campo = campoNumero.current;
    const posizione = cursoreDaRipristinare.current;
    cursoreDaRipristinare.current = null;
    if (campo && posizione !== null && document.activeElement === campo) {
      campo.setSelectionRange(posizione, posizione);
    }
  }, [bozza.numero]);

  const cifreInserite = soloCifre(bozza.numero).length;
  // il circuito si riconosce mentre si digita: serve a sapere quante cifre
  // deve avere il CVV (4 per American Express, 3 per gli altri)
  const circuito = circuitoDa(bozza.numero);
  const cvvRichiesto = cifreCvv(circuito);

  function apriNuova() {
    setBozza(VUOTA);
    setErrore('');
    setModulo('nuova');
  }

  /** In modifica il numero non si tocca: il server ha solo le ultime 4 cifre. */
  function apriModifica(carta) {
    setBozza({
      intestatario: carta.intestatario,
      numero: '',
      cvv: '',
      mese: String(carta.scadenza_mese),
      anno: String(carta.scadenza_anno),
    });
    setErrore('');
    setModulo(carta.id);
  }

  async function salva(e) {
    e.preventDefault();
    setErrore('');

    if (bozza.intestatario.trim().length < 2) {
      setErrore('Scrivi il nome dell’intestatario');
      return;
    }
    if (!bozza.mese || !bozza.anno) {
      setErrore('Indica il mese e l’anno di scadenza');
      return;
    }

    const nuova = modulo === 'nuova';
    const cifre = soloCifre(bozza.numero);
    if (nuova && cifre.length !== CIFRE_CARTA) {
      setErrore(`Il numero della carta deve avere esattamente ${CIFRE_CARTA} cifre (ne hai inserite ${cifre.length})`);
      return;
    }
    // nel campo entrano solo cifre (vedi onChange): resta da controllarne il numero
    if (nuova && bozza.cvv.length !== cvvRichiesto) {
      setErrore(`Il CVV deve avere ${cvvRichiesto} cifre numeriche (lo trovi sul retro della carta)`);
      return;
    }
    const corpo = {
      intestatario: bozza.intestatario.trim(),
      scadenza_mese: Number(bozza.mese),
      scadenza_anno: Number(bozza.anno),
    };
    if (nuova) {
      // del numero esce da qui solo il finale: il resto non lascia il browser
      corpo.ultime4 = cifre.slice(-4);
      corpo.circuito = circuitoDa(cifre);
    }

    setInCorso(true);
    try {
      if (nuova) {
        const carta = await api.post('/payment-methods', corpo);
        setCarte((c) => [carta, ...c.map((x) => ({ ...x, predefinito: x.predefinito && !carta.predefinito }))]);
      } else {
        const carta = await api.put(`/payment-methods/${modulo}`, corpo);
        setCarte((c) => c.map((x) => (x.id === carta.id ? carta : x)));
      }
      setModulo(null);
      setBozza(VUOTA);
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInCorso(false);
    }
  }

  async function rendiPredefinita(id) {
    setErrore('');
    try {
      await api.put(`/payment-methods/${id}`, { predefinito: true });
      setCarte((c) => c.map((x) => ({ ...x, predefinito: x.id === id })));
    } catch (err) {
      setErrore(err.message);
    }
  }

  async function confermaEliminazione() {
    setInCorso(true);
    setErrore('');
    try {
      await api.del(`/payment-methods/${daEliminare.id}`);
      const restanti = carte.filter((c) => c.id !== daEliminare.id);
      // se era la predefinita, il server la sposta sulla piu' recente rimasta
      if (daEliminare.predefinito && restanti.length > 0) restanti[0].predefinito = true;
      setCarte([...restanti]);
      setDaEliminare(null);
    } catch (err) {
      setErrore(err.message);
      setDaEliminare(null);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="app senza-tabbar">
      <Intestazione titolo="Metodi di pagamento" />

      <div className="contenuto colonna-pagamenti">
        <Errore testo={errore} />
        {caricamento && <Caricamento testo="Carico i tuoi metodi di pagamento..." />}

        {!caricamento && carte.length === 0 && !modulo && (
          <p className="stato-vuoto">
            Non hai ancora salvato nessun metodo di pagamento.
          </p>
        )}

        {carte.length > 0 && (
          <div className="elenco-carte">
            {carte.map((c) => (
              <article key={c.id} className={`carta-salvata${c.predefinito ? ' predefinita' : ''}`}>
                <span className="carta-icona" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22">
                    <rect x="2.5" y="5" width="19" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M2.5 10h19" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </span>

                <span className="carta-testo">
                  <strong>
                    {c.circuito} ···· {c.ultime4}
                    {c.predefinito && <span className="pillola-info chiara">Predefinita</span>}
                  </strong>
                  <em>{c.intestatario}</em>
                  <small>Scade il {dueCifre(c.scadenza_mese)}/{c.scadenza_anno}</small>
                </span>

                <span className="carta-azioni">
                  {!c.predefinito && (
                    <button type="button" className="btn-testo" onClick={() => rendiPredefinita(c.id)}>
                      Usa come predefinita
                    </button>
                  )}
                  <button type="button" className="btn-testo" onClick={() => apriModifica(c)}>
                    Modifica
                  </button>
                  <button type="button" className="btn-testo pericolo" onClick={() => setDaEliminare(c)}>
                    Elimina
                  </button>
                </span>
              </article>
            ))}
          </div>
        )}

        {modulo === null ? (
          <button type="button" className="btn btn-pillola btn-aggiungi-carta" onClick={apriNuova}>
            Aggiungi una carta
          </button>
        ) : (
          <form className="modulo-carta" onSubmit={salva}>
            <h2>{modulo === 'nuova' ? 'Nuova carta' : 'Modifica carta'}</h2>

            <span className="etichetta">Intestatario</span>
            <label className="campo">
              <input
                type="text"
                placeholder="Nome e cognome"
                autoComplete="cc-name"
                value={bozza.intestatario}
                onChange={aggiorna('intestatario')}
                required
              />
            </label>

            {modulo === 'nuova' ? (
              <>
                <span className="etichetta">Numero della carta</span>
                <label className="campo">
                  <input
                    ref={campoNumero}
                    type="text"
                    inputMode="numeric"
                    placeholder="0000 0000 0000 0000"
                    /* niente riempimento automatico: su questo campo i gestori
                       di password del browser aprono il loro riquadro sopra
                       l'input e possono intercettare quello che si digita */
                    autoComplete="off"
                    name="numero-carta"
                    value={raggruppa(bozza.numero)}
                    onChange={scriviNumero}
                    aria-describedby="aiuto-numero-carta"
                    required
                  />
                </label>
                <p className="aiuto" id="aiuto-numero-carta">
                  {cifreInserite === 0
                    ? `${CIFRE_CARTA} cifre, solo numeri (0-9).`
                    : cifreInserite < CIFRE_CARTA
                      ? `${cifreInserite} di ${CIFRE_CARTA} cifre: ne mancano ${CIFRE_CARTA - cifreInserite}.`
                      : 'Numero completo.'}{' '}
                  Del numero vengono salvate solo le ultime 4 cifre: il resto non esce da questa pagina.
                </p>
              </>
            ) : (
              <p className="aiuto">
                Il numero della carta non è modificabile: per cambiarlo elimina la carta e aggiungine una nuova.
              </p>
            )}

            {modulo === 'nuova' && (
              <>
                <span className="etichetta">CVV</span>
                <label className="campo campo-cvv">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={'•'.repeat(cvvRichiesto)}
                    autoComplete="off"
                    maxLength={cvvRichiesto}
                    value={bozza.cvv}
                    onChange={(e) =>
                      setBozza((d) => ({ ...d, cvv: e.target.value.replace(/\D/g, '').slice(0, cvvRichiesto) }))
                    }
                    aria-describedby="aiuto-cvv"
                    required
                  />
                </label>
                <p className="aiuto" id="aiuto-cvv">
                  {cvvRichiesto} cifre{circuito === 'American Express' ? ' (American Express)' : ''}:
                  {' '}le trovi sul retro della carta. Il CVV non viene salvato né inviato: serve solo
                  a completare il modulo.
                </p>
              </>
            )}

            <span className="etichetta">Scadenza</span>
            <div className="scadenza-carta">
              <label className="campo">
                <select value={bozza.mese} onChange={aggiorna('mese')} required aria-label="Mese di scadenza">
                  <option value="">Mese</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{dueCifre(m)}</option>
                  ))}
                </select>
              </label>
              <label className="campo">
                <select value={bozza.anno} onChange={aggiorna('anno')} required aria-label="Anno di scadenza">
                  <option value="">Anno</option>
                  {anni.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="modale-azioni">
              <button
                type="button"
                className="btn btn-bordo"
                onClick={() => { setModulo(null); setErrore(''); }}
                disabled={inCorso}
              >
                Annulla
              </button>
              <button type="submit" className="btn btn-verde" disabled={inCorso}>
                {inCorso ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </form>
        )}

        <p className="nota-pagamenti">
          Pagamento simulato a scopo didattico: SportEasy non è collegato a nessun circuito reale e
          nessun importo viene addebitato. Le carte salvate servono solo a scegliere più in fretta al
          momento della prenotazione.
        </p>
      </div>

      {daEliminare && (
        <Conferma
          titolo="Eliminare la carta?"
          messaggio={`La carta ${daEliminare.circuito} ···· ${daEliminare.ultime4} verrà rimossa dal tuo profilo. Le prenotazioni già pagate non cambiano.`}
          etichetta="Elimina"
          pericolo
          inCorso={inCorso}
          onConferma={confermaEliminazione}
          onAnnulla={() => setDaEliminare(null)}
        />
      )}

      <Navigazione />
    </div>
  );
}
