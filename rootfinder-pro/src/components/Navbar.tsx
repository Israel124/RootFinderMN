import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, CircleDot } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const moduleTabs = [
  {
    id: 'taylor',
    step: '1',
    title: 'Aproximaciones Taylor',
    subtitle: 'Series y error de truncamiento',
    status: 'active',
  },
  {
    id: 'resolution',
    step: '2',
    title: 'Métodos de Resolución',
    subtitle: 'Ecuaciones no lineales',
    status: 'active',
  },
  {
    id: 'polynomials',
    step: '3',
    title: 'Raíces de Polinomios',
    subtitle: 'Müller · Bairstow · Horner',
    status: 'active',
  },
  {
    id: 'systems',
    step: '4',
    title: 'Newton-Raphson Sistemas',
    subtitle: 'Ecuaciones no lineales múltiples',
    status: 'active',
  },
] as const;

const resolutionSections = [
  { id: 'verification', label: 'Verificación' },
  { id: 'methods', label: 'Métodos' },
  { id: 'results', label: 'Resultados' },
  { id: 'graph', label: 'Gráficas' },
  { id: 'history', label: 'Historial' },
] as const;

export function Navbar({ activeTab, setActiveTab }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeModule = activeTab === 'systems' ? 'systems' : activeTab === 'taylor' ? 'taylor' : 'resolution';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentSection =
    resolutionSections.find((section) => section.id === activeTab)?.label ?? 'Métodos';

  return (
    <nav
      ref={menuRef}
      className="mb-8 rounded-[1.8rem] border border-primary/10 bg-card/80 px-3 py-3 shadow-xl backdrop-blur-xl"
    >
      <div className="grid gap-2 xl:grid-cols-4">
        {moduleTabs.map((tab) => {
          const isResolution = tab.id === 'resolution';
          const isSystems = tab.id === 'systems';
          const isTaylor = tab.id === 'taylor';
          const isSelected = tab.id === activeModule;

          return (
            <div key={tab.id}>
              <button
                type="button"
                onClick={() => {
                  if (isResolution) setMenuOpen((open) => !open);
                  if (isTaylor) {
                    setActiveTab('taylor');
                    setMenuOpen(false);
                  }
                  if (isSystems) {
                    setActiveTab('systems');
                    setMenuOpen(false);
                  }
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-[1.4rem] border px-4 py-3 text-left transition-all',
                  isSelected
                    ? 'border-primary/25 bg-primary/8 shadow-md shadow-primary/10'
                    : 'border-transparent bg-background/35 opacity-80'
                )}
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  {tab.step}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{tab.title}</p>
                    <CircleDot className="h-3 w-3 shrink-0 fill-emerald-400 text-emerald-400" />
                    {isResolution && (
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                          menuOpen && 'rotate-180 text-primary'
                        )}
                      />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{tab.subtitle}</p>
                  {isResolution && (
                    <p className="mt-1 truncate text-[11px] font-medium text-primary/80">
                      Vista actual: {currentSection}
                    </p>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {menuOpen && (
        <div className="mt-3 rounded-[1.2rem] border border-primary/10 bg-background/55 p-3 shadow-inner">
          <p className="px-2 pb-3 pt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">
            Secciones disponibles
          </p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {resolutionSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setActiveTab(section.id);
                  setMenuOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition-all',
                  activeTab === section.id
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'bg-card/75 text-foreground hover:bg-primary/8'
                )}
              >
                <span>{section.label}</span>
                {activeTab === section.id && (
                  <span className="text-[11px] font-semibold">Activa</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
