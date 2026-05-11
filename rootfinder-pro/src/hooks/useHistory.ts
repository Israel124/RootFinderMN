import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startTransition } from 'react';
import { apiClient, ApiClientError } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type {
  CalculationResult,
  HistoryCacheSnapshot,
  HistoryMutationResponse,
  HistorySyncStatus,
  QueuedHistoryOperation,
} from '@/types';

const CACHE_VERSION = 1 as const;
const CACHE_KEY_PREFIX = 'rootfinder-history-cache';
const EMPTY_QUEUE: QueuedHistoryOperation[] = [];

type PendingMutation =
  | { type: 'save'; item: CalculationResult }
  | { type: 'delete'; id: string }
  | { type: 'clear' }
  | { type: 'updateLabel'; id: string; label: string };

function isOfflineError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 0;
}

function getCacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}:${userId}`;
}

function safeParseSnapshot(rawValue: string | null): HistoryCacheSnapshot | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as HistoryCacheSnapshot;
    if (parsed?.version !== CACHE_VERSION || !Array.isArray(parsed.items) || !Array.isArray(parsed.queuedOperations)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function readCache(userId: string): HistoryCacheSnapshot | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return safeParseSnapshot(window.localStorage.getItem(getCacheKey(userId)));
}

function writeCache(userId: string, items: CalculationResult[], queuedOperations: QueuedHistoryOperation[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  const snapshot: HistoryCacheSnapshot = {
    version: CACHE_VERSION,
    userId,
    items,
    queuedOperations,
    cachedAt: Date.now(),
  };

  window.localStorage.setItem(getCacheKey(userId), JSON.stringify(snapshot));
}

function createQueuedOperation(operation: PendingMutation): QueuedHistoryOperation {
  if (operation.type === 'save') {
    return { id: crypto.randomUUID(), type: 'save', payload: operation.item, createdAt: Date.now() };
  }

  if (operation.type === 'delete') {
    return { id: crypto.randomUUID(), type: 'delete', payload: { id: operation.id, label: '' }, createdAt: Date.now() };
  }

  if (operation.type === 'updateLabel') {
    return {
      id: crypto.randomUUID(),
      type: 'updateLabel',
      payload: { id: operation.id, label: operation.label },
      createdAt: Date.now(),
    };
  }

  return { id: crypto.randomUUID(), type: 'clear', createdAt: Date.now() };
}

function applyLocalMutation(items: CalculationResult[], mutation: PendingMutation): CalculationResult[] {
  if (mutation.type === 'save') {
    const remaining = items.filter((item) => item.id !== mutation.item.id);
    return [mutation.item, ...remaining].sort((left, right) => right.timestamp - left.timestamp);
  }

  if (mutation.type === 'delete') {
    return items.filter((item) => item.id !== mutation.id);
  }

  if (mutation.type === 'clear') {
    return [];
  }

  return items.map((item) => (item.id === mutation.id ? { ...item, label: mutation.label } : item));
}

async function runQueuedOperation(operation: QueuedHistoryOperation): Promise<void> {
  if (operation.type === 'save' && operation.payload) {
    await apiClient.post<HistoryMutationResponse>('/api/history', operation.payload);
    return;
  }

  if (operation.type === 'delete' && operation.payload && 'id' in operation.payload) {
    await apiClient.delete<{ success: boolean }>(`/api/history/${operation.payload.id}`);
    return;
  }

  if (operation.type === 'updateLabel' && operation.payload && 'id' in operation.payload && 'label' in operation.payload) {
    await apiClient.patch<HistoryMutationResponse>(`/api/history/${operation.payload.id}`, {
      label: operation.payload.label,
    });
    return;
  }

  if (operation.type === 'clear') {
    await apiClient.delete<{ success: boolean }>('/api/history');
  }
}

/**
 * Gestiona el historial remoto como fuente única de verdad y usa localStorage solo como caché offline.
 */
export function useHistory() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [items, setItems] = useState<CalculationResult[]>([]);
  const [syncStatus, setSyncStatus] = useState<HistorySyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const queueRef = useRef<QueuedHistoryOperation[]>(EMPTY_QUEUE);
  const syncInFlightRef = useRef(false);

  const persistState = useCallback(
    (nextItems: CalculationResult[], nextQueue = queueRef.current) => {
      if (!user) {
        return;
      }

      writeCache(user.id, nextItems, nextQueue);
    },
    [user],
  );

  const loadCache = useCallback(() => {
    if (!user) {
      return null;
    }

    return readCache(user.id);
  }, [user]);

  const fetchHistory = useCallback(async () => {
    if (!user || !isAuthenticated) {
      startTransition(() => {
        setItems([]);
        setSyncStatus('idle');
        setError(null);
      });
      return [];
    }

    setSyncStatus('loading');
    setError(null);

    try {
      const remoteItems = await apiClient.get<CalculationResult[]>('/api/history');
      const normalized = remoteItems.sort((left, right) => right.timestamp - left.timestamp);
      queueRef.current = EMPTY_QUEUE;
      startTransition(() => {
        setItems(normalized);
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
      });
      persistState(normalized, EMPTY_QUEUE);
      return normalized;
    } catch (error) {
      const cached = loadCache();
      if (cached) {
        queueRef.current = cached.queuedOperations;
        startTransition(() => {
          setItems(cached.items);
          setSyncStatus('offline');
          setError(error instanceof Error ? error.message : 'No se pudo cargar el historial remoto');
        });
        return cached.items;
      }

      startTransition(() => {
        setItems([]);
        setSyncStatus('error');
        setError(error instanceof Error ? error.message : 'No se pudo cargar el historial');
      });
      throw error;
    }
  }, [isAuthenticated, loadCache, persistState, user]);

  const syncPendingQueue = useCallback(async () => {
    if (!user || !isAuthenticated || syncInFlightRef.current || queueRef.current.length === 0) {
      return;
    }

    syncInFlightRef.current = true;
    setSyncStatus('syncing');
    setError(null);

    try {
      for (const operation of queueRef.current) {
        await runQueuedOperation(operation);
      }

      queueRef.current = EMPTY_QUEUE;
      await fetchHistory();
    } catch (error) {
      setSyncStatus(isOfflineError(error) ? 'offline' : 'error');
      setError(error instanceof Error ? error.message : 'No se pudo sincronizar el historial');
    } finally {
      syncInFlightRef.current = false;
    }
  }, [fetchHistory, isAuthenticated, user]);

  const applyMutation = useCallback(
    async (mutation: PendingMutation, remoteAction: () => Promise<void>) => {
      const previousItems = items;
      const nextItems = applyLocalMutation(previousItems, mutation);

      startTransition(() => {
        setItems(nextItems);
        setError(null);
      });

      try {
        await remoteAction();
        persistState(nextItems);
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
      } catch (error) {
        if (isOfflineError(error)) {
          const queuedOperation = createQueuedOperation(mutation);
          queueRef.current = [...queueRef.current, queuedOperation];
          persistState(nextItems, queueRef.current);
          setSyncStatus('offline');
          setError('Trabajando sin conexión. Los cambios se sincronizarán al reconectar.');
          return;
        }

        startTransition(() => {
          setItems(previousItems);
          setSyncStatus('error');
          setError(error instanceof Error ? error.message : 'No se pudo completar la operación');
        });
        throw error;
      }
    },
    [items, persistState],
  );

  const save = useCallback(
    async (item: CalculationResult) => {
      await applyMutation(
        { type: 'save', item },
        async () => {
          await apiClient.post<HistoryMutationResponse>('/api/history', item);
        },
      );
    },
    [applyMutation],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      await applyMutation(
        { type: 'delete', id },
        async () => {
          await apiClient.delete<{ success: boolean }>(`/api/history/${id}`);
        },
      );
    },
    [applyMutation],
  );

  const clear = useCallback(async () => {
    await applyMutation(
      { type: 'clear' },
      async () => {
        await apiClient.delete<{ success: boolean }>('/api/history');
      },
    );
  }, [applyMutation]);

  const updateLabel = useCallback(
    async (id: string, label: string) => {
      await applyMutation(
        { type: 'updateLabel', id, label },
        async () => {
          await apiClient.patch<HistoryMutationResponse>(`/api/history/${id}`, { label });
        },
      );
    },
    [applyMutation],
  );

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (!user || !isAuthenticated) {
      queueRef.current = EMPTY_QUEUE;
      return;
    }

    const cached = loadCache();
    if (cached?.queuedOperations.length) {
      queueRef.current = cached.queuedOperations;
    }

    const onReconnect = () => {
      void syncPendingQueue();
    };

    window.addEventListener('online', onReconnect);
    return () => {
      window.removeEventListener('online', onReconnect);
    };
  }, [isAuthenticated, loadCache, syncPendingQueue, user]);

  return useMemo(
    () => ({
      items,
      isLoading: syncStatus === 'loading' || syncStatus === 'syncing',
      error,
      syncStatus,
      lastSyncedAt,
      save,
      delete: deleteItem,
      clear,
      updateLabel,
      reload: fetchHistory,
      syncPendingQueue,
      pendingCount: queueRef.current.length,
    }),
    [clear, deleteItem, error, fetchHistory, items, lastSyncedAt, save, syncPendingQueue, syncStatus, updateLabel],
  );
}
