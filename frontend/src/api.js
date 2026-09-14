/**
 * Client HTTP verso il backend Express.
 * Aggiunge automaticamente il token JWT salvato dopo il login.
 */

const BASE =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000/api`;

const CHIAVE_TOKEN = 'sporteasy_token';
// Il pannello di controllo ha una sessione tutta sua: chiave diversa, token
// diverso, scadenza diversa. Cosi' un accesso non scalza mai l'altro.
const CHIAVE_TOKEN_ADMIN = 'sporteasy_admin_token';

export function getToken() {
  try {
    return localStorage.getItem(CHIAVE_TOKEN);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(CHIAVE_TOKEN, token);
    else localStorage.removeItem(CHIAVE_TOKEN);
  } catch {
    /* storage non disponibile: si continua senza persistenza */
  }
}

/** Token dell'amministratore (sessione del pannello di controllo). */
export function getTokenAdmin() {
  try {
    return localStorage.getItem(CHIAVE_TOKEN_ADMIN);
  } catch {
    return null;
  }
}

export function setTokenAdmin(token) {
  try {
    if (token) localStorage.setItem(CHIAVE_TOKEN_ADMIN, token);
    else localStorage.removeItem(CHIAVE_TOKEN_ADMIN);
  } catch {
    /* storage non disponibile: si continua senza persistenza */
  }
}

async function richiesta(metodo, url, corpo, { admin = false } = {}) {
  const headers = {};
  const token = admin ? getTokenAdmin() : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';

  let risposta;
  try {
    risposta = await fetch(BASE + url, {
      method: metodo,
      headers,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new Error('Server non raggiungibile. Controlla che il backend sia avviato.');
  }

  if (risposta.status === 204) return null;

  const testo = await risposta.text();
  const dati = testo ? JSON.parse(testo) : null;

  if (!risposta.ok) {
    const err = new Error((dati && dati.errore) || `Errore ${risposta.status}`);
    err.status = risposta.status;
    throw err;
  }
  return dati;
}

export const api = {
  get: (url) => richiesta('GET', url),
  post: (url, corpo) => richiesta('POST', url, corpo ?? {}),
  put: (url, corpo) => richiesta('PUT', url, corpo ?? {}),
  del: (url) => richiesta('DELETE', url),
  BASE,
};

/**
 * Client delle rotte di amministrazione (/api/admin/*): manda il token
 * dell'amministratore invece di quello utente. Gli indirizzi si scrivono
 * senza il prefisso: apiAdmin.get('/utenti') chiama /api/admin/utenti.
 */
export const apiAdmin = {
  get: (url) => richiesta('GET', '/admin' + url, undefined, { admin: true }),
  post: (url, corpo) => richiesta('POST', '/admin' + url, corpo ?? {}, { admin: true }),
  put: (url, corpo) => richiesta('PUT', '/admin' + url, corpo ?? {}, { admin: true }),
  del: (url) => richiesta('DELETE', '/admin' + url, undefined, { admin: true }),
};
