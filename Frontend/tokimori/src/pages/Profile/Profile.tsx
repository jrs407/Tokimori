import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import styles from './Profile.module.css';

type Section = 'info' | 'password' | 'danger';

interface Feedback {
  type: 'success' | 'error';
  message: string;
}

export const Profile = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateProfile, changePassword, deleteAccount, logout } = useAuth();

  // Redirect if not logged in
  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  // ── Info section state ──
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [isPublic, setIsPublic] = useState(user?.isPublic ?? true);
  const [infoFeedback, setInfoFeedback] = useState<Feedback | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  // Sync when user object changes
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setIsPublic(user.isPublic);
    }
  }, [user]);

  // ── Password section state ──
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdFeedback, setPwdFeedback] = useState<Feedback | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  // ── Danger section state ──
  const [dangerFeedback, setDangerFeedback] = useState<Feedback | null>(null);
  const [dangerLoading, setDangerLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);

  // ── Active section (accordion on mobile, always visible on desktop) ──
  const [activeSection, setActiveSection] = useState<Section>('info');

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  // ── Handlers ──
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setInfoLoading(true);
    setInfoFeedback(null);
    try {
      const updates: { name?: string; email?: string; isPublic?: boolean } = {};
      if (name.trim() && name.trim() !== user.name) updates.name = name.trim();
      if (email.trim() && email.trim() !== user.email) updates.email = email.trim();
      if (isPublic !== user.isPublic) updates.isPublic = isPublic;
      if (Object.keys(updates).length === 0) {
        setInfoFeedback({ type: 'error', message: 'No hay cambios que guardar.' });
        return;
      }
      await updateProfile(updates);
      setInfoFeedback({ type: 'success', message: 'Perfil actualizado correctamente.' });
    } catch (err) {
      setInfoFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Error al actualizar' });
    } finally {
      setInfoLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdFeedback(null);
    if (!currentPwd) {
      setPwdFeedback({ type: 'error', message: 'Introduce tu contraseña actual.' });
      return;
    }
    if (newPwd.length < 8) {
      setPwdFeedback({ type: 'error', message: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdFeedback({ type: 'error', message: 'Las contraseñas nuevas no coinciden.' });
      return;
    }
    setPwdLoading(true);
    try {
      await changePassword(currentPwd, newPwd);
      setPwdFeedback({ type: 'success', message: 'Contraseña cambiada correctamente.' });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err) {
      setPwdFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Error al cambiar la contraseña' });
    } finally {
      setPwdLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.name) {
      setDangerFeedback({ type: 'error', message: 'El nombre no coincide. Escribe tu nombre exacto para confirmar.' });
      return;
    }
    setDangerLoading(true);
    setDangerFeedback(null);
    try {
      await deleteAccount();
      logout();
      navigate('/login');
    } catch (err) {
      setDangerFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Error al eliminar la cuenta' });
      setDangerLoading(false);
    }
  };

  if (!isAuthenticated || !user) return null;

  return (
    <div className={styles.mainLayout}>
      <Sidebar />
      <main className={styles.mainContent}>
        <div className={styles.contentContainer}>

          {/* ── Profile header ── */}
          <div className={styles.profileHeader}>
            <div className={styles.avatarCircle}>{initials}</div>
            <div className={styles.profileMeta}>
              <h1 className={styles.profileName}>{user.name}</h1>
              <p className={styles.profileEmail}>{user.email}</p>
              <div className={styles.profileBadges}>
                {user.isAdmin && <span className={styles.badge + ' ' + styles.badgeAdmin}>Admin</span>}
                <span className={styles.badge + ' ' + (user.isPublic ? styles.badgePublic : styles.badgePrivate)}>
                  {user.isPublic ? 'Perfil público' : 'Perfil privado'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Section tabs ── */}
          <div className={styles.sectionTabs}>
            {(['info', 'password', 'danger'] as Section[]).map(s => (
              <button
                key={s}
                className={`${styles.sectionTab} ${activeSection === s ? styles.activeTab : ''} ${s === 'danger' ? styles.dangerTab : ''}`}
                onClick={() => setActiveSection(s)}
              >
                {s === 'info' && '👤 Información'}
                {s === 'password' && '🔒 Contraseña'}
                {s === 'danger' && '⚠️ Cuenta'}
              </button>
            ))}
          </div>

          {/* ── Info section ── */}
          {activeSection === 'info' && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Información personal</h2>
              <form onSubmit={handleSaveInfo} className={styles.form}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Nombre</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Tu nombre"
                    required
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Email</label>
                  <input
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Visibilidad del perfil</label>
                  <div className={styles.toggleRow}>
                    <button
                      type="button"
                      className={`${styles.toggleBtn} ${isPublic ? styles.toggleActive : ''}`}
                      onClick={() => setIsPublic(true)}
                    >
                      Público
                    </button>
                    <button
                      type="button"
                      className={`${styles.toggleBtn} ${!isPublic ? styles.toggleActive : ''}`}
                      onClick={() => setIsPublic(false)}
                    >
                      Privado
                    </button>
                  </div>
                  <p className={styles.hint}>
                    {isPublic
                      ? 'Tu perfil puede ser visto por otros usuarios.'
                      : 'Tu perfil solo es visible para ti.'}
                  </p>
                </div>

                {infoFeedback && (
                  <div className={`${styles.feedback} ${infoFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError}`}>
                    {infoFeedback.message}
                  </div>
                )}

                <button type="submit" className={styles.saveBtn} disabled={infoLoading}>
                  {infoLoading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </form>
            </div>
          )}

          {/* ── Password section ── */}
          {activeSection === 'password' && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Cambiar contraseña</h2>
              <form onSubmit={handleChangePassword} className={styles.form}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Contraseña actual</label>
                  <input
                    type="password"
                    className={styles.input}
                    value={currentPwd}
                    onChange={e => setCurrentPwd(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Nueva contraseña</label>
                  <input
                    type="password"
                    className={styles.input}
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Confirmar nueva contraseña</label>
                  <input
                    type="password"
                    className={`${styles.input} ${confirmPwd && newPwd !== confirmPwd ? styles.inputError : ''}`}
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    autoComplete="new-password"
                  />
                </div>

                {newPwd && confirmPwd && newPwd !== confirmPwd && (
                  <p className={styles.fieldHintError}>Las contraseñas no coinciden</p>
                )}

                {pwdFeedback && (
                  <div className={`${styles.feedback} ${pwdFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError}`}>
                    {pwdFeedback.message}
                  </div>
                )}

                <button type="submit" className={styles.saveBtn} disabled={pwdLoading}>
                  {pwdLoading ? 'Cambiando...' : 'Cambiar contraseña'}
                </button>
              </form>
            </div>
          )}

          {/* ── Danger section ── */}
          {activeSection === 'danger' && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Gestión de cuenta</h2>

              <div className={styles.dangerZone}>
                <div className={styles.dangerHeader}>
                  <span className={styles.dangerIcon}>⚠️</span>
                  <div>
                    <h3 className={styles.dangerTitle}>Zona de peligro</h3>
                    <p className={styles.dangerDesc}>
                      Estas acciones son permanentes e irreversibles. Procede con cuidado.
                    </p>
                  </div>
                </div>

                <div className={styles.dangerItem}>
                  <div>
                    <strong className={styles.dangerItemTitle}>Eliminar cuenta</strong>
                    <p className={styles.dangerItemDesc}>
                      Se eliminarán tu cuenta y todos tus datos de forma permanente.
                    </p>
                  </div>
                  {!showDeletePrompt ? (
                    <button
                      className={styles.deleteBtn}
                      onClick={() => setShowDeletePrompt(true)}
                    >
                      Eliminar mi cuenta
                    </button>
                  ) : (
                    <div className={styles.deleteConfirmBox}>
                      <p className={styles.deleteConfirmText}>
                        Para confirmar, escribe tu nombre: <strong>{user.name}</strong>
                      </p>
                      <input
                        type="text"
                        className={styles.input}
                        value={deleteConfirm}
                        onChange={e => setDeleteConfirm(e.target.value)}
                        placeholder={user.name}
                      />
                      {dangerFeedback && (
                        <div className={`${styles.feedback} ${styles.feedbackError}`}>
                          {dangerFeedback.message}
                        </div>
                      )}
                      <div className={styles.deleteConfirmActions}>
                        <button
                          className={styles.cancelBtn}
                          onClick={() => { setShowDeletePrompt(false); setDeleteConfirm(''); setDangerFeedback(null); }}
                        >
                          Cancelar
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={handleDeleteAccount}
                          disabled={dangerLoading || deleteConfirm !== user.name}
                        >
                          {dangerLoading ? 'Eliminando...' : 'Confirmar eliminación'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};
