import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import { CreateGameModal } from '../../components/CreateGameModal';
import { gameLibraryService } from '../../services/game-library.service';
import { authService } from '../../services/auth.service';
import styles from './AddGame.module.css';

interface Game {
  idGames?: number;
  name: string;
  img?: string;
}

export const AddGame = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const token = localStorage.getItem('auth_token') || '';

  const [games, setGames] = useState<Game[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addingGameId, setAddingGameId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch games not in library
  const fetchGamesNotInLibrary = useCallback(
    async (search: string = '') => {
      if (!user) return;

      setIsLoading(true);
      setError('');
      setSuccessMessage('');

      try {
        const result = await gameLibraryService.searchGamesNotInLibrary(
          token,
          user.id,
          search || '%'
        );
        setGames(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar los juegos');
        setGames([]);
      } finally {
        setIsLoading(false);
      }
    },
    [user, token]
  );

  // Initial load
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchGamesNotInLibrary();
  }, [isAuthenticated, navigate, fetchGamesNotInLibrary]);

  // Handle search
  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGamesNotInLibrary(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, fetchGamesNotInLibrary]);

  // Add game to library
  const handleAddToLibrary = async (gameId: number) => {
    if (!user) return;

    setAddingGameId(gameId);
    setError('');

    try {
      await gameLibraryService.addToLibrary(token, user.id, gameId);
      setSuccessMessage('Juego agregado a la biblioteca correctamente');
      
      // Remove from list
      setGames(games.filter(game => game.idGames !== gameId));
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar el juego');
    } finally {
      setAddingGameId(null);
    }
  };

  // Handle create game
  const handleCreateGame = async (name: string, image?: File) => {
    setError('');

    try {
      console.log('🎮 Creating game:', name);
      if (image) {
        console.log('📷 Image file:', image.name, '(' + (image.size / 1024).toFixed(2) + ' KB)');
      } else {
        console.log('📷 No image provided');
      }

      await gameLibraryService.createGame(token, name, image);
      console.log('✅ Game created successfully');
      setSuccessMessage('Juego creado correctamente');
      
      // Refresh the list
      await fetchGamesNotInLibrary(searchTerm);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('❌ Error:', err);
      throw err;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className={styles.mainLayout}>
      <Sidebar />
      
      <div className={styles.mainContent}>
        <div className={styles.contentContainer}>
          <h1 className={styles.pageTitle}>Añadir Juego</h1>

          {/* Messages */}
          {error && <div className={styles.errorMessage}>{error}</div>}
          {successMessage && <div className={styles.successMessage}>{successMessage}</div>}

          {/* Search and Create Button */}
          <div className={styles.controlsSection}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Buscar juego..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className={styles.searchInput}
                disabled={isLoading}
              />
              <svg
                className={styles.searchIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <button
              className={styles.createGameButton}
              onClick={() => setIsModalOpen(true)}
              disabled={isLoading}
            >
              + Crear Juego
            </button>
          </div>

          {/* Games List */}
          <div className={styles.gamesSection}>
            {isLoading && <div className={styles.loadingMessage}>Cargando juegos...</div>}
            
            {!isLoading && games.length === 0 && (
              <div className={styles.emptyState}>
                <p>
                  {searchTerm
                    ? 'No se encontraron juegos con ese nombre'
                    : 'Todos tus juegos están en la biblioteca'}
                </p>
                <p style={{ fontSize: '14px', marginTop: '10px' }}>
                  ¡Crea uno nuevo o busca otro!
                </p>
              </div>
            )}

            {!isLoading && games.length > 0 && (
              <div className={styles.gamesList}>
                {games.map((game) => (
                  <div key={game.idGames} className={styles.gameCard}>
                    {game.img && (
                      <img src={game.img} alt={game.name} className={styles.gameImage} />
                    )}
                    {!game.img && <div className={styles.gameImagePlaceholder}>No imagen</div>}
                    
                    <div className={styles.gameInfo}>
                      <h3 className={styles.gameName}>{game.name}</h3>
                    </div>

                    <div className={styles.spacer}></div>

                    <button
                      className={styles.addButton}
                      onClick={() => game.idGames && handleAddToLibrary(game.idGames)}
                      disabled={addingGameId === game.idGames}
                    >
                      {addingGameId === game.idGames ? 'Agregando...' : '+ Agregar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Game Modal */}
      <CreateGameModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateGame}
        isLoading={isLoading}
      />
    </div>
  );
};