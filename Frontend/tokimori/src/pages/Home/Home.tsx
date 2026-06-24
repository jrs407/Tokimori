import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import { itemCollectionService, type Item } from '../../services/game-library.service';
import styles from './Home.module.css';

type CollectionFilter = 'all' | 'favorites' | 'pinned' | 'hours';

export const Home = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [currentFilter, setCurrentFilter] = useState<CollectionFilter>('all');

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('auth_token');
        if (!token) throw new Error('No se encontró el token de autenticación');

        let result: Item[];
        switch (currentFilter) {
          case 'favorites':
            result = await itemCollectionService.getFavoriteItems(token, user.id.toString());
            break;
          case 'pinned':
            result = await itemCollectionService.getPinnedItems(token, user.id.toString());
            break;
          case 'hours':
            result = await itemCollectionService.getCollectionByHours(token, user.id.toString());
            break;
          default:
            result = await itemCollectionService.getUserCollection(token, user.id.toString());
        }
        setItems(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar la colección');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isAuthenticated, user, currentFilter]);

  const filteredItems = useMemo(
    () => items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [items, searchTerm]
  );

  const handleTogglePinned = async (item: Item) => {
    const token = localStorage.getItem('auth_token');
    if (!token || !item.idLibrary) return;
    try {
      setIsUpdating(item.idLibrary);
      const newVal = !item.isPinned;
      const updated = items
        .map(i => i.idLibrary === item.idLibrary ? { ...i, isPinned: newVal } : i)
        .sort((a, b) => {
          if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return Boolean(b.isPinned) ? 1 : -1;
          return a.name.localeCompare(b.name);
        });
      setItems(updated);
      await itemCollectionService.updateItemPinned(token, item.idLibrary, Boolean(newVal));
    } catch {
      setItems(items.map(i => i.idLibrary === item.idLibrary ? { ...i, isPinned: item.isPinned } : i));
    } finally {
      setIsUpdating(null);
    }
  };

  const handleToggleFavorite = async (item: Item) => {
    const token = localStorage.getItem('auth_token');
    if (!token || !item.idLibrary) return;
    try {
      setIsUpdating(item.idLibrary);
      const newVal = !item.isFavorite;
      setItems(items.map(i => i.idLibrary === item.idLibrary ? { ...i, isFavorite: newVal } : i));
      await itemCollectionService.updateItemFavorite(token, item.idLibrary, Boolean(newVal));
    } catch {
      setItems(items.map(i => i.idLibrary === item.idLibrary ? { ...i, isFavorite: item.isFavorite } : i));
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeleteItem = async (item: Item) => {
    const token = localStorage.getItem('auth_token');
    if (!token || !item.idLibrary) return;
    if (!window.confirm(`¿Eliminar "${item.name}" de tu colección?`)) return;
    try {
      setIsUpdating(item.idLibrary);
      setItems(items.filter(i => i.idLibrary !== item.idLibrary));
      await itemCollectionService.deleteFromCollection(token, item.idLibrary);
    } catch {
      setItems([...items, item]);
    } finally {
      setIsUpdating(null);
    }
  };

  if (!isAuthenticated || !user) return <div className={styles.container}><p>Cargando...</p></div>;

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
              onChange={e => setSearchTerm(e.target.value)}
            />
            <button className={styles.createBtn} onClick={() => navigate('/create')}>
              Añadir elemento
            </button>
          </div>

          <div className={styles.filterBar}>
            {(['all', 'favorites', 'pinned', 'hours'] as CollectionFilter[]).map(f => (
              <button
                key={f}
                className={`${styles.filterPill} ${currentFilter === f ? styles.activePill : ''}`}
                onClick={() => setCurrentFilter(f)}
              >
                {f === 'all' && 'Todos'}
                {f === 'favorites' && '⭐ Favoritos'}
                {f === 'pinned' && '📌 Fijados'}
                {f === 'hours' && '⏱️ Por horas'}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className={styles.emptyState}><p>Cargando tu colección...</p></div>
          ) : error ? (
            <div className={styles.emptyState}><p>Error: {error}</p></div>
          ) : (
            <div className={styles.gameList}>
              {filteredItems.length > 0 ? filteredItems.map(item => {
                let cardClass = styles.gameCard;
                if (item.isPinned && item.isFavorite) cardClass += ' ' + styles.pinnedFavorite;
                else if (item.isPinned) cardClass += ' ' + styles.pinned;
                else if (item.isFavorite) cardClass += ' ' + styles.favorite;

                return (
                  <div
                    key={item.idGames ?? item.idLibrary}
                    className={cardClass}
                    onClick={() => navigate(`/item/${item.idLibrary}`, {
                      state: { itemName: item.name, itemImg: item.img, idGame: item.idGames, totalHours: item.totalHours }
                    })}
                  >
                    <img
                      src={item.img ?? '/gameImage/prueba.jpg'}
                      alt={item.name}
                      className={styles.gameImage}
                    />
                    <h3 className={styles.gameName}>{item.name}</h3>
                    {item.totalHours !== undefined && (
                      <p className={styles.gameHours}>{item.totalHours.toFixed(1)} horas</p>
                    )}
                    <div className={styles.spacer} />
                    <div className={styles.gameActions} onClick={e => e.stopPropagation()}>
                      <button
                        className={`${styles.iconBtn} ${item.isPinned ? styles.active : ''}`}
                        title={item.isPinned ? 'Despinnear' : 'Pinnear'}
                        onClick={() => handleTogglePinned(item)}
                        disabled={isUpdating === item.idLibrary}
                      >📌</button>
                      <button
                        className={`${styles.iconBtn} ${item.isFavorite ? styles.active : ''}`}
                        title={item.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                        onClick={() => handleToggleFavorite(item)}
                        disabled={isUpdating === item.idLibrary}
                      >⭐</button>
                      <button
                        className={styles.deleteBtn}
                        title="Eliminar"
                        onClick={() => handleDeleteItem(item)}
                        disabled={isUpdating === item.idLibrary}
                      >🗑️</button>
                    </div>
                  </div>
                );
              }) : (
                <div className={styles.emptyState}>
                  <p>{searchTerm ? 'No se encontraron elementos con ese nombre' : 'No hay elementos en tu colección'}</p>
                  <p style={{ fontSize: '14px', marginTop: '10px' }}>¡Añade elementos nuevos para comenzar!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
