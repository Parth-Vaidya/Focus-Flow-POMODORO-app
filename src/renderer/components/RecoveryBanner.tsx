import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, X } from 'lucide-react';
import { useTimerStore } from '../stores/timerStore';
import { cn } from '../lib/utils';

export default function RecoveryBanner() {
  const hasRecovery = useTimerStore(s => s.hasRecovery);
  const dismiss = useTimerStore(s => s.dismissRecovery);
  const navigate = useNavigate();

  if (!hasRecovery) return null;

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2.5 bg-accent/15 border-b border-accent/30',
      'text-sm animate-fade-in'
    )}>
      <AlertCircle className="w-4 h-4 text-accent shrink-0" />
      <span className="flex-1 text-foreground/90">
        A previous session was restored as paused.
      </span>
      <button
        onClick={() => { navigate('/session'); }}
        className="text-primary hover:underline font-medium text-sm cursor-pointer"
      >
        Resume
      </button>
      <button
        onClick={dismiss}
        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label="Dismiss recovery banner"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
