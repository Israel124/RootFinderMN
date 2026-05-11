import { useSyncExternalStore } from 'react';

type Listener = () => void;
type Selector<TState, TSlice> = (state: TState) => TSlice;

interface StoreApi<TState> {
  getState: () => TState;
  setState: (updater: Partial<TState> | ((current: TState) => TState)) => void;
  subscribe: (listener: Listener) => () => void;
}

/**
 * Crea un store externo mínimo compatible con React 19.
 */
export function createStore<TState>(initialState: TState): StoreApi<TState> {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    setState: (updater) => {
      const nextState =
        typeof updater === 'function'
          ? (updater as (current: TState) => TState)(state)
          : ({ ...state, ...updater } as TState);

      if (Object.is(nextState, state)) {
        return;
      }

      state = nextState;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Suscribe un componente React a una porción del store externo.
 */
export function useStoreSelector<TState, TSlice>(
  store: StoreApi<TState>,
  selector: Selector<TState, TSlice>,
): TSlice {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()), () => selector(store.getState()));
}
