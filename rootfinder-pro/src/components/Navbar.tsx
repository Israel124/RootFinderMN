import { cn } from '@/lib/utils';
import { Calculator, History, LineChart, Settings2, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const tabs = [
  { id: 'verification', label: 'Verificación', icon: CheckCircle2 },
  { id: 'methods', label: 'Métodos', icon: Settings2 },
  { id: 'results', label: 'Resultados', icon: Calculator },
  { id: 'history', label: 'Historial', icon: History },
  { id: 'graph', label: 'Gráfica', icon: LineChart },
];

export function Navbar({ activeTab, setActiveTab }: NavbarProps) {
  return (
    <nav className="mb-8 rounded-[2rem] border border-primary/10 bg-card/60 p-2 shadow-xl backdrop-blur-xl">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        );
      })}
      </div>
    </nav>
  );
}
