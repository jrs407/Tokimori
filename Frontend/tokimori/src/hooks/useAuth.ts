import { useState, useCallback } from 'react';
import type { LoginCredentials, RegisterCredentials, User } from '../types';
import { authService } from '../services/auth.service';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(credentials);
      setUser(response.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.register(credentials);
      setUser(response.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al registrarse';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setError(null);
  }, []);

  const updateProfile = useCallback(async (updates: { name?: string; email?: string; isPublic?: boolean }) => {
    if (!user) throw new Error('No hay usuario autenticado');
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('No se encontró el token');
    await authService.updateProfile(token, user.id, updates);
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  }, [user]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!user) throw new Error('No hay usuario autenticado');
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('No se encontró el token');
    await authService.changePassword(token, user.id, currentPassword, newPassword);
  }, [user]);

  const deleteAccount = useCallback(async () => {
    if (!user) throw new Error('No hay usuario autenticado');
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('No se encontró el token');
    await authService.deleteAccount(token, user.id);
    setUser(null);
  }, [user]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    deleteAccount,
  };
};
