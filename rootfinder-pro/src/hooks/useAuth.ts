import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient, ApiClientError, setUnauthorizedHandler } from '@/lib/apiClient';
import {
  clearAuthSession,
  setAuthError,
  setAuthSession,
  setAuthStatus,
  setAuthUser,
  setPendingVerificationEmail,
  useAuthStore,
} from '@/stores/authStore';
import type {
  AuthSuccessResponse,
  AuthUser,
  LoginInput,
  RegisterInput,
  RegisterResponse,
  UpdateProfileInput,
  VerifyEmailInput,
} from '@/types';

interface AuthActionState {
  user: AuthUser | null;
  accessToken: string | null;
  error: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBootstrapping: boolean;
  pendingVerificationEmail: string | null;
  login: (payload: LoginInput) => Promise<AuthSuccessResponse>;
  register: (payload: RegisterInput) => Promise<RegisterResponse>;
  verifyEmail: (payload: VerifyEmailInput) => Promise<AuthSuccessResponse>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthSuccessResponse | null>;
  checkSession: () => Promise<AuthSuccessResponse | null>;
  updateProfile: (payload: UpdateProfileInput) => Promise<void>;
  clearError: () => void;
}

function toMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Ocurrió un error inesperado';
}

/**
 * Hook de autenticación con refresh automático y estado centralizado en memoria.
 */
export function useAuth(): AuthActionState {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const pendingVerificationEmail = useAuthStore((state) => state.pendingVerificationEmail);
  const [isLoading, setIsLoading] = useState(false);
  const isBootstrappedRef = useRef(false);

  const applyAuthResponse = useCallback((response: AuthSuccessResponse) => {
    setAuthSession(response.user, response.accessToken);
    setPendingVerificationEmail(null);
    return response;
  }, []);

  const refreshSession = useCallback(async (): Promise<AuthSuccessResponse | null> => {
    try {
      const response = await apiClient.refreshSession();
      if (!response) {
        clearAuthSession();
        return null;
      }

      applyAuthResponse(response);
      return response;
    } catch (error) {
      clearAuthSession(toMessage(error));
      return null;
    }
  }, [applyAuthResponse]);

  const checkSession = useCallback(async (): Promise<AuthSuccessResponse | null> => {
    setAuthStatus('bootstrapping');
    const response = await refreshSession();
    if (response) {
      setAuthStatus('authenticated');
    } else {
      setAuthStatus('anonymous');
    }
    return response;
  }, [refreshSession]);

  useEffect(() => {
    if (isBootstrappedRef.current) {
      return;
    }

    isBootstrappedRef.current = true;
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuthSession('Tu sesión expiró. Inicia sesión nuevamente.');
      setPendingVerificationEmail(null);
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  const login = useCallback(
    async (payload: LoginInput) => {
      setIsLoading(true);
      setAuthError(null);

      try {
        const response = await apiClient.login(payload);
        applyAuthResponse(response);
        return response;
      } catch (error) {
        const message = toMessage(error);
        setAuthError(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [applyAuthResponse],
  );

  const register = useCallback(async (payload: RegisterInput) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const response = await apiClient.register(payload);
      setPendingVerificationEmail(response.email);
      setAuthStatus('anonymous');
      return response;
    } catch (error) {
      const message = toMessage(error);
      setAuthError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyEmail = useCallback(
    async (payload: VerifyEmailInput) => {
      setIsLoading(true);
      setAuthError(null);

      try {
        const response = await apiClient.verifyEmail(payload);
        applyAuthResponse(response);
        return response;
      } catch (error) {
        const message = toMessage(error);
        setAuthError(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [applyAuthResponse],
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      await apiClient.logout();
    } catch (error) {
      const message = toMessage(error);
      setAuthError(message);
      throw error;
    } finally {
      clearAuthSession();
      setPendingVerificationEmail(null);
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (payload: UpdateProfileInput) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const response = await apiClient.updateProfile(payload);
      setAuthUser(response.user);
    } catch (error) {
      const message = toMessage(error);
      setAuthError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  return useMemo(
    () => ({
      user,
      accessToken,
      error,
      isAuthenticated: status === 'authenticated' && Boolean(user && accessToken),
      isLoading,
      isBootstrapping: status === 'bootstrapping',
      pendingVerificationEmail,
      login,
      register,
      verifyEmail,
      logout,
      refreshSession,
      checkSession,
      updateProfile,
      clearError,
    }),
    [
      accessToken,
      checkSession,
      clearError,
      error,
      isLoading,
      login,
      logout,
      pendingVerificationEmail,
      refreshSession,
      register,
      status,
      updateProfile,
      user,
      verifyEmail,
    ],
  );
}
