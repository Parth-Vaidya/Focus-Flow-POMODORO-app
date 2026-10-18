import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pause, Play, SkipForward, RotateCcw, Square, Music, Settings } from 'lucide-react';
import { useTimerStore } from '../stores/timerStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAudioStore } from '../stores/audioStore';
import TimerDisplay from '../components/TimerDisplay';
import { Progress } from '../components/ui/progress';
import { Button } from '../components/ui/button';
import { cn, formatDurationHuman } from '../lib/utils';

const SESSION_LABELS: Record<string, { label: string; desc: string; dot: string }> = {
  focus: { label: 'Focus', desc: 'Deep work time', dot: 'bg-[hsl(var(--timer-focus))]' },
  'short-break': { label: 'Short Break', desc: 'Quick rest', dot: 'bg-[hsl(var(--timer-short-break))]' },
  'long-break': { label: 'Long Break', desc: 'Extended rest', dot: 'bg-[hsl(var(--timer-long-break))]' },
};

export default function ActiveSessionPage() {
  const navigate = useNavigate();
  const { timerState, pause, resume, skip, restart, stop } = useTimerStore();
  const settings = useSettingsStore(s => s.settings);
  const { isPlaying, toggleBgm } = useAudioStore();

  const sessionInfo = SESSION_LABELS[timerState.sessionType] || SESSION_LABELS.focus;
  const isRunning = timerState.status === 'running';
  const isPaused = timerState.status === 'paused';
  const isIdle = timerState.status === 'idle';

  const goalProgress = settings.dailyGoalMs > 0
    ? Math.min(100, (timerState.activeFocusMsToday / settings.dailyGoalMs) * 100)
    : 0;

  // Keyboard shortcut: Space to pause/resume
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (isRunning) pause();
      else if (isPaused) resume();
    }
  }, [isRunning, isPaused, pause, resume]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleStop = async () => {
    await stop();
    navigate('/');
  };

  useEffect(() => {
    if (isIdle) {
      navigate('/');
    }
  }, [isIdle, navigate]);

  if (isIdle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-8">
        <p className="text-muted-foreground mb-4">No active session</p>
        <Button onClick={() => navigate('/')}>Go to Home</Button>
      </div>
    );
  }

  const totalTarget = settings.totalFocusSessions || settings.longBreakInterval || 4;

  return (
    <div className="flex flex-col items-center justify-between min-h-full p-8 py-10">
      {/* Top status & task header */}
      <div className="flex flex-col items-center gap-2 w-full max-w-md">
        <div className="flex items-center gap-2">
          <div className={cn('w-2.5 h-2.5 rounded-full', sessionInfo.dot)} />
          <span className="text-sm font-semibold tracking-wide">{sessionInfo.label}</span>
          <span className="text-sm text-muted-foreground">· {sessionInfo.desc}</span>
        </div>

        {/* Cycle indicators */}
        <div className="flex items-center gap-1.5 mt-1">
          {Array.from({ length: totalTarget }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                i < timerState.cycleCount
                  ? 'bg-primary'
                  : i === timerState.cycleCount && timerState.sessionType === 'focus'
                    ? 'border-2 border-primary bg-primary/20 animate-pulse'
                    : 'bg-border'
              )}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            Focus {timerState.sessionType === 'focus' ? Math.min(timerState.cycleCount + 1, totalTarget) : timerState.cycleCount} of {totalTarget}
          </span>
        </div>

        {/* Task name */}
        {timerState.taskName ? (
          <p className="text-sm text-muted-foreground text-center mt-2 px-4 truncate max-w-xs">
            Task: <span className="text-foreground font-medium">{timerState.taskName}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/60 text-center mt-2">
            Unassigned task
          </p>
        )}
      </div>

      {/* Main Timer Display */}
      <div className="my-auto py-4">
        <TimerDisplay timerState={timerState} size="lg" showRing />
      </div>

      {/* Control cluster */}
      <div className="flex flex-col items-center gap-6 w-full max-w-md">
        <div className="flex items-center gap-4">
          {/* Restart */}
          <button
            onClick={restart}
            className="w-11 h-11 rounded-full flex items-center justify-center border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Restart current session"
            title="Restart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Pause / Resume */}
          <button
            onClick={isRunning ? pause : resume}
            className="w-16 h-16 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all hover:scale-105 cursor-pointer"
            aria-label={isRunning ? 'Pause session' : 'Resume session'}
            title={isRunning ? 'Pause (Space)' : 'Resume (Space)'}
          >
            {isRunning
              ? <Pause className="w-7 h-7" />
              : <Play className="w-7 h-7 translate-x-0.5" />}
          </button>

          {/* Skip */}
          <button
            onClick={skip}
            className="w-11 h-11 rounded-full flex items-center justify-center border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Skip to next session stage"
            title="Skip"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Secondary controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleBgm}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors cursor-pointer',
              settings.audioEnabled
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
            aria-label={settings.audioEnabled ? 'Disable BGM' : 'Enable BGM'}
            title={settings.audioEnabled ? `BGM: Enabled (${settings.audioSource === 'brown-noise' ? 'Brown Noise' : 'Local Tracks'})` : 'BGM: Disabled (Click to enable)'}
          >
            <Music className="w-3.5 h-3.5" />
            BGM
          </button>

          <button
            onClick={handleStop}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors cursor-pointer"
            aria-label="Stop session and return home"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Open settings"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>

        {/* Daily goal progress */}
        <div className="w-full">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Daily focus goal</span>
            <span>{formatDurationHuman(timerState.activeFocusMsToday)} / {formatDurationHuman(settings.dailyGoalMs)}</span>
          </div>
          <Progress value={goalProgress} className="h-1.5" />
        </div>
      </div>
    </div>
  );
}
