export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string): boolean => {
  // Mínimo 6 caracteres
  return password.length >= 6;
};

export const validateLoginForm = (email: string, password: string) => {
  const errors: { email?: string; password?: string } = {};

  if (!email.trim()) {
    errors.email = 'El email es requerido';
  } else if (!isValidEmail(email)) {
    errors.email = 'El email no es válido';
  }

  if (!password) {
    errors.password = 'La contraseña es requerida';
  } else if (!isValidPassword(password)) {
    errors.password = 'La contraseña debe tener al menos 6 caracteres';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateRegisterForm = (
  email: string,
  username: string,
  password: string,
  confirmPassword: string
) => {
  const errors: {
    email?: string;
    username?: string;
    password?: string;
    confirmPassword?: string;
  } = {};

  if (!email.trim()) {
    errors.email = 'El email es requerido';
  } else if (!isValidEmail(email)) {
    errors.email = 'El email no es válido';
  }

  if (!username.trim()) {
    errors.username = 'El nombre de usuario es requerido';
  } else if (username.length < 3) {
    errors.username = 'El nombre debe tener al menos 3 caracteres';
  }

  if (!password) {
    errors.password = 'La contraseña es requerida';
  } else if (!isValidPassword(password)) {
    errors.password = 'La contraseña debe tener al menos 6 caracteres';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Debes confirmar la contraseña';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
