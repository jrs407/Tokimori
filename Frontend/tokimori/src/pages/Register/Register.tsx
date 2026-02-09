import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { validateRegisterForm } from '../../utils/validation';
import styles from './Register.module.css';

export const Register = () => {
  const navigate = useNavigate();
  const { register, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    username?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar formulario
    const validation = validateRegisterForm(email, username, password, confirmPassword);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});

    try {
      await register({ email, username, password, confirmPassword });
      setEmail('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      console.log('Registro exitoso');
      // Aquí podrías redirigir o mostrar mensaje de éxito
    } catch (err) {
      console.error('Error de registro:', err);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Crear Cuenta</h1>

        {/* Mensaje de error general */}
        {error && <div className={styles.alert + ' ' + styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Campo Email */}
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              className={`${styles.input} ${errors.email ? styles.error : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              disabled={isLoading}
            />
            {errors.email && (
              <span className={styles.errorMessage}>{errors.email}</span>
            )}
          </div>

          {/* Campo Nombre de Usuario */}
          <div className={styles.formGroup}>
            <label htmlFor="username" className={styles.label}>
              Nombre de Usuario
            </label>
            <input
              id="username"
              type="text"
              className={`${styles.input} ${errors.username ? styles.error : ''}`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="usuario123"
              disabled={isLoading}
            />
            {errors.username && (
              <span className={styles.errorMessage}>{errors.username}</span>
            )}
          </div>

          {/* Campo Contraseña */}
          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className={`${styles.input} ${errors.password ? styles.error : ''}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
            />
            {errors.password && (
              <span className={styles.errorMessage}>{errors.password}</span>
            )}
          </div>

          {/* Campo Confirmar Contraseña */}
          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirmar Contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              className={`${styles.input} ${errors.confirmPassword ? styles.error : ''}`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
            />
            {errors.confirmPassword && (
              <span className={styles.errorMessage}>{errors.confirmPassword}</span>
            )}
          </div>

          {/* Botón de envío */}
          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        {/* Link para volver a login */}
        <div className={styles.footer}>
          <span className={styles.footerText}>¿Ya tienes cuenta?</span>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className={styles.linkButton}
          >
            Inicia sesión
          </button>
        </div>
      </div>
    </div>
  );
};
