import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Accesso al pannello di controllo, nell'angolo della schermata "Accedi".
 *
 * E' volutamente separato dal modulo principale: gli utenti entrano con
 * l'email, l'amministratore con un nome utente. Anche dietro le quinte i due
 * percorsi non si incrociano mai (endpoint, token e sessione diversi).
 *
 * Su schermo largo il modulo e' gia' aperto nell'angolo; su telefono
 * resterebbe sopra al modulo principale, quindi si mostra come una scritta
 * discreta che lo apre al tocco.
 */
export default function AccessoAdmin() {
  const { accediComeAdmin } = useAuth();
  const navigate = useNavigate();

  const [aperto, setAperto] = useState(() => {
    try {
      return window.matchMedia('(min-width: 700px)').matches;
    } catch {
      return false;
    }
  });
  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [invio, setInvio] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErrore('');
    setInvio(true);
    try {
      await accediComeAdmin(nome, password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInvio(false);
    }
  }

  if (!aperto) {
    return (
      <div className="accesso-admin">
        <button type="button" className="apri-admin" onClick={() => setAperto(true)}>
          <ChiaveIcona />
          Area amministratore
        </button>
      </div>
    );
  }

  return (
    <div className="accesso-admin">
      <form className="scheda-admin" onSubmit={onSubmit}>
        <div className="testa-admin">
          <span className="titolo-admin">
            <ChiaveIcona />
            Area amministratore
          </span>
          <button
            type="button"
            className="chiudi-admin"
            aria-label="Chiudi l’accesso amministratore"
            onClick={() => setAperto(false)}
          >
            ✕
          </button>
        </div>

        {errore ? <p className="errore-admin">{errore}</p> : null}

        <label>
          <span>Nome</span>
          <input
            type="text"
            autoComplete="username"
            placeholder="Nome utente"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </label>

        <label>
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" className="entra-admin" disabled={invio}>
          {invio ? 'Accesso...' : 'Entra nel pannello'}
        </button>
      </form>
    </div>
  );
}

function ChiaveIcona() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
