/**
 * ORARI DEI CAMPI - fuso orario e confronto "e' gia' passato?".
 *
 * I campi stanno tutti a Macerata, quindi il confronto va fatto nell'ora
 * locale italiana, non in quella del server: il container Docker gira in UTC
 * (un'ora indietro d'inverno, due d'estate), quindi un banale
 * `new Date().getHours()` lascerebbe prenotare orari gia' passati.
 * Il client fa lo stesso conto con lo stesso fuso (vedi VenueDetail.jsx):
 * qui c'e' comunque il controllo definitivo, perche' l'orologio del telefono
 * puo' essere sbagliato o la richiesta puo' arrivare senza passare dall'app.
 */
const FUSO_CAMPI = process.env.FUSO_CAMPI || 'Europe/Rome';

const FORMATO = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_CAMPI,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23', // mezzanotte e' "00", non "24"
});

/**
 * Data e ora correnti sui campi. La data torna come 'YYYY-MM-DD', cosi' due
 * giorni si possono confrontare direttamente da stringa a stringa.
 */
function adesso(quando = new Date()) {
  const p = Object.fromEntries(FORMATO.formatToParts(quando).map((x) => [x.type, x.value]));
  return {
    data: `${p.year}-${p.month}-${p.day}`,
    ora: Number(p.hour),
    minuti: Number(p.minute),
  };
}

/** Ora di uno slot come numero: '14.00' -> 14, '9.00' -> 9, '14:00' -> 14. */
function oraDelloSlot(slot) {
  const n = parseInt(String(slot).split(/[.:]/)[0], 10);
  return Number.isNaN(n) ? null : n;
}

/** Normalizza una data (stringa o Date) in 'YYYY-MM-DD'. */
function comeGiorno(data) {
  if (data instanceof Date) return adesso(data).data;
  const testo = String(data || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(testo) ? testo : null;
}

/**
 * true se lo slot richiesto e' gia' passato rispetto all'ora dei campi.
 * L'ora in corso non e' piu' prenotabile: alle 14:30 lo slot delle 14.00 e'
 * considerato passato.
 */
function slotPassato(data, slot, quando = new Date()) {
  const giorno = comeGiorno(data);
  const ora = oraDelloSlot(slot);
  if (!giorno || ora === null) return false; // formati non validi: li respinge chi valida i campi

  const ora_ = adesso(quando);
  if (giorno < ora_.data) return true;
  if (giorno > ora_.data) return false;
  return ora <= ora_.ora;
}

module.exports = { adesso, slotPassato };
