import { Menu, Sigma } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AuthUser } from '@/types';

interface TopBarProps {
  activeModuleLabel: string;
  user: AuthUser | null;
  onToggleSidebar: () => void;
  onLogout?: () => void;
  className?: string;
}

/**
 * Barra superior minimalista con módulo activo y controles de sesión.
 */
export function TopBar({
  activeModuleLabel,
  user,
  onToggleSidebar,
  onLogout,
  className,
}: TopBarProps) {
  const displayName = user?.username || user?.email || 'Invitado';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-[var(--border)] bg-[color:rgba(8,12,10,0.82)] px-4 backdrop-blur-xl lg:px-6',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-9 w-9 rounded-full lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--primary)] text-[var(--bg-base)]">
            <Sigma className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              RootFinder Pro
            </p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{activeModuleLabel}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-[var(--text-primary)]">{displayName}</p>
          <p className="text-[11px] text-[var(--text-muted)]">Sesión activa</p>
        </div>
        {onLogout ? (
          <Button type="button" variant="outline" size="sm" onClick={onLogout} className="rounded-full">
            Salir
          </Button>
        ) : null}
      </div>
    </header>
  );
}
