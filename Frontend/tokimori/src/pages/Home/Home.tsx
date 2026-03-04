import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import styles from './Home.module.css';

export const Home = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

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

  return (
    <div className={styles.mainLayout}>
      <Sidebar />
      
      <div className={styles.mainContent}>
        <h1>Bienvenido, {user.name}</h1>
        
        <div className={styles.userCard}>
          <h2>Información de tu cuenta</h2>
          <div className={styles.userInfo}>
            <p>
              <strong>ID:</strong> <span>{user.id}</span>
            </p>
            <p>
              <strong>Nombre:</strong> <span>{user.name}</span>
            </p>
            <p>
              <strong>Email:</strong> <span>{user.email}</span>
            </p>
            <p>
              <strong>Admin:</strong> <span>{user.isAdmin ? 'Sí' : 'No'}</span>
            </p>
            <p>
              <strong>Público:</strong> <span>{user.isPublic ? 'Sí' : 'No'}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};