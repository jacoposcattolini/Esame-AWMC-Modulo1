import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Errore } from '../components/Ui';
import TestaAuth from '../components/TestaAuth';

export default function Register() {
  const { registrati } = useAuth();
  const navigate = useNavigate();
  const [dati, setDati] = useState({ nome: '', email: '', password: '', confermaPassword: '' });
  const [errore, setErrore] = useState('');
  const [invio, setInvio] = useState(false);

  const aggiorna = (campo) => (e) => setDati((d) => ({ ...d, [campo]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setErrore('');

    if (dati.password !== dati.confermaPassword) {
      setErrore('Le password non coincidono');
      return;
    }

    setInvio(true);
    try {
      await registrati(dati);
      navigate('/', { replace: true });
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInvio(false);
    }
  }

  return (
    <div className="app senza-tabbar auth">
      <TestaAuth attiva="registrati" />

      <form onSubmit={onSubmit}>
        <Errore testo={errore} />

        <label className="campo">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input type="text" placeholder="Nome e cognome" autoComplete="name" value={dati.nome} onChange={aggiorna('nome')} required />
        </label>

        <label className="campo">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input type="email" placeholder="Indirizzo email" autoComplete="email" value={dati.email} onChange={aggiorna('email')} required />
        </label>

        <label className="campo">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <input type="password" placeholder="Password" autoComplete="new-password" minLength={6} value={dati.password} onChange={aggiorna('password')} required />
        </label>

        <label className="campo">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <input type="password" placeholder="Conferma Password" autoComplete="new-password" minLength={6} value={dati.confermaPassword} onChange={aggiorna('confermaPassword')} required />
        </label>

        <button type="submit" className="btn btn-verde" disabled={invio}>
          {invio ? 'Creazione...' : 'Registrati'}
        </button>
      </form>

      <p className="nota">
        Hai già un account? <Link to="/accedi"><strong>Accedi</strong></Link>
      </p>
    </div>
  );
}
