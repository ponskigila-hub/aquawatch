import { NavLink } from 'react-router-dom';
import { Activity, CloudRain, Compass, Globe2, History, Layers3, Waves, Wind } from 'lucide-react';

const tabs = [
  { to: '/', label: 'Overview', icon: Globe2, end: true },
  { to: '/forecast', label: 'Forecast', icon: CloudRain },
  { to: '/hazards', label: 'Hazards', icon: Activity },
  { to: '/air-quality', label: 'Air quality', icon: Wind },
  { to: '/ocean', label: 'Ocean', icon: Waves },
  { to: '/history', label: 'History & climate', icon: History },
  { to: '/community', label: 'Community', icon: Compass },
  { to: '/tools', label: 'Data tools', icon: Layers3 },
];

export const AppNavigation = () => (
  <nav aria-label="Main pages" className="border-t border-border/70 bg-background/55">
    <div className="container mx-auto flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:thin]">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        >
          <Icon className="h-3.5 w-3.5" />{label}
        </NavLink>
      ))}
    </div>
  </nav>
);
