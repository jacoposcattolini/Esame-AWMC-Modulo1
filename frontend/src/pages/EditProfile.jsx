import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Errore, Intestazione } from '../components/Ui';
import Navigazione from '../components/Navigazione';
import { controllaFile, riduciImmagine } from '../immagini';

const AVATAR = [
  '/img/avatar-lorenzo.jpg',
  '/img/avatar-mario.jpg',
  '/img/avatar-franco.jpg',
  '/img/avatar-andrea.jpg',
  '/img/avatar-giacomo.jpg',
  '/img/avatar-alessandro.jpg',
  '/img/avatar-tommaso.jpg',
  '/img/avatar-jacopo.jpg',
];

/** Anni compiuti: l'eta' non si scrive a mano, si ricava dalla data di nascita. */
function etaDa(dataNascita) {
  if (!dataNascita) return null;
  const nascita = new Date(dataNascita);
  if (Number.isNaN(nascita.getTime())) return null;
  const oggi = new Date();
  let anni = oggi.getFullYear() - nascita.getFullYear();
  const compiuto =
    oggi.getMonth() > nascita.getMonth() ||
    (oggi.getMonth() === nascita.getMonth() && oggi.getDate() >= nascita.getDate());
  if (!compiuto) anni -= 1;
  return anni >= 0 && anni < 120 ? anni : null;
}

/** "Calcetto, Tennis" -> ['Calcetto', 'Tennis'] */
function comeElenco(testo) {
  return (testo || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function EditProfile() {
  const { utente, setUtente } = useAuth();
  const navigate = useNavigate();
  const [sportDisponibili, setSportDisponibili] = useState([]);
  const [dati, setDati] = useState({
    nome: utente.nome || '',
    bio: utente.bio || '',
    comune: utente.comune || '',
    sport: utente.sport || '',
    data_nascita: utente.data_nascita ? String(utente.data_nascita).slice(0, 10) : '',
    avatar: utente.avatar,
  });
  const [errore, setErrore] = useState('');
  const [invio, setInvio] = useState(false);
  // foto caricata dall'utente (galleria del telefono o file system del computer)
  const [foto, setFoto] = useState(
    String(utente.avatar || '').startsWith('data:') ? utente.avatar : ''
  );
  const selettoreFile = useRef(null);

  useEffect(() => {
    let vivo = true;
    api
      .get('/sports')
      .then((r) => vivo && setSportDisponibili(r))
      .catch(() => vivo && setSportDisponibili([]));
    return () => {
      vivo = false;
    };
  }, []);

  const sportScelti = useMemo(() => comeElenco(dati.sport), [dati.sport]);
  const eta = etaDa(dati.data_nascita);

  const aggiorna = (campo) => (e) => setDati((d) => ({ ...d, [campo]: e.target.value }));

    function alternaSport(nome) {
    setDati((d) => {
      const scelti = comeElenco(d.sport);
      const nuovi = scelti.includes(nome) ? scelti.filter((s) => s !== nome) : [...scelti, nome];
      return { ...d, sport: nuovi.join(', ') };
    });
  }

  /** Legge il file scelto, lo riduce e lo imposta come foto profilo. */
  async function scegliFoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // cosi' si puo' riscegliere lo stesso file
    if (!file) return;
    const problema = controllaFile(file);
    if (problema) {
      setErrore(problema);
      return;
    }
    try {
      const ridotta = await riduciImmagine(file);
      setFoto(ridotta);
      setDati((d) => ({ ...d, avatar: ridotta }));
      setErrore('');
    } catch (err) {
      setErrore(err.message);
    }
  }

  async function salva(e) {
    e.preventDefault();
    setInvio(true);
    setErrore('');
    try {
      // l'eta' non viene inviata: la ricalcola il backend dalla data di nascita
      const aggiornato = await api.put('/profile', dati);
      setUtente(aggiornato);
      navigate('/profilo', { replace: true });
    } catch (err) {
      setErrore(err.message);
      setInvio(false);
    }
  }

  return (
    <div className="app senza-tabbar">
      <Intestazione titolo="Modifica profilo" />

      <form className="contenuto modulo" onSubmit={salva}>
        <Errore testo={errore} />

        <div className="voce-modulo larga">
          <span className="etichetta">Foto profilo</span>
          <p className="aiuto">Carica una tua foto dalla galleria o dal computer, oppure scegli un’immagine fra quelle pronte.</p>
          <div className="scelta-avatar">
            <button
              type="button"
              className="avatar-opzione avatar-carica"
              onClick={() => selettoreFile.current && selettoreFile.current.click()}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M4 8.5h3.2l1.4-2.2h6.8l1.4 2.2H20a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z"
                      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <circle cx="12" cy="13.6" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <span>Carica</span>
            </button>

            <input
              ref={selettoreFile}
              type="file"
              accept="image/*"
              className="selettore-file"
              onChange={scegliFoto}
            />

            {foto && (
              <button
                type="button"
                className={`avatar-opzione${dati.avatar === foto ? ' scelto' : ''}`}
                aria-pressed={dati.avatar === foto}
                onClick={() => setDati((d) => ({ ...d, avatar: foto }))}
              >
                <img src={foto} alt="La foto che hai caricato" />
              </button>
            )}

            {AVATAR.map((a) => (
              <button
                key={a}
                type="button"
                className={`avatar-opzione${dati.avatar === a ? ' scelto' : ''}`}
                aria-pressed={dati.avatar === a}
                onClick={() => setDati((d) => ({ ...d, avatar: a }))}
              >
                <img src={a} alt="" />
              </button>
            ))}
          </div>
        </div>

        <div className="voce-modulo">
          <span className="etichetta">Nome</span>
          <label className="campo">
            <input type="text" value={dati.nome} onChange={aggiorna('nome')} required />
          </label>
        </div>

        <div className="voce-modulo">
          <span className="etichetta">Descrizione</span>
          <label className="campo campo-testo">
            <textarea rows={3} value={dati.bio} onChange={aggiorna('bio')} />
          </label>
        </div>

        <div className="voce-modulo larga">
          <span className="etichetta">Sport preferiti</span>
          <p className="aiuto">Tocca gli sport che pratichi: puoi sceglierne più di uno.</p>
          <div className="scelta-sport">
            {sportDisponibili.map((s) => {
              const scelto = sportScelti.includes(s.nome);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`sport-opzione${scelto ? ' scelto' : ''}`}
                  aria-pressed={scelto}
                  onClick={() => alternaSport(s.nome)}
                >
                  <img src={s.immagine} alt="" loading="lazy" />
                  <span>{s.nome}</span>
                  {scelto && <span className="spunta" aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="voce-modulo">
          <span className="etichetta">Comune di residenza</span>
          <label className="campo">
            <input type="text" value={dati.comune} onChange={aggiorna('comune')} />
          </label>
        </div>

        <div className="voce-modulo">
          <span className="etichetta">Data di nascita</span>
          <label className="campo">
            <input type="date" value={dati.data_nascita} onChange={aggiorna('data_nascita')} max="2020-12-31" />
          </label>
          <p className="aiuto">
            {eta === null
              ? 'Inserisci la data di nascita: l’età viene calcolata da sola.'
              : `Età calcolata automaticamente: ${eta} anni.`}
          </p>
        </div>

        <button type="submit" className="btn btn-pillola larghezza-piena" disabled={invio}>
          {invio ? 'Salvataggio...' : 'Salva'}
        </button>
      </form>
      <Navigazione />
    </div>
  );
}
