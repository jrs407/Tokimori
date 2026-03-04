import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './Sidebar.module.css';

export const Sidebar = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsConfigOpen(false);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleConfig = () => {
    setIsConfigOpen(!isConfigOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (configRef.current && !configRef.current.contains(event.target as Node)) {
        setIsConfigOpen(false);
      }
    };

    if (isConfigOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isConfigOpen]);

  return (
    <aside className={`${styles.sidebar} ${isExpanded ? styles.expanded : styles.collapsed}`}>
      <div className={styles.sidebarContent}>
        {/* TOP SECTION */}
        <div className={styles.topSection}>
          <button
            className={styles.sidebarBtn}
            onClick={toggleExpand}
            title={isExpanded ? 'Expandir' : 'Contraer'}
          >
            <span className={styles.icon}>{isExpanded ? '◀' : '▶'}</span>
            {isExpanded && <span className={styles.label}>Expandir</span>}
          </button>
          <button
            className={styles.sidebarBtn}
            onClick={() => handleNavigation('/home')}
            title="Inicio"
          >
            <span className={styles.icon}>🏠</span>
            {isExpanded && <span className={styles.label}>Inicio</span>}
          </button>
          <button
            className={styles.sidebarBtn}
            onClick={() => handleNavigation('/create')}
            title="Crear"
          >
            <span className={styles.icon}>➕</span>
            {isExpanded && <span className={styles.label}>Añadir juego</span>}
          </button>
        </div>

        {/* MIDDLE SPACER */}
        <div className={styles.middleSection}></div>

        {/* BOTTOM SECTION */}
        <div className={styles.bottomSection}>
          <button
            className={styles.sidebarBtn}
            title="Estadísticas"
          >
            <span className={styles.icon}>📊</span>
            {isExpanded && <span className={styles.label}>Estadísticas</span>}
          </button>
          <button
            className={styles.sidebarBtn}
            title="Ayuda"
          >
            <span className={styles.icon}>❓</span>
            {isExpanded && <span className={styles.label}>Ayuda</span>}
          </button>
          
          {/* Config button with dropdown */}
          <div className={styles.configWrapper} ref={configRef}>
            <button
              className={`${styles.sidebarBtn} ${isConfigOpen ? styles.active : ''}`}
              onClick={toggleConfig}
              title="Configuración"
            >
              <span className={styles.icon}>⚡</span>
              {isExpanded && <span className={styles.label}>Configuración</span>}
            </button>
            
            {/* Dropdown menu */}
            {isConfigOpen && (
              <div className={styles.dropdown}>
                <button
                  className={styles.dropdownItem}
                  onClick={() => handleNavigation('/settings')}
                >
                  <span className={styles.dropdownIcon}>⚙️</span>
                  <span>Configuración de la aplicación</span>
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={() => handleNavigation('/profile')}
                >
                  <span className={styles.dropdownIcon}>👤</span>
                  <span>Perfil</span>
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={handleLogout}
                >
                  <span className={styles.dropdownIcon}>🚪</span>
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
