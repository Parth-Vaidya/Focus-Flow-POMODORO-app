import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Timer, BarChart2, Clock, Settings, Home } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTimerStore } from '../stores/timerStore';

interface NavItem {
  path: string;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/session', label: 'Session', icon: Timer },
  { path: '/analytics', label: 'Analytics', icon: BarChart2 },
  { path: '/history', label: 'History', icon: Clock },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const status = useTimerStore(s => s.timerState.status);
  const isActive = status === 'running' || status === 'paused';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-16 flex flex-col items-center py-6 bg-card border-r border-border gap-2 shrink-0">
        <div className="mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Timer className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>
        <nav className="flex flex-col gap-1 w-full px-2">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'w-full flex flex-col items-center py-2 px-1 rounded-lg text-xs gap-1 transition-colors',
                  'hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {path === '/session' && isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-timer-focus" />
                  )}
                </div>
                <span className="leading-none text-[10px]">{label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
