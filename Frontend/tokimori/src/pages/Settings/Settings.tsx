import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import {
  settingsStorage,
  applyAccentColor,
  applyReduceAnimations,
  ACCENT_PRESETS,
  DEFAULTS,
  type AppSettings,
} from '../../services/settings.storage';
import styles from './Settings.module.css';

type Section = 'appearance' | 'notifications';

export const Settings = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  const [settings, setSettings] = useState<AppSettings>(() => settingsStorage.get());
  const [activeSection, setActiveSection] = useState<Section>('appearance');
  const [saved, setSaved] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    () => ('Notification' in window ? Notification.permission : 'denied')
  );

  const update = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    settingsStorage.set(patch);
    if (patch.accentColor !== undefined) applyAccentColor(next.accentColor, next.accentHover);
    if (patch.reduceAnimations !== undefined) applyReduceAnimations(next.reduceAnimations);
    showSaved();
  };

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    settingsStorage.reset();
    const d = { ...DEFAULTS };
    setSettings(d);
    applyAccentColor(d.accentColor, d.accentHover);
    applyReduceAnimations(d.reduceAnimations);
    showSaved();
  };

  const handleNotifToggle = async () => {
    if (!('Notification' in window)) return;

    if (!settings.timerNotifications) {
      // Turning ON: request permission if not granted
      if (notifPermission !== 'granted') {
        const result = await Notification.requestPermission();
        setNotifPermission(result);
        if (result !== 'granted') return; // user denied
      }
      update({ timerNotifications: true });
    } else {
      update({ timerNotifications: false });
    }
  };

  const notifSupported = 'Notification' in window;
  const notifBlocked = notifPermission === 'denied';

  if (!isAuthenticated) return null;

  return (
    <div className={styles.mainLayout}>
      <Sidebar />
      <main className={styles.mainContent}>
        <div className={styles.contentContainer}>

          {/* ── Page header ── */}
          <div className={styles.pageHeader}>
            <div className={styles.headerIcon}>⚙️</div>
            <div>
              <h1 className={styles.pageTitle}>Configuración</h1>
              <p className={styles.pageSubtitle}>Personaliza la aplicación a tu gusto</p>
            </div>
          </div>

          {/* ── Section tabs ── */}
          <div className={styles.sectionTabs}>
            {([
              ['appearance',    '🎨 Apariencia'],
              ['notifications', '🔔 Notificaciones'],
            ] as [Section, string][]).map(([key, label]) => (
              <button
                key={key}
                className={`${styles.sectionTab} ${activeSection === key ? styles.activeTab : ''}`}
                onClick={() => setActiveSection(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Appearance ── */}
          {activeSection === 'appearance' && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Apariencia</h2>

              {/* Accent color */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Color de acento</label>
                <p className={styles.hint}>Color principal de la interfaz. El cambio se aplica al instante.</p>
                <div className={styles.colorGrid}>
                  {ACCENT_PRESETS.map(preset => (
                    <button
                      key={preset.accent}
                      className={`${styles.colorSwatch} ${settings.accentColor === preset.accent ? styles.colorSwatchActive : ''}`}
                      style={{ '--swatch-color': preset.accent } as React.CSSProperties}
                      onClick={() => update({ accentColor: preset.accent, accentHover: preset.hover })}
                      title={preset.label}
                    >
                      <span className={styles.colorLabel}>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reduce animations */}
              <div className={styles.fieldGroup}>
                <div className={styles.toggleRow}>
                  <div>
                    <label className={styles.label}>Reducir animaciones</label>
                    <p className={styles.hint}>Desactiva transiciones y efectos visuales de la app. Recomendado si experimentas mareo o prefieres una interfaz más estática.</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={settings.reduceAnimations}
                    className={`${styles.toggle} ${settings.reduceAnimations ? styles.toggleOn : ''}`}
                    onClick={() => update({ reduceAnimations: !settings.reduceAnimations })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {activeSection === 'notifications' && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Notificaciones</h2>

              <div className={styles.fieldGroup}>
                <div className={styles.toggleRow}>
                  <div>
                    <label className={styles.label}>Aviso al terminar el temporizador</label>
                    <p className={styles.hint}>
                      Muestra una notificación del sistema cuando el temporizador de una sesión llega a cero, aunque tengas la app en segundo plano.
                    </p>
                    {!notifSupported && (
                      <p className={styles.warningText}>Tu navegador no soporta notificaciones.</p>
                    )}
                    {notifSupported && notifBlocked && (
                      <p className={styles.warningText}>
                        Has bloqueado las notificaciones para esta página. Permítelas desde la configuración del navegador para activar esta opción.
                      </p>
                    )}
                  </div>
                  <button
                    role="switch"
                    aria-checked={settings.timerNotifications}
                    className={`${styles.toggle} ${settings.timerNotifications ? styles.toggleOn : ''}`}
                    onClick={handleNotifToggle}
                    disabled={!notifSupported || notifBlocked}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          <div className={styles.footer}>
            {saved && <span className={styles.savedBadge}>✓ Guardado</span>}
            <button className={styles.resetBtn} onClick={handleReset}>
              Restablecer valores predeterminados
            </button>
          </div>

        </div>
      </main>
    </div>
  );
};
