import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import { gameLibraryService } from '../../services/game-library.service';
import styles from './Home.module.css';

export const Home = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [games, setGames] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirige a login si no está autenticado
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Cargar la biblioteca del usuario
  useEffect(() => {
    if (isAuthenticated && user) {
      const loadUserLibrary = async () => {
        try {
          setIsLoading(true);
          setError(null);
          const token = localStorage.getItem('auth_token');
          if (!token) {
            throw new Error('No se encontró el token de autenticación');
          }
          const userGames = await gameLibraryService.getUserLibrary(token, user.id.toString());
          setGames(userGames);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error al cargar la biblioteca');
          console.error('Error loading user library:', err);
        } finally {
          setIsLoading(false);
        }
      };

      loadUserLibrary();
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated || !user) {
    return (
      <div className={styles.container}>
        <p>Cargando...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.mainLayout}>
        <Sidebar />
        <div className={styles.mainContent}>
          <div className={styles.contentContainer}>
            <p>Cargando tu biblioteca...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.mainLayout}>
        <Sidebar />
        <div className={styles.mainContent}>
          <div className={styles.contentContainer}>
            <p>Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredGames = games.filter(game =>
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
          {filteredGames.length > 0 ? (
            filteredGames.map(game => (
              <div key={game.idGames || game.id} className={styles.gameCard}>
                <img 
                  src={game.img || '/gameImage/prueba.jpg'} 
                  alt={game.name}
                  className={styles.gameImage}
                />
                <h3 className={styles.gameName}>{game.name}</h3>
                {game.totalHours !== undefined && <p className={styles.gameHours}>{game.totalHours.toFixed(1)} horas</p>}
                <div className={styles.spacer}></div>
                <div className={styles.gameActions}>
                  <button 
                    className={`${styles.iconBtn}`}
                    title="Pinnear"
                  >
                    📌
                  </button>
                  <button 
                    className={`${styles.iconBtn}`}
                    title="Añadir a favoritos"
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
            ))
          ) : (
            <p>No hay juegos en tu biblioteca. ¡Añade algunos!</p>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};