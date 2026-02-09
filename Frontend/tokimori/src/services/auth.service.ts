import type { LoginCredentials, RegisterCredentials, AuthResponse } from '../types';

// Simulación de una API real - aquí irían las llamadas HTTP al backend
const MOCK_USERS = [
  {
    id: '1',
    email: 'test@example.com',
    password: 'password123',
    name: 'Usuario Test',
    username: 'testuser',
  },
];

// const TOKEN_KEY = 'auth_token';
// const USER_KEY = 'auth_user';

export const authService = {
  /**
   * Simula un login en el backend
   * En una aplicación real, esto haría un POST a tu servidor
   * NOTA: NO GUARDA NADA - Solo simulación visual
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    // Simulamos delay de red
    await new Promise((resolve) => setTimeout(resolve, 500));

    const user = MOCK_USERS.find(
      (u) => u.email === credentials.email && u.password === credentials.password
    );

    if (!user) {
      throw new Error('Email o contraseña incorrectos');
    }

    // Generamos un token simulado
    const token = `token_${Date.now()}_${Math.random()}`;
    const authResponse: AuthResponse = {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
      },
    };

    // DESACTIVADO: No guardamos nada en localStorage
    // localStorage.setItem(TOKEN_KEY, token);
    // localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));

    return authResponse;
  },

  /**
   * Simula un registro en el backend
   * NOTA: NO REGISTRA DE VERDAD - Solo valida el formulario
   */
  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    // Simulamos delay de red
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Solo validamos formato, NO registramos realmente
    console.log('⚠️ REGISTRO SIMULADO - No se guarda nada:', credentials.email);

    // Generamos respuesta simulada sin guardar nada
    const token = `token_${Date.now()}_${Math.random()}`;
    const authResponse: AuthResponse = {
      token,
      user: {
        id: 'temp_' + Date.now(),
        email: credentials.email,
        name: credentials.username,
        username: credentials.username,
      },
    };

    // DESACTIVADO: No guardamos nada
    // MOCK_USERS.push(newUser);
    // localStorage.setItem(TOKEN_KEY, token);
    // localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));

    return authResponse;
  },

  /**
   * Obtiene el usuario actual del localStorage
   */
  getCurrentUser: () => {
    // DESACTIVADO: No leemos de localStorage
    // const userJson = localStorage.getItem(USER_KEY);
    // if (!userJson) return null;
    // return JSON.parse(userJson);
    return null;
  },

  /**
   * Obtiene el token de autenticación
   */
  getToken: () => {
    // DESACTIVADO: No leemos de localStorage
    // return localStorage.getItem(TOKEN_KEY);
    return null;
  },

  /**
   * Simula logout borrando los datos guardados
   */
  logout: () => {
    // DESACTIVADO: No hay nada que borrar
    // localStorage.removeItem(TOKEN_KEY);
    // localStorage.removeItem(USER_KEY);
    console.log('⚠️ LOGOUT SIMULADO - No había nada guardado');
  },

  /**
   * Verifica si el usuario está autenticado
   */
  isAuthenticated: () => {
    // DESACTIVADO: Siempre retorna false
    // return !!localStorage.getItem(TOKEN_KEY);
    return false;
  },
};
