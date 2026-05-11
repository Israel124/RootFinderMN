import type { AuthUser } from '@/types';
import { clearAccessToken, setAccessToken as setApiAccessToken } from '@/lib/apiClient';
import { createStore, useStoreSelector } from './storeUtils';

export type AuthStatus = 'bootstrapping' | 'anonymous' | 'authenticated';

export interface AuthStoreState {
  user: AuthUser | null;
  accessToken: string | null;
  status: AuthStatus;
  error: string | null;
  pendingVerificationEmail: string | null;
}

const authStore = createStore<AuthStoreState>({
  user: null,
  accessToken: null,
  status: 'bootstrapping',
  error: null,
  pendingVerificationEmail: null,
});

/**
 * Hook de selección para el estado global de autenticación.
 */
export function useAuthStore<TSlice>(selector: (state: AuthStoreState) => TSlice): TSlice {
  return useStoreSelector(authStore, selector);
}

/**
 * Retorna una fotografía instantánea del store de autenticación.
 */
export function getAuthState(): AuthStoreState {
  return authStore.getState();
}

/**
 * Aplica un token de acceso en memoria y actualiza el store.
 */
export function setAuthSession(user: AuthUser, accessToken: string): void {
  setApiAccessToken(accessToken);
  authStore.setState((current) => ({
    ...current,
    user,
    accessToken,
    status: 'authenticated',
    error: null,
  }));
}

/**
 * Marca la sesión como anónima y limpia el token en memoria.
 */
export function clearAuthSession(message: string | null = null): void {
  clearAccessToken();
  authStore.setState((current) => ({
    ...current,
    user: null,
    accessToken: null,
    status: 'anonymous',
    error: message,
  }));
}

/**
 * Actualiza solamente el usuario autenticado sin tocar el token.
 */
export function setAuthUser(user: AuthUser): void {
  authStore.setState((current) => ({
    ...current,
    user,
  }));
}

/**
 * Actualiza el correo pendiente de verificación.
 */
export function setPendingVerificationEmail(email: string | null): void {
  authStore.setState((current) => ({
    ...current,
    pendingVerificationEmail: email,
  }));
}

/**
 * Ajusta el estado general de autenticación.
 */
export function setAuthStatus(status: AuthStatus): void {
  authStore.setState((current) => ({
    ...current,
    status,
  }));
}

/**
 * Registra un mensaje de error funcional asociado al flujo de autenticación.
 */
export function setAuthError(error: string | null): void {
  authStore.setState((current) => ({
    ...current,
    error,
  }));
}
