import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, SkipForward, RotateCcw, EyeOff } from 'lucide-react';
import { TimerState, AppSettings } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/constants';
import { ThemeProvider } from '../components/ThemeProvider';
import { useSettingsStore } from '../stores/settingsStore';
import { cn, formatMs } from '../lib/utils';

export default function FloatingWidget() {
  const [timerState, setTimerState] = useState<TimerState>({
    sessionType: 'focus',
    status: 'idle',
    remainingMs: DEFAULT_SETTINGS.focusDurationMs,
    totalDurationMs: DEFAULT_SETTINGS.focusDurationMs,
    taskName: '',
    cycleCount: 0,
    completedTodayCount: 0,
    activeFocusMsToday: 0,
    sessionActiveFocusMs: 0,
    startedAt: null,
    pausedAt: null,
    sessionId: null,
  });

  const [isHovered, setIsHovered] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartPos = useRef<{ screenX: number; screenY: number } | null>(null);
  const dragThreshold = 5; // px to differentiate click vs drag

  const loadSettings = useSettingsStore(s => s.load);
  const settings = useSettingsStore(s => s.settings);

  useEffect(() => {
    loadSettings();

    const onFocus = () => loadSettings();
    window.addEventListener('focus', onFocus);

    // Initial timer state
    window.focusFlow?.timer?.getState().then((stateJson: string) => {
      try {
        if (stateJson) setTimerState(JSON.parse(stateJson));
      } catch {}
    });

    // Listen to timer updates
    const onUpdate = (stateJson: string) => {
      try {
        setTimerState(JSON.parse(stateJson));
      } catch {}
    };

    window.focusFlow?.timer?.onStateUpdate(onUpdate);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.focusFlow?.timer?.offStateUpdate(onUpdate);
    };
  }, [loadSettings]);

  // Click vs Drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { screenX: e.screenX, screenY: e.screenY };
    isDraggingRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStartPos.current) {
      const dx = Math.abs(e.screenX - dragStartPos.current.screenX);
      const dy = Math.abs(e.screenY - dragStartPos.current.screenY);
      if (dx > dragThreshold || dy > dragThreshold) {
        isDraggingRef.current = true;
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // End of potential drag
    if (isDraggingRef.current) {
      // User dragged: ask main process to snap position to nearest edge
      window.focusFlow?.widget?.getPosition().then((pos: { x: number; y: number } | null) => {
        if (pos) {
          // Send to main process with edge auto-detection
          window.focusFlow?.widget?.setPosition({
            x: pos.x,
            y: pos.y,
            edge: pos.x > 800 ? 'right' : 'left', // main process clamps & docks to workArea
          });
        }
      });
    } else {
      // Intentional click on widget body: focus main app
      const route = (timerState.status === 'running' || timerState.status === 'paused')
        ? '/session'
        : '/';
      window.focusFlow?.widget?.focusMain(route);
    }

    dragStartPos.current = null;
    isDraggingRef.current = false;
  };

  const isRunning = timerState.status === 'running';
  const isPaused = timerState.status === 'paused';

  const progress = timerState.totalDurationMs > 0
    ? Math.max(0, Math.min(1, timerState.remainingMs / timerState.totalDurationMs))
    : 1;

  const sessionLabel = timerState.sessionType === 'focus'
    ? 'Focus'
    : timerState.sessionType === 'short-break'
      ? 'Break'
      : 'Long Break';

  const sessionColor = timerState.sessionType === 'focus'
    ? 'bg-[hsl(var(--timer-focus))]'
    : timerState.sessionType === 'short-break'
      ? 'bg-[hsl(var(--timer-short-break))]'
      : 'bg-[hsl(var(--timer-long-break))]';

  return (
    <ThemeProvider>
      <div
        className={cn(
          'w-[220px] h-[120px] rounded-2xl p-3.5 select-none',
          'bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl',
          'flex flex-col justify-between overflow-hidden relative cursor-default drag-region transition-all duration-200'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Top bar: Type + Task */}
        <div className="flex items-center justify-between gap-1 pointer-events-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={cn('w-2 h-2 rounded-full shrink-0', sessionColor)} />
            <span className="text-[11px] font-semibold tracking-wide uppercase text-foreground/80 truncate">
              {sessionLabel}
            </span>
          </div>

          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums font-mono">
            {timerState.cycleCount}/{settings.longBreakInterval}
          </span>
        </div>

        {/* Task name */}
        <div className="pointer-events-none">
          {timerState.taskName ? (
            <p className="text-[11px] text-muted-foreground truncate leading-tight">
              {timerState.taskName}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground/50 leading-tight">
              FocusFlow
            </p>
          )}
        </div>

        {/* Center: Countdown + Progress bar */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5 pointer-events-none">
            <span className="text-2xl font-bold font-mono tracking-tight tabular-nums text-foreground">
              {formatMs(timerState.remainingMs)}
            </span>
            {isPaused && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium uppercase">
                Paused
              </span>
            )}
          </div>

          {/* Thin progress track */}
          <div className="h-1 w-full bg-secondary rounded-full overflow-hidden pointer-events-none">
            <div
              className={cn('h-full transition-all duration-300 rounded-full', sessionColor)}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* Hover Action Strip */}
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 py-1.5 px-3 bg-card/95 backdrop-blur-md border-t border-border/60',
            'flex items-center justify-around no-drag transition-transform duration-150',
            isHovered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Pause / Resume */}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (isRunning) await window.focusFlow?.timer?.pause();
              else await window.focusFlow?.timer?.resume();
            }}
            className="p-1 rounded-md text-foreground hover:bg-secondary transition-colors cursor-pointer"
            aria-label={isRunning ? 'Pause' : 'Resume'}
            title={isRunning ? 'Pause' : 'Resume'}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {/* Skip */}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              await window.focusFlow?.timer?.skip();
            }}
            className="p-1 rounded-md text-foreground hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Skip stage"
            title="Skip"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Restart */}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              await window.focusFlow?.timer?.restart();
            }}
            className="p-1 rounded-md text-foreground hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Restart stage"
            title="Restart"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Hide widget */}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              await window.focusFlow?.widget?.hide();
            }}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Hide widget"
            title="Hide widget (keep timer running)"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </ThemeProvider>
  );
}
