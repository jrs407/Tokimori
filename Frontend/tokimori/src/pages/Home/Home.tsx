import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import { itemCollectionService } from '../../services/game-library.service';
import styles from './Home.module.css';

export const Home = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'favorites' | 'pinned' | 'hours'>('all');
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

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

  useEffect(() => {
    if (isAuthenticated && user) {
      const loadCollectionData = async () => {
        try {
          setIsLoading(true);
          setError(null);
          const token = localStorage.getItem('auth_token');
          if (!token) {
            throw new Error('No se encontró el token de autenticación');
          }

          let userItems;

          switch (currentFilter) {
            case 'favorites':
              userItems = await itemCollectionService.getFavoriteItems(token, user.id.toString());
              break;
            case 'pinned':
              userItems = await itemCollectionService.getPinnedItems(token, user.id.toString());
              break;
            case 'hours':
              userItems = await itemCollectionService.getCollectionByHours(token, user.id.toString());
              break;
            case 'all':
            default:
              userItems = await itemCollectionService.getUserCollection(token, user.id.toString());
              break;
          }

          setItems(userItems);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error al cargar la colección');
          console.error('Error loading user collection:', err);
        } finally {
          setIsLoading(false);
        }
      };

      loadCollectionData();
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
            <p>Cargando tu colección...</p>
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

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTogglePinned = async (item: any) => {
    const token = localStorage.getItem('auth_token');
    if (!token || !item.idLibrary) return;

    try {
      setIsUpdating(item.idLibrary);
      const newPinnedStatus = !item.isPinned;

      const updatedItems = items.map(i =>
        i.idLibrary === item.idLibrary ? { ...i, isPinned: newPinnedStatus } : i
      );

      const reorderedItems = updatedItems.sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return b.isPinned ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });

      setItems(reorderedItems);
      await itemCollectionService.updateItemPinned(token, item.idLibrary, newPinnedStatus);
    } catch (err) {
      setItems(items.map(i =>
        i.idLibrary === item.idLibrary ? { ...i, isPinned: item.isPinned } : i
      ));
      console.error('Error toggling pinned status:', err);
      alert('Error al actualizar el estado de pinnear');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleToggleFavorite = async (item: any) => {
    const token = localStorage.getItem('auth_token');
    if (!token || !item.idLibrary) return;

    try {
      setIsUpdating(item.idLibrary);
      const newFavoriteStatus = !item.isFavorite;

      setItems(items.map(i =>
        i.idLibrary === item.idLibrary ? { ...i, isFavorite: newFavoriteStatus } : i
      ));

      await itemCollectionService.updateItemFavorite(token, item.idLibrary, newFavoriteStatus);
    } catch (err) {
      setItems(items.map(i =>
        i.idLibrary === item.idLibrary ? { ...i, isFavorite: item.isFavorite } : i
      ));
      console.error('Error toggling favorite status:', err);
      alert('Error al actualizar el estado de favorito');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeleteItem = async (item: any) => {
    const token = localStorage.getItem('auth_token');
    if (!token || !item.idLibrary) return;

    if (!window.confirm(`¿Estás seguro de que deseas eliminar "${item.name}" de tu colección?`)) {
      return;
    }

    try {
      setIsUpdating(item.idLibrary);

      setItems(items.filter(i => i.idLibrary !== item.idLibrary));

      await itemCollectionService.deleteFromCollection(token, item.idLibrary);
    } catch (err) {
      setItems([...items, item]);
      console.error('Error deleting item:', err);
      alert('Error al eliminar el elemento de la colección');
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className={styles.mainLayout}>
      <Sidebar />

      <div className={styles.mainContent}>
        <div className={styles.contentContainer}>
          <h1 className={styles.pageTitle}>Mi Colección</h1>

          <div className={styles.actionBar}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar elementos..."
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
              Añadir elemento
            </button>
          </div>

          <div className={styles.gameList}>
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                let cardClassName = styles.gameCard;
                if (item.isPinned && item.isFavorite) {
                  cardClassName = `${styles.gameCard} ${styles.pinnedFavorite}`;
                } else if (item.isPinned) {
                  cardClassName = `${styles.gameCard} ${styles.pinned}`;
                } else if (item.isFavorite) {
                  cardClassName = `${styles.gameCard} ${styles.favorite}`;
                }

                return (
                  <div
                    key={item.idGames || item.id}
                    className={cardClassName}
                    onClick={() => navigate(`/item/${item.idLibrary}`, { state: { itemName: item.name, itemImg: item.img } })}
                    style={{ cursor: 'pointer' }}
                  >
                    <img
                      src={item.img || '/itemImage/prueba.jpg'}
                      alt={item.name}
                      className={styles.gameImage}
                    />
                    <h3 className={styles.gameName}>{item.name}</h3>
                    {item.totalHours !== undefined && (
                      <p className={styles.gameHours}>{item.totalHours.toFixed(1)} horas</p>
                    )}
                    <div className={styles.spacer}></div>
                    <div className={styles.gameActions} onClick={e => e.stopPropagation()}>
                      <button
                        className={`${styles.iconBtn} ${item.isPinned ? styles.active : ''}`}
                        title={item.isPinned ? 'Despinnear' : 'Pinnear'}
                        onClick={() => handleTogglePinned(item)}
                        disabled={isUpdating === item.idLibrary}
                      >
                        📌
                      </button>
                      <button
                        className={`${styles.iconBtn} ${item.isFavorite ? styles.active : ''}`}
                        title={item.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                        onClick={() => handleToggleFavorite(item)}
                        disabled={isUpdating === item.idLibrary}
                      >
                        ⭐
                      </button>
                      <button
                        className={styles.deleteBtn}
                        title="Eliminar"
                        onClick={() => handleDeleteItem(item)}
                        disabled={isUpdating === item.idLibrary}
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
                    ? 'No se encontraron elementos con ese nombre'
                    : 'No hay elementos en tu colección'}
                </p>
                <p style={{ fontSize: '14px', marginTop: '10px' }}>
                  ¡Añade elementos nuevos para comenzar!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
