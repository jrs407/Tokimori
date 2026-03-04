import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import styles from './AddGame.module.css';

export const AddGame = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Redirige a login si no está autenticado
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

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
          {/* Contenido de la página se implementará más adelante */}
        </div>
      </div>
    </div>
  );
};