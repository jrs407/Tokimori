import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import { CreateItemModal } from '../../components/CreateGameModal';
import { itemCollectionService } from '../../services/game-library.service';
import styles from './AddGame.module.css';

interface Item {
  idGames?: number;
  name: string;
  img?: string;
}

export const AddItem = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const token = localStorage.getItem('auth_token') || '';

  const [items, setItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const fetchItemsNotInCollection = useCallback(
    async (search: string = '') => {
      if (!user) return;

      setIsLoading(true);
      setError('');
      setSuccessMessage('');

      try {
        const result = await itemCollectionService.searchItemsNotInCollection(
          token,
          user.id,
          search || '%'
        );
        setItems(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar los elementos');
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    },
    [user, token]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchItemsNotInCollection();
  }, [isAuthenticated, navigate, fetchItemsNotInCollection]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItemsNotInCollection(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, fetchItemsNotInCollection]);

  const handleAddToCollection = async (itemId: number) => {
    if (!user) return;

    setAddingItemId(itemId);
    setError('');

    try {
      await itemCollectionService.addToCollection(token, user.id, itemId);
      setSuccessMessage('Elemento agregado a la colección correctamente');

      setItems(items.filter(item => item.idGames !== itemId));

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar el elemento');
    } finally {
      setAddingItemId(null);
    }
  };

  const handleCreateItem = async (name: string, image?: File) => {
    setError('');

    try {
      await itemCollectionService.createItem(token, name, image);
      setSuccessMessage('Elemento creado correctamente');

      await fetchItemsNotInCollection(searchTerm);

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
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
          <h1 className={styles.pageTitle}>Añadir Elemento</h1>

          {error && <div className={styles.errorMessage}>{error}</div>}
          {successMessage && <div className={styles.successMessage}>{successMessage}</div>}

          <div className={styles.controlsSection}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Buscar elemento..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className={styles.searchInput}
                disabled={isLoading}
                autoFocus
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
              + Crear Elemento
            </button>
          </div>

          <div className={styles.gamesSection}>
            {isLoading && <div className={styles.loadingMessage}>Cargando elementos...</div>}

            {!isLoading && items.length === 0 && (
              <div className={styles.emptyState}>
                <p>
                  {searchTerm
                    ? 'No se encontraron elementos con ese nombre'
                    : 'Todos tus elementos están en la colección'}
                </p>
                <p style={{ fontSize: '14px', marginTop: '10px' }}>
                  ¡Crea uno nuevo o busca otro!
                </p>
              </div>
            )}

            {!isLoading && items.length > 0 && (
              <div className={styles.gamesList}>
                {items.map((item) => (
                  <div
                    key={item.idGames}
                    className={styles.gameCard}
                    onClick={() => item.idGames && handleAddToCollection(item.idGames)}
                    style={{ cursor: 'pointer' }}
                  >
                    {item.img && (
                      <img src={item.img} alt={item.name} className={styles.gameImage} />
                    )}
                    {!item.img && <div className={styles.gameImagePlaceholder}>Sin imagen</div>}

                    <div className={styles.gameInfo}>
                      <h3 className={styles.gameName}>{item.name}</h3>
                    </div>

                    <div className={styles.spacer}></div>

                    <button
                      className={styles.addButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        item.idGames && handleAddToCollection(item.idGames);
                      }}
                      disabled={addingItemId === item.idGames}
                    >
                      {addingItemId === item.idGames ? 'Agregando...' : '+ Agregar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateItemModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateItem}
        isLoading={isLoading}
      />
    </div>
  );
};
