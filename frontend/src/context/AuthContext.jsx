import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, apiAdmin, getToken, setToken, getTokenAdmin, setTokenAdmin } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utente, setUtente] = useState(null);
  // sessione del pannello di controllo: vive accanto a quella utente, non al
  // suo posto (chiavi e token separati, vedi api.js)
  const [admin, setAdmin] = useState(null);
  const [caricamento, setCaricamento] = useState(true);

  // al primo avvio: se c'e' un token salvato si recupera l'utente
  useEffect(() => {
    let annullato = false;
    async function init() {
      // il token dell'admin si controlla a parte: senza questo, ricaricando
      // una pagina del pannello si verrebbe buttati fuori a ogni F5
      if (getTokenAdmin()) {
        try {
          const sessione = await apiAdmin.get('/sessione');
          if (!annullato) setAdmin(sessione);
        } catch {
          setTokenAdmin(null);
        }
      }

      if (!getToken()) {
        setCaricamento(false);
        return;
      }
      try {
        const me = await api.get('/auth/me');
        if (!annullato) setUtente(me);
      } catch {
        setToken(null);
      } finally {
        if (!annullato) setCaricamento(false);
      }
    }
    init();
    return () => {
      annullato = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const dati = await api.post('/auth/login', { email, password });
    setToken(dati.token);
    setUtente(dati.utente);
    return dati.utente;
  }, []);

  /**
   * Somma un importo al saldo gia' in memoria (positivo accredita, negativo
   * addebita). La usano annullamenti, rimborsi e pagamenti per aggiornare il
   * contatore subito, senza ricaricare la pagina.
   */
  const variaSaldo = useCallback((importo) => {
    if (!importo) return;
    setUtente((u) => (u ? { ...u, saldo: Math.max(0, Number(u.saldo || 0) + Number(importo)) } : u));
  }, []);

  /** Accesso all'account DEMO: nessuna credenziale da digitare. */
  const accediComeProva = useCallback(async () => {
    const dati = await api.post('/auth/demo');
    setToken(dati.token);
    setUtente(dati.utente);
    return dati.utente;
  }, []);

  /**
   * Accesso al pannello di controllo: endpoint dedicato (/api/admin/login),
   * nome utente invece dell'email e token separato. Non tocca in alcun modo
   * la sessione dell'utente eventualmente gia' aperta.
   */
  const accediComeAdmin = useCallback(async (nome, password) => {
    const dati = await apiAdmin.post('/login', { nome, password });
    setTokenAdmin(dati.token);
    setAdmin(dati.amministratore);
    return dati.amministratore;
  }, []);

  /** Uscita dal pannello: butta via solo il token dell'amministratore. */
  const esciDaAdmin = useCallback(() => {
    setTokenAdmin(null);
    setAdmin(null);
  }, []);

  const registrati = useCallback(async (payload) => {
    const dati = await api.post('/auth/register', payload);
    setToken(dati.token);
    setUtente(dati.utente);
    return dati.utente;
  }, []);

  /**
   * Uscita: si avvisa il server prima di buttare via il token.
   * Per l'account DEMO e' il momento in cui i dati tornano allo stato
   * iniziale; se la chiamata fallisce si esce lo stesso.
   */
  const esci = useCallback(async () => {
    try {
      if (getToken()) await api.post('/auth/logout');
    } catch {
      /* niente rete o token scaduto: si esce comunque */
    }
    setToken(null);
    setUtente(null);
  }, []);

  const valore = useMemo(
    () => ({
      utente,
      setUtente,
      variaSaldo,
      caricamento,
      login,
      accediComeProva,
      registrati,
      esci,
      admin,
      accediComeAdmin,
      esciDaAdmin,
    }),
    [utente, caricamento, variaSaldo, login, accediComeProva, registrati, esci, admin, accediComeAdmin, esciDaAdmin]
  );

  return <AuthContext.Provider value={valore}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth va usato dentro AuthProvider');
  return ctx;
}
