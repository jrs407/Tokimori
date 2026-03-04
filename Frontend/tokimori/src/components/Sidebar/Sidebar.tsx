import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';

export const Sidebar = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

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
          <button
            className={styles.sidebarBtn}
            title="Configuración"
          >
            <span className={styles.icon}>⚡</span>
            {isExpanded && <span className={styles.label}>Configuración</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};
