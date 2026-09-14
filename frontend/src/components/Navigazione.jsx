import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* Icone della navigazione: definite una volta sola e riusate
   sia dalla barra inferiore (mobile) sia dalla barra laterale (desktop). */
const ICONE = {
  home: (
    <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  ),
  amici: (
    <>
      <circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c2.2.6 3.5 2.3 3.5 5.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  swipe: (
    <path d="M12 1.5v21M1.5 12h21" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  ),
  post: (
    <path d="M3.5 5.5h17v11h-9l-5 4v-4h-3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  ),
  prenotazioni: (
    <>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6.5V12l3.5 2.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  notifiche: (
    <>
      <path d="M6 10a7 7 0 0 1 14 0c0 4 1.4 5.6 2 6.4H4c.6-.8 2-2.4 2-6.4Z"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10.6 20.2a2.8 2.8 0 0 0 4.8 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
};

/* Le voci con soloDesktop compaiono solo nella barra laterale:
   su telefono sono gia' raggiungibili dalla campanella e dal profilo. */
const VOCI = [
  { a: '/', etichetta: 'Home', icona: 'home', esatta: true },
  { a: '/amici', etichetta: 'Amici', icona: 'amici' },
  { a: '/swipe', etichetta: 'Swipe', icona: 'swipe' },
  { a: '/post', etichetta: 'Post', icona: 'post' },
  { a: '/prenotazioni', etichetta: 'Prenotazioni', icona: 'prenotazioni', soloDesktop: true },
  { a: '/notifiche', etichetta: 'Notifiche', icona: 'notifiche', soloDesktop: true },
];

/**
 * Navigazione principale dell'app.
 * Stesso markup per tutte le dimensioni: il CSS lo dispone come barra
 * inferiore sui telefoni e come barra laterale su tablet e desktop.
 */
export default function Navigazione({ nonLette = false }) {
  const { utente } = useAuth();
  const saldo = Number((utente && utente.saldo) || 0);

  return (
    <nav className="navigazione" aria-label="Navigazione principale">
      <NavLink to="/" className="nav-logo" aria-label="SportEasy - home">
        <img src="/img/logo.png" alt="SportEasy" />
      </NavLink>

      {VOCI.map((v) => (
        <NavLink
          key={v.a}
          to={v.a}
          end={v.esatta}
          className={`tab${v.soloDesktop ? ' solo-desktop' : ''}`}
        >
          <span className="tab-icona">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">{ICONE[v.icona]}</svg>
            {v.icona === 'notifiche' && nonLette && <span className="pallino" />}
          </span>
          <span>{v.etichetta}</span>
        </NavLink>
      ))}

      {/* saldo SportEasy: visibile solo nella barra laterale (vedi CSS) */}
      {utente && (
        <NavLink to="/profilo" className="nav-saldo" aria-label={`Saldo SportEasy: ${saldo.toFixed(2)} euro`}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <rect x="2.5" y="6" width="19" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M2.5 10.5h19" stroke="currentColor" strokeWidth="2" />
            <circle cx="17.5" cy="15" r="1.4" fill="currentColor" />
          </svg>
          <span>
            <small>Saldo SportEasy</small>
            <strong>{saldo.toFixed(2)} €</strong>
          </span>
        </NavLink>
      )}

      <NavLink to="/profilo" className="tab tab-profilo">
        <span className="tab-icona">
          <img src={(utente && utente.avatar) || '/img/avatar-lorenzo.jpg'} alt="" />
        </span>
        <span>{utente ? utente.nome.split(' ')[0] : 'Profilo'}</span>
      </NavLink>
    </nav>
  );
}
