import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, SkipForward, RotateCcw, EyeOff, ChevronUp, GripVertical, Music, Info } from 'lucide-react';
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
  const [isCompact, setIsCompact] = useState(false);

  // Pointer drag tracking refs
  const pointerDownPosRef = useRef<{ screenX: number; screenY: number } | null>(null);
  const isDraggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const latestPosRef = useRef<{ screenX: number; screenY: number } | null>(null);

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
        const state: TimerState = JSON.parse(stateJson);
        setTimerState(state);
        if (state.status === 'idle') {
          setIsCompact(false);
        }
      } catch {}
    };

    window.focusFlow?.timer?.onStateUpdate(onUpdate);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.focusFlow?.timer?.offStateUpdate(onUpdate);
    };
  }, [loadSettings]);

  const handleCompact = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsCompact(true);
    window.focusFlow?.widget?.setCompact(true);
  };

  const handleExpand = () => {
    setIsCompact(false);
    window.focusFlow?.widget?.setCompact(false);
  };

  const handleOpenMain = () => {
    const route = (timerState.status === 'running' || timerState.status === 'paused')
      ? '/session'
      : '/';
    window.focusFlow?.widget?.focusMain(route);
  };

  // Factory to create pointer drag & click discrimination handlers
  const createDragHandlers = (onClickAction: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, input, select, textarea, [data-interactive="true"]')) {
        return;
      }

      const screenX = Math.round(e.screenX);
      const screenY = Math.round(e.screenY);
      pointerDownPosRef.current = { screenX, screenY };
      isDraggingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    },

    onPointerMove: (e: React.PointerEvent) => {
      if (!pointerDownPosRef.current) return;

      const screenX = Math.round(e.screenX);
      const screenY = Math.round(e.screenY);
      const dx = screenX - pointerDownPosRef.current.screenX;
      const dy = screenY - pointerDownPosRef.current.screenY;

      // 6px movement threshold to distinguish drag from click
      if (!isDraggingRef.current && (Math.abs(dx) >= 6 || Math.abs(dy) >= 6)) {
        isDraggingRef.current = true;
        window.focusFlow?.widget?.dragStart(pointerDownPosRef.current.screenX, pointerDownPosRef.current.screenY);
      }

      if (isDraggingRef.current) {
        latestPosRef.current = { screenX, screenY };
        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (isDraggingRef.current && latestPosRef.current) {
              window.focusFlow?.widget?.dragMove(latestPosRef.current.screenX, latestPosRef.current.screenY);
            }
          });
        }
      }
    },

    onPointerUp: (e: React.PointerEvent) => {
      if (!pointerDownPosRef.current) return;

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      const wasDragging = isDraggingRef.current;
      if (wasDragging) {
        if (latestPosRef.current) {
          window.focusFlow?.widget?.dragMove(latestPosRef.current.screenX, latestPosRef.current.screenY);
        }
        suppressClickRef.current = true;
        window.focusFlow?.widget?.dragEnd();
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 120);
      } else {
        suppressClickRef.current = true;
        onClickAction();
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 120);
      }

      pointerDownPosRef.current = null;
      latestPosRef.current = null;
      isDraggingRef.current = false;
    },

    onPointerCancel: (e: React.PointerEvent) => {
      if (isDraggingRef.current) {
        window.focusFlow?.widget?.dragEnd();
      }
      pointerDownPosRef.current = null;
      latestPosRef.current = null;
      isDraggingRef.current = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    },

    onClickCapture: (e: React.MouseEvent) => {
      if (suppressClickRef.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    },

    onClick: (e: React.MouseEvent) => {
      if (suppressClickRef.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
  });

  const compactDragHandlers = createDragHandlers(handleExpand);
  const fullWidgetDragHandlers = createDragHandlers(handleOpenMain);

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

  if (isCompact) {
    return (
      <ThemeProvider>
        <div
          className={cn(
            'w-full h-full rounded-full select-none cursor-grab active:cursor-grabbing',
            'bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl',
            'flex items-center justify-between overflow-hidden relative transition-colors duration-200 hover:border-primary/50'
          )}
          {...compactDragHandlers}
          title="Drag to move, click to expand"
        >
          {/* Drag Handle with Session Dot */}
          <div className="flex items-center gap-1.5 h-full pl-3 pr-2 shrink-0 pointer-events-none select-none">
            <div className={cn('w-2 h-2 rounded-full shrink-0', sessionColor, isRunning && 'animate-pulse')} />
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60" />
          </div>

          {/* Click to expand area */}
          <div className="flex-1 flex items-center justify-end gap-1.5 h-full pr-3 group pointer-events-none select-none">
            <span className="text-xs font-bold font-mono tracking-tight tabular-nums text-foreground group-hover:text-primary transition-colors">
              {formatMs(timerState.remainingMs)}
            </span>
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div
        className={cn(
          'w-full h-full rounded-2xl p-3.5 select-none cursor-grab active:cursor-grabbing',
          'bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl',
          'flex flex-col justify-between overflow-hidden relative transition-colors duration-200'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...fullWidgetDragHandlers}
        title="Drag to move, click to reopen session"
      >
        {/* Top bar: Type + Task */}
        <div className="flex items-center justify-between gap-1 select-none pointer-events-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={cn('w-2 h-2 rounded-full shrink-0', sessionColor)} />
            <span className="text-[11px] font-semibold tracking-wide uppercase text-foreground/80 truncate">
              {sessionLabel}
            </span>
          </div>

          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums font-mono">
            {timerState.cycleCount}/{settings.totalFocusSessions || settings.longBreakInterval || 4}
          </span>
        </div>

        {/* Main Body (Clicks bubble to widget handler to reopen main window) */}
        <div className="flex-1 flex flex-col justify-between py-1 select-none pointer-events-none">
          {/* Task name */}
          <div>
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
            <div className="flex items-baseline justify-between mb-1.5">
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
            <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className={cn('h-full transition-all duration-300 rounded-full', sessionColor)}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Hover Action Strip */}
        <div
          data-interactive="true"
          className={cn(
            'absolute inset-x-0 bottom-0 py-1.5 px-3 bg-card/95 backdrop-blur-md border-t border-border/60',
            'flex items-center justify-around transition-transform duration-150',
            isHovered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
          )}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {/* Pause / Resume */}
          <button
            data-interactive="true"
            onPointerDown={(e) => e.stopPropagation()}
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
            data-interactive="true"
            onPointerDown={(e) => e.stopPropagation()}
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
            data-interactive="true"
            onPointerDown={(e) => e.stopPropagation()}
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

          {/* Music Toggle & Info Shortcut */}
          <div className="flex items-center gap-0.5">
            {/* Music-note button */}
            <button
              data-interactive="true"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={async (e) => {
                e.stopPropagation();
                const next = !settings.audioEnabled;
                await window.focusFlow?.settings?.set({ audioEnabled: next });
              }}
              className={cn(
                'p-1 rounded-md transition-colors cursor-pointer',
                settings.audioEnabled
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
              aria-label={settings.audioEnabled ? 'Disable background audio' : 'Enable background audio'}
              title={settings.audioEnabled ? 'Background Audio: ON' : 'Background Audio: OFF'}
            >
              <Music className="w-3.5 h-3.5" />
            </button>

            {/* Information shortcut */}
            <div className="relative group/info flex items-center">
              <button
                data-interactive="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  window.focusFlow?.widget?.focusMain('/settings#audio');
                }}
                className="p-1 rounded-md text-muted-foreground/60 hover:text-primary hover:bg-secondary/80 focus-visible:text-primary transition-colors cursor-pointer"
                aria-label="Customize focus sounds"
              >
                <Info className="w-3 h-3" />
              </button>

              {/* Hover / Focus Tooltip */}
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/info:flex group-focus-within/info:flex flex-col w-44 p-2 rounded-lg bg-popover/95 border border-border shadow-xl text-left z-50 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150"
              >
                <p className="text-[11px] font-semibold text-foreground leading-tight">
                  Customize your focus sounds
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  Choose Soft White Noise or your own music in Audio Settings.
                </p>
              </div>
            </div>
          </div>

          {/* Compact launcher */}
          <button
            data-interactive="true"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleCompact}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Compact widget"
            title="Compact widget (launcher)"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </ThemeProvider>
  );
}
