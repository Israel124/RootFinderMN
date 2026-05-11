import { cn } from '@/lib/utils';
import { AppTab } from '@/types';
import {
  CircleDot,
  Compass,
  FlaskConical,
  History,
  LineChart,
  SlidersHorizontal,
} from 'lucide-react';

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  user?: any;
  onLogout?: () => void;
}

const moduleTabs = [
  {
    id: 'taylor',
    step: '1',
    title: 'Aproximaciones Taylor',
    subtitle: 'Series y error de truncamiento',
  },
  {
    id: 'resolution',
    step: '2',
    title: 'Métodos de Resolución',
    subtitle: 'Ecuaciones no lineales',
  },
  {
    id: 'polynomial',
    step: '3',
    title: 'Raíces Polinómicas',
    subtitle: 'Müller · Bairstow · Horner',
  },
  {
    id: 'systems',
    step: '4',
    title: 'Newton-Raphson Sistemas',
    subtitle: 'Ecuaciones no lineales múltiples',
  },
] as const;

const resolutionSections = [
  { id: 'verification', label: 'Verificación', hint: 'Base analítica', icon: Compass },
  { id: 'methods', label: 'Métodos', hint: 'Configuración y cálculo', icon: SlidersHorizontal },
  { id: 'results', label: 'Resultados', hint: 'Salida numérica', icon: FlaskConical },
  { id: 'graph', label: 'Gráficas', hint: 'Lectura visual', icon: LineChart },
  { id: 'history', label: 'Historial', hint: 'Trazabilidad', icon: History },
] as const;

export function Navbar({ activeTab, setActiveTab, user, onLogout }: NavbarProps) {
  const activeModule =
    activeTab === 'systems'
      ? 'systems'
      : activeTab === 'taylor'
      ? 'taylor'
      : activeTab === 'polynomial'
      ? 'polynomial'
      : 'resolution';

  const tabColorClass = (tabId: string) => {
    switch (tabId) {
      case 'taylor':
        return 'text-emerald-400 border-emerald-300/25 bg-emerald-300/8';
      case 'resolution':
        return 'text-cyan-400 border-cyan-300/25 bg-cyan-300/8';
      case 'polynomial':
        return 'text-amber-400 border-amber-300/25 bg-amber-300/8';
      case 'systems':
        return 'text-rose-400 border-rose-300/25 bg-rose-300/8';
      default:
        return 'text-primary border-primary/25 bg-primary/8';
    }
  };

  const currentSection =
    resolutionSections.find((section) => section.id === activeTab)?.label ?? 'Métodos';

  return (
    <nav
      aria-label="Navegacion principal de modulos"
      className="overflow-hidden rounded-[2rem] border border-primary/10 bg-card/82 shadow-2xl backdrop-blur-xl lg:sticky lg:top-28"
    >
      <div className="border-b border-primary/10 bg-linear-to-r from-primary/8 via-transparent to-transparent px-4 py-4">
        <div className="grid gap-2 lg:grid-cols-1">
          {moduleTabs.map((tab) => {
            const isResolution = tab.id === 'resolution';
            const isSelected = tab.id === activeModule;
            const isSelectedTabStyle = isSelected ? tabColorClass(tab.id) : 'border-transparent bg-background/35 opacity-80';
            const dotStyle = isSelected ? tabColorClass(tab.id) : 'text-slate-400/60';

            return (
              <div key={tab.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (isResolution) {
                      setActiveTab(activeModule === 'resolution' ? activeTab : 'methods');
                      return;
                    }
                    setActiveTab(tab.id);
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-[1.4rem] border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                    isSelected ? isSelectedTabStyle : 'border-transparent bg-background/35 opacity-80'
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      isSelected ? tabColorClass(tab.id) : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {tab.step}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{tab.title}</p>
                      <CircleDot className={cn('h-3 w-3 shrink-0', dotStyle)} aria-hidden="true" />
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
      </div>

      {activeModule === 'resolution' && (
        <div className="grid gap-4 px-4 py-4">
          <div className="rounded-[1.5rem] border border-primary/10 bg-background/45 p-4 shadow-inner shadow-primary/5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">
                Flujo de Resolución
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Cambia de etapa sin desplegables. La ruta actual es <span className="font-semibold text-foreground">{currentSection}</span>.
              </p>
            </div>
            <div className="mt-4 grid gap-2">
              {resolutionSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveTab(section.id)}
                    className={cn(
                      'flex min-h-24 w-full flex-col items-start justify-between rounded-[1.35rem] border px-4 py-3 text-left transition-all',
                      activeTab === section.id
                        ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                        : 'border-primary/10 bg-card/80 text-foreground hover:border-primary/30 hover:bg-primary/7'
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <Icon className={cn('h-4 w-4', activeTab === section.id ? 'text-primary-foreground' : 'text-primary')} />
                      {activeTab === section.id && (
                        <span className="text-[10px] font-black uppercase tracking-[0.22em]">Ahora</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{section.label}</p>
                      <p className={cn('mt-1 text-[11px]', activeTab === section.id ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                        {section.hint}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-primary/10 bg-background/45 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">
              Operación Actual
            </p>
            <p className="mt-3 text-xl font-black text-foreground">{currentSection}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Diseñado para trabajar en continuidad: entrada, cálculo, lectura visual e historial dentro de la misma estación.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[11px] font-semibold text-primary">
                Navegación directa
              </span>
              <span className="rounded-full border border-primary/15 bg-card/90 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                Menos cambios de vista
              </span>
            </div>
          </div>
        </div>
      )}

      {user && (
        <div className="border-t border-primary/10 px-4 py-4">
          <div className="flex items-center justify-between rounded-[1.35rem] border border-primary/10 bg-background/55 p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/15 bg-primary/18">
                <span className="text-sm font-semibold text-primary">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{user.email}</p>
                <p className="text-[11px] text-muted-foreground">Sesión activa</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
