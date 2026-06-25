import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './Sidebar.module.css';

const STORAGE_KEY = 'tokimori_sidebar_expanded';

export const Sidebar = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Persists across pages
  const [isExpanded, setIsExpanded] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
    catch { return false; }
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsConfigOpen(false);
  };

  const toggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
  };

  const toggleConfig = () => setIsConfigOpen(v => !v);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    if (!isConfigOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (configRef.current && !configRef.current.contains(e.target as Node))
        setIsConfigOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isConfigOpen]);

  return (
    <aside className={`${styles.sidebar} ${isExpanded ? styles.expanded : styles.collapsed}`}>
      <div className={styles.sidebarContent}>

        {/* TOP SECTION */}
        <div className={styles.topSection}>
          <button className={styles.sidebarBtn} onClick={toggleExpand}
            title={isExpanded ? 'Contraer' : 'Expandir'}>
            <span className={styles.icon}>{isExpanded ? '◀' : '▶'}</span>
            <span className={styles.label}>Expandir</span>
          </button>
          <button className={styles.sidebarBtn} onClick={() => handleNavigation('/home')} title="Inicio">
            <span className={styles.icon}>🏠</span>
            <span className={styles.label}>Inicio</span>
          </button>
          <button className={styles.sidebarBtn} onClick={() => handleNavigation('/create')} title="Crear">
            <span className={styles.icon}>➕</span>
            <span className={styles.label}>Añadir elemento</span>
          </button>
        </div>

        {/* MIDDLE SPACER */}
        <div className={styles.middleSection} />

        {/* BOTTOM SECTION */}
        <div className={styles.bottomSection}>
          <button className={styles.sidebarBtn} title="Estadísticas">
            <span className={styles.icon}>📊</span>
            <span className={styles.label}>Estadísticas</span>
          </button>
          <button className={styles.sidebarBtn} title="Ayuda">
            <span className={styles.icon}>❓</span>
            <span className={styles.label}>Ayuda</span>
          </button>

          {/* Config button with dropdown */}
          <div className={styles.configWrapper} ref={configRef}>
            <button className={`${styles.sidebarBtn} ${isConfigOpen ? styles.active : ''}`}
              onClick={toggleConfig} title="Configuración">
              <span className={styles.icon}>⚡</span>
              <span className={styles.label}>Configuración</span>
            </button>

            {isConfigOpen && (
              <div className={styles.dropdown}>
                <button className={styles.dropdownItem} onClick={() => handleNavigation('/settings')}>
                  <span className={styles.dropdownIcon}>⚙️</span>
                  <span>Configuración de la aplicación</span>
                </button>
                <button className={styles.dropdownItem} onClick={() => handleNavigation('/profile')}>
                  <span className={styles.dropdownIcon}>👤</span>
                  <span>Perfil</span>
                </button>
                <button className={styles.dropdownItem} onClick={handleLogout}>
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
