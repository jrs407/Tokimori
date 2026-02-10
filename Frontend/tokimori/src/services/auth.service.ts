import type { LoginCredentials, RegisterCredentials, AuthResponse, User } from '../types';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

const AUTH_API_URL = 'http://localhost:8000';

const saveSession = (response: AuthResponse) => {
  if (response.token) {
    localStorage.setItem(TOKEN_KEY, response.token);
  }
  localStorage.setItem(USER_KEY, JSON.stringify(response.user));
};

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const readUser = (): User | null => {
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson) as User;
  } catch {
    return null;
  }
};

export const authService = {

  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await fetch(`${AUTH_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(errorData?.message || 'Error al iniciar sesión');
    }

    const data = (await response.json()) as { token?: string; user: User };

    const authResponse: AuthResponse = {
      token: data.token,
      user: {
        id: String(data.user.id),
        email: data.user.email,
        name: data.user.name,
        isAdmin: data.user.isAdmin,
        isPublic: data.user.isPublic,
      },
    };

    saveSession(authResponse);

    return authResponse;
  },


  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    const response = await fetch(`${AUTH_API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: credentials.name,
        email: credentials.email,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(errorData?.message || 'Error al registrarse');
    }

    const data = (await response.json()) as { token?: string; user: User };

    const authResponse: AuthResponse = {
      token: data.token,
      user: {
        id: String(data.user.id),
        email: data.user.email,
        name: data.user.name,
        isAdmin: data.user.isAdmin,
        isPublic: data.user.isPublic,
      },
    };

    saveSession(authResponse);

    return authResponse;
  },

  /**
   * Obtiene el usuario actual del localStorage
   */
  getCurrentUser: () => readUser(),

  /**
   * Obtiene el token de autenticación
   */
  getToken: () => localStorage.getItem(TOKEN_KEY),

  /**
   * Logout borra los datos guardados
   */
  logout: () => {
    clearSession();
  },

  /**
   * Verifica si el usuario está autenticado
   */
  isAuthenticated: () => !!localStorage.getItem(TOKEN_KEY),
};
