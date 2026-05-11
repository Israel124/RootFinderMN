import { API_BASE_URL } from '@/lib/apiConfig';
import type {
  ApiErrorPayload,
  AuthSuccessResponse,
  CurrentUserResponse,
  LoginInput,
  RegisterInput,
  RegisterResponse,
  UpdateProfileInput,
  VerifyEmailInput,
} from '@/types';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  requiresAuth?: boolean;
  retryOnUnauthorized?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Error tipado del cliente HTTP central.
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: string;
  readonly payload?: unknown;

  constructor(message: string, status = 0, payload?: Partial<ApiErrorPayload> | unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code =
      payload && typeof payload === 'object' && 'code' in payload ? (payload as Partial<ApiErrorPayload>).code : undefined;
    this.details =
      payload && typeof payload === 'object' && 'details' in payload
        ? (payload as Partial<ApiErrorPayload>).details
        : undefined;
    this.payload = payload;
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<AuthSuccessResponse | null> | null = null;
let unauthorizedHandler: (() => void) | null = null;

/**
 * Asigna el token de acceso en memoria usado por el cliente.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Limpia el token de acceso en memoria.
 */
export function clearAccessToken(): void {
  accessToken = null;
}

/**
 * Devuelve el token de acceso actualmente cargado.
 */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Permite reaccionar globalmente ante una revocación de sesión.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

async function parseResponseBody<T>(response: Response): Promise<T | ApiErrorPayload | null> {
  const rawText = await response.text();
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as T | ApiErrorPayload;
  } catch {
    return { error: rawText };
  }
}

function buildHeaders(options: RequestOptions, hasJsonBody: boolean): Headers {
  const headers = new Headers(options.headers);
  if (hasJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.requiresAuth !== false && accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return headers;
}

function normalizeError(status: number, payload: ApiErrorPayload | null, fallback: string): ApiClientError {
  return new ApiClientError(payload?.error || fallback, status, payload ?? undefined);
}

async function performRequest<T>(
  path: string,
  method: HttpMethod,
  options: RequestOptions = {},
): Promise<T> {
  const hasJsonBody = options.body !== undefined && !(options.body instanceof FormData);
  const headers = buildHeaders(options, hasJsonBody);
  let response: Response;
  const timeoutController = new AbortController();
  const timeoutMs = options.timeoutMs ?? 15000;
  const timeoutId = window.setTimeout(() => {
    timeoutController.abort(new Error('Tiempo de espera agotado'));
  }, timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) {
      timeoutController.abort(options.signal.reason);
    } else {
      options.signal.addEventListener(
        'abort',
        () => {
          timeoutController.abort(options.signal?.reason);
        },
        { once: true },
      );
    }
  }

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers,
      body:
        options.body === undefined
          ? undefined
          : options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
      signal: timeoutController.signal,
    });
  } catch (error) {
    window.clearTimeout(timeoutId);
    throw new ApiClientError(
      error instanceof Error && error.name === 'AbortError'
        ? 'La solicitud tardó demasiado en responder'
        : error instanceof Error
        ? error.message
        : 'No se pudo conectar con el servidor',
      0,
    );
  }

  window.clearTimeout(timeoutId);

  const payload = (await parseResponseBody<T>(response)) as T | ApiErrorPayload | null;

  if (response.ok) {
    return payload as T;
  }

  if (response.status === 401 && options.retryOnUnauthorized !== false && path !== '/api/auth/refresh') {
    const refreshed = await refreshAccessToken();
    if (refreshed?.accessToken) {
      return performRequest<T>(path, method, { ...options, retryOnUnauthorized: false });
    }

    unauthorizedHandler?.();
  }

  throw normalizeError(response.status, payload as ApiErrorPayload | null, 'No se pudo completar la solicitud');
}

async function refreshAccessToken(): Promise<AuthSuccessResponse | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await performRequest<AuthSuccessResponse>('/api/auth/refresh', 'POST', {
        requiresAuth: false,
        retryOnUnauthorized: false,
        timeoutMs: 6000,
      });
      setAccessToken(response.accessToken);
      return response;
    } catch {
      clearAccessToken();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Cliente HTTP central con refresh automático de sesión.
 */
export const apiClient = {
  /**
   * Ejecuta una solicitud GET.
   */
  get<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return performRequest<T>(path, 'GET', options);
  },

  /**
   * Ejecuta una solicitud POST JSON.
   */
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return performRequest<T>(path, 'POST', { ...options, body });
  },

  /**
   * Ejecuta una solicitud PATCH JSON.
   */
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return performRequest<T>(path, 'PATCH', { ...options, body });
  },

  /**
   * Ejecuta una solicitud DELETE.
   */
  delete<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return performRequest<T>(path, 'DELETE', options);
  },

  /**
   * Renueva explícitamente el token de acceso usando la cookie httpOnly.
   */
  refreshSession(): Promise<AuthSuccessResponse | null> {
    return refreshAccessToken();
  },

  /**
   * Resuelve el usuario autenticado actual.
   */
  getCurrentUser(signal?: AbortSignal): Promise<CurrentUserResponse> {
    return performRequest<CurrentUserResponse>('/api/user/me', 'GET', { signal });
  },

  /**
   * Ejecuta el inicio de sesión contra el backend nuevo.
   */
  login(payload: LoginInput): Promise<AuthSuccessResponse> {
    return performRequest<AuthSuccessResponse>('/api/auth/login', 'POST', {
      requiresAuth: false,
      retryOnUnauthorized: false,
      body: payload,
    });
  },

  /**
   * Registra un usuario y deja pendiente la verificación.
   */
  register(payload: RegisterInput): Promise<RegisterResponse> {
    return performRequest<RegisterResponse>('/api/auth/register', 'POST', {
      requiresAuth: false,
      retryOnUnauthorized: false,
      body: payload,
    });
  },

  /**
   * Verifica el correo y abre sesión.
   */
  verifyEmail(payload: VerifyEmailInput): Promise<AuthSuccessResponse> {
    return performRequest<AuthSuccessResponse>('/api/auth/verify', 'POST', {
      requiresAuth: false,
      retryOnUnauthorized: false,
      body: payload,
    });
  },

  /**
   * Cierra la sesión remota y limpia la cookie de refresh.
   */
  logout(): Promise<{ success: boolean }> {
    return performRequest<{ success: boolean }>('/api/auth/logout', 'POST', {
      requiresAuth: false,
      retryOnUnauthorized: false,
    });
  },

  /**
   * Actualiza el perfil autenticado actual.
   */
  updateProfile(payload: UpdateProfileInput): Promise<CurrentUserResponse> {
    return performRequest<CurrentUserResponse>('/api/user/me', 'PATCH', {
      body: payload,
    });
  },
};
