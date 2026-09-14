/**
 * ORARI DEI CAMPI (lato client).
 *
 * I campi sono tutti a Macerata: data e ora "di adesso" vanno lette nel fuso
 * italiano, non in quello del dispositivo ne' in UTC.
 * (`toISOString()` dava la data UTC: fra mezzanotte e le 2 del mattino
 * restituiva il giorno prima, e il calendario lasciava scegliere ieri.)
 * Lo stesso conto, con lo stesso fuso, lo rifa' il server in
 * backend/src/config/orario.js: qui serve solo a mostrare le cose giuste
 * (slot non prenotabili, prenotazioni ormai passate), il controllo che conta
 * resta quello del server.
 */

const FUSO_CAMPI = 'Europe/Rome';

const FORMATO_CAMPI = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_CAMPI,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** Data e ora di adesso sui campi, con la data come 'YYYY-MM-DD'. */
export function adessoAiCampi() {
  const p = Object.fromEntries(FORMATO_CAMPI.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, ora: Number(p.hour) };
}

/** Ora di uno slot come numero: '14.00' -> 14. */
const oraDelloSlot = (slot) => parseInt(String(slot).split(/[.:]/)[0], 10);

/** true se lo slot e' gia' cominciato: alle 14:30 le 14.00 non si prenotano piu'. */
export function slotPassato(data, slot, adesso = adessoAiCampi()) {
  if (data > adesso.data) return false;
  if (data < adesso.data) return true;
  return oraDelloSlot(slot) <= adesso.ora;
}

/**
 * true se la prenotazione e' ormai passata: la partita e' cominciata (o
 * finita), quindi non c'e' piu' niente da annullare o da lasciare.
 * `data` arriva dall'API come data ISO completa: conta solo il giorno.
 */
export function prenotazionePassata(prenotazione) {
  if (!prenotazione) return false;
  return slotPassato(String(prenotazione.data).slice(0, 10), prenotazione.ora);
}
