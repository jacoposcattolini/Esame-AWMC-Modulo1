import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Conferma, Errore } from '../components/Ui';
import TestaAuth from '../components/TestaAuth';
import AccessoAdmin from '../components/AccessoAdmin';

/**
 * Account DEMO creato dal seed del database.
 * Si accede solo con l'email (lo username non e' piu' accettato): la sua e'
 * un indirizzo come gli altri, ma senza password. Si entra dal tasto dedicato
 * qui sotto (che chiama /api/auth/demo) oppure scrivendo solo la sua email.
 */
const UTENTE_DEMO = 'utenteprova@gmail.com';

export default function Login() {
  const { login, accediComeProva } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [invio, setInvio] = useState(false);
  // la spiegazione della DEMO si apre DOPO il clic, prima di entrare davvero
  const [spiegazione, setSpiegazione] = useState(false);

  /** Esegue l'accesso e porta alla home. */
  async function accedi(indirizzo, chiave) {
    setErrore('');
    setInvio(true);
    try {
      await login(indirizzo, chiave);
      navigate('/', { replace: true });
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInvio(false);
    }
  }

  /** Accesso diretto all'account DEMO, senza digitare credenziali. */
  async function entraNellaDemo() {
    setErrore('');
    setInvio(true);
    try {
      await accediComeProva();
      navigate('/', { replace: true });
    } catch (err) {
      setErrore(err.message);
      setSpiegazione(false);
    } finally {
      setInvio(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    accedi(email, password);
  }

  return (
    <div className="app senza-tabbar auth">
      {/* accesso al pannello di controllo: percorso separato da quello utente */}
      <AccessoAdmin />

      <TestaAuth attiva="accedi" />

      <form onSubmit={onSubmit}>
        <Errore testo={errore} />

        <label className="campo">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="campo">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            /* non obbligatoria: l'account DEMO entra con la sola email */
            required={email.trim().toLowerCase() !== UTENTE_DEMO}
          />
        </label>

        <button type="submit" className="btn btn-verde" disabled={invio}>
          {invio ? 'Accesso...' : 'Accedi'}
        </button>
      </form>

      <div className="separatore">oppure</div>

      {/* Il clic apre la spiegazione: si entra solo dopo averla letta. */}
      <button
        type="button"
        className="btn btn-bordo"
        onClick={() => setSpiegazione(true)}
        disabled={invio}
      >
        Entra con l’account DEMO
      </button>

      {spiegazione && (
        <Conferma
          titolo="Account DEMO"
          messaggio="Account demo per esplorare l’app senza registrarti. Ha già amici, chat e prenotazioni di esempio, così puoi provare tutto subito: non serve nessuna password e all’uscita torna com’era, quello che fai qui non resta."
          etichetta="Entra nella DEMO"
          etichettaAnnulla="Annulla"
          inCorso={invio}
          onConferma={entraNellaDemo}
          onAnnulla={() => setSpiegazione(false)}
        />
      )}

      <p className="nota">
        Non hai un account? <Link to="/registrati"><strong>Registrati</strong></Link>
      </p>
    </div>
  );
}
