import { useNavigate } from 'react-router-dom';

/** Logo + cerchio + tab Accedi/Registrati (schermate di autenticazione). */
export default function TestaAuth({ attiva }) {
  const navigate = useNavigate();

  return (
    <>
      <img className="auth-logo" src="/img/logo.png" alt="SportEasy" />

      <div className="auth-tab">
        <button
          type="button"
          className={attiva === 'accedi' ? 'attivo' : ''}
          onClick={() => navigate('/accedi')}
        >
          Accedi
        </button>
        <button
          type="button"
          className={attiva === 'registrati' ? 'attivo' : ''}
          onClick={() => navigate('/registrati')}
        >
          Registrati
        </button>
      </div>
    </>
  );
}
