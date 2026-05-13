import type { AppTab, AppTheme, HistoryModule } from '@/types';
import { createStore, useStoreSelector } from './storeUtils';

export interface UiStoreState {
  activeTab: AppTab;
  activeHistoryModule: HistoryModule;
  sidebarCollapsed: boolean;
  theme: AppTheme;
  hasSeenWelcome: boolean;
}

const uiStore = createStore<UiStoreState>({
  activeTab: 'taylor',
  activeHistoryModule: 'resolution',
  sidebarCollapsed: false,
  theme: 'dark',
  hasSeenWelcome: false,
});

/**
 * Hook de selección para el estado global de UI.
 */
export function useUiStore<TSlice>(selector: (state: UiStoreState) => TSlice): TSlice {
  return useStoreSelector(uiStore, selector);
}

/**
 * Obtiene el estado de UI actual sin suscripción React.
 */
export function getUiState(): UiStoreState {
  return uiStore.getState();
}

/**
 * Cambia la pestaña principal activa.
 */
export function setActiveTab(tab: AppTab): void {
  uiStore.setState((current) => ({
    ...current,
    activeTab: tab,
  }));
}

/**
 * Cambia el módulo activo del historial.
 */
export function setActiveHistoryModule(module: HistoryModule): void {
  uiStore.setState((current) => ({
    ...current,
    activeHistoryModule: module,
  }));
}

/**
 * Define el estado de colapso de la barra lateral.
 */
export function setSidebarCollapsed(sidebarCollapsed: boolean): void {
  uiStore.setState((current) => ({
    ...current,
    sidebarCollapsed,
  }));
}

/**
 * Invierte el estado de la barra lateral.
 */
export function toggleSidebar(): void {
  uiStore.setState((current) => ({
    ...current,
    sidebarCollapsed: !current.sidebarCollapsed,
  }));
}

/**
 * Mantiene la firma de tema para futuras extensiones visuales.
 */
export function setTheme(theme: AppTheme): void {
  uiStore.setState((current) => ({
    ...current,
    theme,
  }));
}

/**
 * Marca que el usuario ha visto la página de bienvenida.
 */
export function markWelcomeAsSeen(): void {
  uiStore.setState((current) => ({
    ...current,
    hasSeenWelcome: true,
  }));
}
