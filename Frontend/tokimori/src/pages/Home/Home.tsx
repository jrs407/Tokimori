import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import styles from './Home.module.css';

// Placeholder games data
const placeholderGames = [
  { id: 1, name: 'The Witcher 3', img: '/gameImage/prueba.jpg', totalHours: 45.5, isPinned: true, isFavorite: true },
  { id: 2, name: 'Cyberpunk 2077', img: '/gameImage/prueba.jpg', totalHours: 23.0, isPinned: false, isFavorite: true },
  { id: 3, name: 'Elden Ring', img: '/gameImage/prueba.jpg', totalHours: 67.2, isPinned: true, isFavorite: false },
  { id: 4, name: 'Baldur\'s Gate 3', img: '/gameImage/prueba.jpg', totalHours: 102.5, isPinned: false, isFavorite: false },
  { id: 5, name: 'Hades', img: '/gameImage/prueba.jpg', totalHours: 18.3, isPinned: false, isFavorite: true },
  { id: 6, name: 'Hollow Knight', img: '/gameImage/prueba.jpg', totalHours: 34.7, isPinned: true, isFavorite: false },
];

export const Home = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Redirige a login si no está autenticado
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated || !user) {
    return (
      <div className={styles.container}>
        <p>Cargando...</p>
      </div>
    );
  }

  const filteredGames = placeholderGames.filter(game =>
    game.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.mainLayout}>
      <Sidebar />
      
      <div className={styles.mainContent}>
        <div className={styles.contentContainer}>
          <h1 className={styles.pageTitle}>Lista de juegos</h1>
          
          <div className={styles.actionBar}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar juegos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className={styles.filterBtn} title="Filtros">
              🔍
            </button>
            <button className={styles.createBtn} onClick={() => navigate('/create')}>
              Añadir juego
            </button>
          </div>

          <div className={styles.gameList}>
          {filteredGames.map(game => (
            <div key={game.id} className={styles.gameCard}>
              <img 
                src={game.img} 
                alt={game.name}
                className={styles.gameImage}
              />
              <h3 className={styles.gameName}>{game.name}</h3>
              <p className={styles.gameHours}>{game.totalHours.toFixed(1)} horas</p>
              <div className={styles.spacer}></div>
              <div className={styles.gameActions}>
                <button 
                  className={`${styles.iconBtn} ${game.isPinned ? styles.active : ''}`}
                  title={game.isPinned ? 'Despinnear' : 'Pinnear'}
                >
                  📌
                </button>
                <button 
                  className={`${styles.iconBtn} ${game.isFavorite ? styles.active : ''}`}
                  title={game.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                >
                  ⭐
                </button>
                <button 
                  className={styles.deleteBtn}
                  title="Eliminar"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
};