import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import SportVenues from './pages/SportVenues';
import VenueDetail from './pages/VenueDetail';
import Payment from './pages/Payment';
import BookingDone from './pages/BookingDone';
import Bookings from './pages/Bookings';
import Notifications from './pages/Notifications';
import Friends from './pages/Friends';
import Chat from './pages/Chat';
import UserProfile from './pages/UserProfile';
import Swipe from './pages/Swipe';
import Posts from './pages/Posts';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import PaymentMethods from './pages/PaymentMethods';
import JoinPayment from './pages/JoinPayment';

// Sezione di amministrazione: stesse rotte del sito, ma raggiungibili solo
// con la sessione admin (form di accesso dedicato nella schermata Accedi).
import AdminDashboard from './pages/admin/Dashboard';
import AdminPrenotazioni from './pages/admin/Prenotazioni';
import AdminUtenti from './pages/admin/Utenti';
import AdminPost from './pages/admin/Post';
import AdminCampi from './pages/admin/Campi';

/** Schermata di attesa mentre si controllano i token salvati. */
function Attesa() {
  return (
    <div className="schermo-caricamento">
      <img src="/img/logo.png" alt="SportEasy" />
    </div>
  );
}

/** Protegge le rotte che richiedono il login. */
function Privata({ children }) {
  const { utente, admin, caricamento } = useAuth();
  const posizione = useLocation();

  if (caricamento) return <Attesa />;
  // chi e' entrato come amministratore resta nel pannello: le schermate
  // dell'app (home, swipe, chat) presuppongono un account utente
  if (!utente && admin) return <Navigate to="/admin" replace />;
  if (!utente) return <Navigate to="/accedi" replace state={{ da: posizione.pathname }} />;
  return children;
}

/**
 * Protegge il pannello di controllo. E' la comodita' di navigazione: la
 * sicurezza vera sta sul server, dove ogni rotta /api/admin/* pretende il
 * token dell'amministratore.
 */
function SoloAdmin({ children }) {
  const { admin, caricamento } = useAuth();

  if (caricamento) return <Attesa />;
  if (!admin) return <Navigate to="/accedi" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/accedi" element={<Login />} />
      <Route path="/registrati" element={<Register />} />

      <Route path="/" element={<Privata><Home /></Privata>} />
      <Route path="/sport/:slug" element={<Privata><SportVenues /></Privata>} />
      <Route path="/campo/:id" element={<Privata><VenueDetail /></Privata>} />
      <Route path="/pagamento/:id" element={<Privata><Payment /></Privata>} />
      <Route path="/partecipa/:id" element={<Privata><JoinPayment /></Privata>} />
      <Route path="/prenotazione-effettuata/:id" element={<Privata><BookingDone /></Privata>} />
      <Route path="/prenotazioni" element={<Privata><Bookings /></Privata>} />
      <Route path="/notifiche" element={<Privata><Notifications /></Privata>} />
      <Route path="/amici" element={<Privata><Friends /></Privata>} />
      <Route path="/chat/utente/:id" element={<Privata><Chat tipo="utente" /></Privata>} />
      <Route path="/chat/gruppo/:id" element={<Privata><Chat tipo="gruppo" /></Privata>} />
      <Route path="/utente/:id" element={<Privata><UserProfile /></Privata>} />
      <Route path="/swipe" element={<Privata><Swipe /></Privata>} />
      <Route path="/post" element={<Privata><Posts /></Privata>} />
      <Route path="/profilo" element={<Privata><Profile /></Privata>} />
      <Route path="/profilo/modifica" element={<Privata><EditProfile /></Privata>} />
      <Route path="/profilo/pagamenti" element={<Privata><PaymentMethods /></Privata>} />

      {/* ------------------------- PANNELLO ADMIN ------------------------- */}
      <Route path="/admin" element={<SoloAdmin><AdminDashboard /></SoloAdmin>} />
      <Route path="/admin/prenotazioni" element={<SoloAdmin><AdminPrenotazioni /></SoloAdmin>} />
      <Route path="/admin/utenti" element={<SoloAdmin><AdminUtenti /></SoloAdmin>} />
      <Route path="/admin/post" element={<SoloAdmin><AdminPost /></SoloAdmin>} />
      <Route path="/admin/campi" element={<SoloAdmin><AdminCampi /></SoloAdmin>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
