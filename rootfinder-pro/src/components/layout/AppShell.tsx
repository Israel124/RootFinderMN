import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import type { AppTab, AuthUser } from '@/types';

interface AppShellProps {
  activeTab: AppTab;
  activeModuleLabel: string;
  user: AuthUser | null;
  sidebarCollapsed?: boolean;
  onToggleSidebar: () => void;
  onNavigate: (tab: AppTab) => void;
  onLogout?: () => void;
  counts?: Partial<Record<'taylor' | 'methods' | 'polynomial' | 'systems', number>>;
  children: ReactNode;
  className?: string;
}

/**
 * Shell principal con barra lateral fija, topbar y área central de trabajo.
 */
export function AppShell({
  activeTab,
  activeModuleLabel,
  user,
  sidebarCollapsed = false,
  onToggleSidebar,
  onNavigate,
  onLogout,
  counts,
  children,
  className,
}: AppShellProps) {
  return (
    <div className={cn('min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]', className)}>
      <TopBar
        activeModuleLabel={activeModuleLabel}
        user={user}
        onToggleSidebar={onToggleSidebar}
        onLogout={onLogout}
      />
      <div className="flex min-h-[calc(100vh-56px)]">
        <Sidebar
          activeTab={activeTab}
          onNavigate={onNavigate}
          user={user}
          collapsed={sidebarCollapsed}
          onLogout={onLogout}
          counts={counts}
        />
        <main className="flex-1">
          <div className="mx-auto max-w-[1200px] px-4 py-6 lg:px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
