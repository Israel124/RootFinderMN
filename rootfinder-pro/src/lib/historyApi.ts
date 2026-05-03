import { CalculationResult } from '@/types';
import { apiUrl } from '@/lib/apiConfig';

async function parseApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof (payload as any).error === 'string'
        ? (payload as any).error
        : response.statusText || 'Error inesperado del servidor';
    throw new Error(message);
  }

  return payload as T;
}

async function safeFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(input, { ...init, headers });
    return parseApiResponse<T>(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error de red desconocido';
    throw new Error(message);
  }
}

export async function fetchHistory(): Promise<CalculationResult[]> {
  return safeFetch<CalculationResult[]>(apiUrl('/api/history'));
}

export async function saveHistoryItem(item: CalculationResult) {
  return safeFetch<{ success: boolean }>(apiUrl('/api/history'), {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function updateHistoryLabel(id: string, label: string) {
  return safeFetch<{ success: boolean }>(apiUrl(`/api/history/${id}`), {
    method: 'PATCH',
    body: JSON.stringify({ label }),
  });
}

export async function deleteHistoryItem(id: string) {
  return safeFetch<{ success: boolean }>(apiUrl(`/api/history/${id}`), { method: 'DELETE' });
}

export async function clearHistoryItems() {
  return safeFetch<{ success: boolean }>(apiUrl('/api/history'), { method: 'DELETE' });
}
