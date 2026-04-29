import { CalculationResult } from '@/types';

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
  try {
    const response = await fetch(input, init);
    return parseApiResponse<T>(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error de red desconocido';
    throw new Error(message);
  }
}

export async function fetchHistory(): Promise<CalculationResult[]> {
  return safeFetch<CalculationResult[]>('/api/history');
}

export async function saveHistoryItem(item: CalculationResult) {
  const response = await fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });

  return parseApiResponse<{ success: boolean }>(response);
}

export async function updateHistoryLabel(id: string, label: string) {
  const response = await fetch(`/api/history/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });

  return parseApiResponse<{ success: boolean }>(response);
}

export async function deleteHistoryItem(id: string) {
  const response = await fetch(`/api/history/${id}`, { method: 'DELETE' });
  return parseApiResponse<{ success: boolean }>(response);
}

export async function clearHistoryItems() {
  const response = await fetch('/api/history', { method: 'DELETE' });
  return parseApiResponse<{ success: boolean }>(response);
}
