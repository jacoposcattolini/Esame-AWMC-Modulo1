import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navigazione from '../components/Navigazione';
import { BarraRicerca, Campanella, Caricamento, Errore } from '../components/Ui';

export default function Home() {
  const navigate = useNavigate();
  const { utente } = useAuth();
  const [sport, setSport] = useState([]);
  const [cerca, setCerca] = useState('');
  const [nonLette, setNonLette] = useState(false);
  const [errore, setErrore] = useState('');
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    let vivo = true;
    Promise.all([api.get('/sports'), api.get('/notifications')])
      .then(([elenco, notifiche]) => {
        if (!vivo) return;
        setSport(elenco);
        setNonLette(notifiche.some((n) => !n.letta));
      })
      .catch((err) => vivo && setErrore(err.message))
      .finally(() => vivo && setCaricamento(false));
    return () => {
      vivo = false;
    };
  }, []);

  const filtrati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (!q) return sport;
    return sport.filter((s) => s.nome.toLowerCase().includes(q));
  }, [sport, cerca]);

  // l'account DEMO non e' di nessuno in particolare: il saluto resta generico
  const nome = utente && !utente.demo ? utente.nome.split(' ')[0] : 'Utente';

  return (
    <div className="app">
      <div className="home-top">
        <BarraRicerca valore={cerca} onChange={setCerca} placeholder="Cerca sport" />
        <Campanella nuove={nonLette} onClick={() => navigate('/notifiche')} />
      </div>

      <div className="contenuto">
        <div className="titolo-sezione">
          <h1>Ciao {nome}, scegli che sport fare oggi</h1>
          <p>Scegli uno sport e prenota un campo vicino a te.</p>
        </div>

        <Errore testo={errore} />
        {caricamento && <Caricamento />}

        <div className="griglia griglia-sport">
          {filtrati.map((s) => (
            <Link key={s.id} className="card-sport" to={`/sport/${s.slug}`}>
              <img src={s.immagine} alt={s.nome} loading="lazy" />
              <span>{s.nome}</span>
            </Link>
          ))}
        </div>

        {!caricamento && filtrati.length === 0 && <p className="stato-vuoto">Nessuno sport trovato.</p>}
      </div>

      <Navigazione nonLette={nonLette} />
    </div>
  );
}
