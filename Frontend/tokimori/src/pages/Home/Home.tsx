import { useEffect, useState, useRef } from 'react';
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
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'favorites' | 'pinned' | 'hours'>('all');
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Redirige a login si no está autenticado
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Cerrar menú de filtros al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
    };

    if (showFilterMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterMenu]);

  // Cargar la biblioteca del usuario
  useEffect(() => {
    if (isAuthenticated && user) {
      const loadLibraryData = async () => {
        try {
          setIsLoading(true);
          setError(null);
          const token = localStorage.getItem('auth_token');
          if (!token) {
            throw new Error('No se encontró el token de autenticación');
          }

          let userGames;
          
          switch (currentFilter) {
            case 'favorites':
              userGames = await gameLibraryService.getFavoriteGames(token, user.id.toString());
              break;
            case 'pinned':
              userGames = await gameLibraryService.getPinnedGames(token, user.id.toString());
              break;
            case 'hours':
              userGames = await gameLibraryService.getLibraryByHours(token, user.id.toString());
              break;
            case 'all':
            default:
              userGames = await gameLibraryService.getUserLibrary(token, user.id.toString());
              break;
          }
          
          setGames(userGames);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error al cargar la biblioteca');
          console.error('Error loading user library:', err);
        } finally {
          setIsLoading(false);
        }
      };

      loadLibraryData();
    }
  }, [isAuthenticated, user, currentFilter]);

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

  const handleTogglePinned = async (game: any) => {
    const token = localStorage.getItem('auth_token');
    if (!token || !game.idLibrary) return;

    try {
      setIsUpdating(game.idLibrary);
      const newPinnedStatus = !game.isPinned;
      
      // Actualizar el estado isPinned
      const updatedGames = games.map(g =>
        g.idLibrary === game.idLibrary
          ? { ...g, isPinned: newPinnedStatus }
          : g
      );
      
      // Reordenar inmediatamente
      const reorderedGames = updatedGames.sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return b.isPinned ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });
      
      setGames(reorderedGames);
      await gameLibraryService.updateGamePinned(token, game.idLibrary, newPinnedStatus);
    } catch (err) {
      // Revert optimistic update on error
      setGames(games.map(g =>
        g.idLibrary === game.idLibrary
          ? { ...g, isPinned: game.isPinned }
          : g
      ));
      console.error('Error toggling pinned status:', err);
      alert('Error al actualizar el estado de pinnear');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleToggleFavorite = async (game: any) => {
    const token = localStorage.getItem('auth_token');
    if (!token || !game.idLibrary) return;

    try {
      setIsUpdating(game.idLibrary);
      const newFavoriteStatus = !game.isFavorite;
      
      // Optimistic update
      setGames(games.map(g =>
        g.idLibrary === game.idLibrary
          ? { ...g, isFavorite: newFavoriteStatus }
          : g
      ));

      await gameLibraryService.updateGameFavorite(token, game.idLibrary, newFavoriteStatus);
    } catch (err) {
      // Revert optimistic update on error
      setGames(games.map(g =>
        g.idLibrary === game.idLibrary
          ? { ...g, isFavorite: game.isFavorite }
          : g
      ));
      console.error('Error toggling favorite status:', err);
      alert('Error al actualizar el estado de favorito');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeleteGame = async (game: any) => {
    const token = localStorage.getItem('auth_token');
    if (!token || !game.idLibrary) return;

    if (!window.confirm(`¿Estás seguro de que deseas eliminar "${game.name}" de tu biblioteca?`)) {
      return;
    }

    try {
      setIsUpdating(game.idLibrary);
      
      // Optimistic update
      setGames(games.filter(g => g.idLibrary !== game.idLibrary));

      await gameLibraryService.deleteFromLibrary(token, game.idLibrary);
    } catch (err) {
      // Revert optimistic update on error
      setGames([...games, game]);
      console.error('Error deleting game:', err);
      alert('Error al eliminar el juego de la biblioteca');
    } finally {
      setIsUpdating(null);
    }
  };

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
            <div style={{ position: 'relative' }} ref={filterMenuRef}>
              <button 
                className={styles.filterBtn} 
                title="Filtros"
                onClick={() => setShowFilterMenu(!showFilterMenu)}
              >
                🔍
              </button>
              {showFilterMenu && (
                <div className={styles.filterMenu}>
                  <button 
                    className={`${styles.filterOption} ${currentFilter === 'all' ? styles.active : ''}`}
                    onClick={() => {
                      setCurrentFilter('all');
                      setShowFilterMenu(false);
                    }}
                  >
                    Ver todos
                  </button>
                  <button 
                    className={`${styles.filterOption} ${currentFilter === 'favorites' ? styles.active : ''}`}
                    onClick={() => {
                      setCurrentFilter('favorites');
                      setShowFilterMenu(false);
                    }}
                  >
                    ⭐ Favoritos
                  </button>
                  <button 
                    className={`${styles.filterOption} ${currentFilter === 'pinned' ? styles.active : ''}`}
                    onClick={() => {
                      setCurrentFilter('pinned');
                      setShowFilterMenu(false);
                    }}
                  >
                    📌 Pinneados
                  </button>
                  <button 
                    className={`${styles.filterOption} ${currentFilter === 'hours' ? styles.active : ''}`}
                    onClick={() => {
                      setCurrentFilter('hours');
                      setShowFilterMenu(false);
                    }}
                  >
                    ⏱️ Por horas
                  </button>
                </div>
              )}
            </div>
            <button className={styles.createBtn} onClick={() => navigate('/create')}>
              Añadir juego
            </button>
          </div>

          <div className={styles.gameList}>
          {filteredGames.length > 0 ? (
            filteredGames.map((game, index) => {
              let cardClassName = styles.gameCard;
              if (game.isPinned && game.isFavorite) {
                cardClassName = `${styles.gameCard} ${styles.pinnedFavorite}`;
              } else if (game.isPinned) {
                cardClassName = `${styles.gameCard} ${styles.pinned}`;
              } else if (game.isFavorite) {
                cardClassName = `${styles.gameCard} ${styles.favorite}`;
              }
              
              return (
              <div key={game.idGames || game.id} className={cardClassName}>
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
                    className={`${styles.iconBtn} ${game.isPinned ? styles.active : ''}`}
                    title={game.isPinned ? 'Despinnear' : 'Pinnear'}
                    onClick={() => handleTogglePinned(game)}
                    disabled={isUpdating === game.idLibrary}
                  >
                    📌
                  </button>
                  <button 
                    className={`${styles.iconBtn} ${game.isFavorite ? styles.active : ''}`}
                    title={game.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                    onClick={() => handleToggleFavorite(game)}
                    disabled={isUpdating === game.idLibrary}
                  >
                    ⭐
                  </button>
                  <button 
                    className={styles.deleteBtn}
                    title="Eliminar"
                    onClick={() => handleDeleteGame(game)}
                    disabled={isUpdating === game.idLibrary}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
            })
          ) : (
            <div className={styles.emptyState}>
              <p>
                {searchTerm
                  ? 'No se encontraron juegos con ese nombre'
                  : 'No hay juegos en tu biblioteca'}
              </p>
              <p style={{ fontSize: '14px', marginTop: '10px' }}>
                ¡Añade juegos nuevos para comenzar!
              </p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};