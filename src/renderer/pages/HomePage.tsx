import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer, BarChart2, Zap, Music, X, ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react';
import { useTimerStore } from '../stores/timerStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAudioStore } from '../stores/audioStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { cn, formatDurationHuman, formatMs } from '../lib/utils';

export default function HomePage() {
  const navigate = useNavigate();
  const [taskName, setTaskName] = useState('');
  const [todayStats, setTodayStats] = useState<{ totalFocusMs: number; completedSessions: number } | null>(null);
  const [showAudioHint, setShowAudioHint] = useState(false);
  const [isSetupExpanded, setIsSetupExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('focusflow_session_setup_expanded');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const { start, timerState } = useTimerStore();
  const { settings, update } = useSettingsStore();
  const { toggleBgm, tracks } = useAudioStore();
  const currentTrack = tracks.find(t => t.id === settings.audioTrackId);

  const isActive = timerState.status === 'running' || timerState.status === 'paused';

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('focusflow_audio_discovery_dismissed');
      if (!dismissed) {
        setShowAudioHint(true);
      }
    } catch {}

    window.focusFlow.analytics.getDaily().then((stats: any) => {
      setTodayStats(stats);
    }).catch(() => {});
  }, []);

  const handleDismissHint = () => {
    try {
      localStorage.setItem('focusflow_audio_discovery_dismissed', 'true');
    } catch {}
    setShowAudioHint(false);
  };

  const toggleSetupExpanded = () => {
    setIsSetupExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem('focusflow_session_setup_expanded', String(next));
      } catch {}
      return next;
    });
  };

  const handleStart = async () => {
    await start(taskName.trim());
    navigate('/session');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  // Values in minutes and counts
  const focusMinutes = Math.round(settings.focusDurationMs / 60000);
  const shortBreakMinutes = Math.round(settings.shortBreakDurationMs / 60000);
  const longBreakMinutes = Math.round(settings.longBreakDurationMs / 60000);
  const cycleSessions = settings.totalFocusSessions ?? settings.longBreakInterval ?? 4;

  // Session duration increment/decrement handlers
  const handleDecrementFocus = () => {
    const current = Math.round(settings.focusDurationMs / 60000);
    const next = current <= 5 ? 1 : Math.max(1, current - 5);
    update({ focusDurationMs: next * 60000 });
  };

  const handleIncrementFocus = () => {
    const current = Math.round(settings.focusDurationMs / 60000);
    const next = current < 5 ? 5 : Math.min(120, current + 5);
    update({ focusDurationMs: next * 60000 });
  };

  const handleDecrementShortBreak = () => {
    const current = Math.round(settings.shortBreakDurationMs / 60000);
    const next = Math.max(1, current - 1);
    update({ shortBreakDurationMs: next * 60000 });
  };

  const handleIncrementShortBreak = () => {
    const current = Math.round(settings.shortBreakDurationMs / 60000);
    const next = Math.min(60, current + 1);
    update({ shortBreakDurationMs: next * 60000 });
  };

  const handleDecrementLongBreak = () => {
    const current = Math.round(settings.longBreakDurationMs / 60000);
    const next = current <= 5 ? 1 : Math.max(1, current - 5);
    update({ longBreakDurationMs: next * 60000 });
  };

  const handleIncrementLongBreak = () => {
    const current = Math.round(settings.longBreakDurationMs / 60000);
    const next = current < 5 ? 5 : Math.min(120, current + 5);
    update({ longBreakDurationMs: next * 60000 });
  };

  const handleDecrementCycleSessions = () => {
    const current = settings.totalFocusSessions ?? settings.longBreakInterval ?? 4;
    const next = Math.max(1, current - 1);
    update({ totalFocusSessions: next, longBreakInterval: next });
  };

  const handleIncrementCycleSessions = () => {
    const current = settings.totalFocusSessions ?? settings.longBreakInterval ?? 4;
    const next = Math.min(16, current + 1);
    update({ totalFocusSessions: next, longBreakInterval: next });
  };

  const goalPercent = todayStats && settings.dailyGoalMs > 0
    ? Math.min(100, (todayStats.totalFocusMs / settings.dailyGoalMs) * 100)
    : 0;

  return (
    <div className="min-h-full w-full py-5 px-5 flex justify-center">
      <div className="w-full max-w-[500px] flex flex-col">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Timer className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-tight">FocusFlow</h1>
              <p className="text-[11px] text-muted-foreground">Distraction-light focus sessions</p>
            </div>
          </div>
        </div>

        {/* Active session resume card */}
        {isActive && (
          <div className="mb-3.5 p-3 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary">Session in progress</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {timerState.sessionType === 'focus' ? 'Focus' : timerState.sessionType === 'short-break' ? 'Short Break' : 'Long Break'}
                {timerState.taskName && ` · ${timerState.taskName}`}
              </p>
            </div>
            <Button size="sm" onClick={() => navigate('/session')} className="shrink-0 h-7 px-2.5 text-xs">
              View Session
            </Button>
          </div>
        )}

        {/* First-launch Audio & BGM feature discovery hint */}
        {showAudioHint && !isActive && (
          <div className="mb-3.5 p-3 rounded-xl bg-card border border-primary/25 shadow-sm flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Music className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-foreground">Personalize your focus sessions</p>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  You can use Soft White Noise or choose your own music.{' '}
                  <button
                    onClick={() => {
                      handleDismissHint();
                      navigate('/settings#audio');
                    }}
                    className="text-primary hover:underline font-medium cursor-pointer inline-flex items-center gap-0.5"
                  >
                    Explore Audio in Settings &rarr;
                  </button>
                </p>
              </div>
            </div>
            <button
              onClick={handleDismissHint}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary transition-colors shrink-0 cursor-pointer"
              aria-label="Dismiss hint"
              title="Dismiss hint"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 1. Primary Focus Area */}
        <div className="w-full mb-4">
          {/* Prominent session duration countdown display */}
          <div className="flex flex-col items-center justify-center py-2.5 mb-2 text-center select-none">
            <span
              className="text-5xl font-bold font-mono tracking-tight tabular-nums text-foreground select-none"
              aria-label={`Upcoming focus duration: ${formatDurationHuman(settings.focusDurationMs)}`}
            >
              {formatMs(settings.focusDurationMs)}
            </span>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs font-medium text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--timer-focus))]" />
              <span>Next focus session</span>
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="task-name" className="text-xs font-medium text-muted-foreground mb-1 block">
              Task name <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              id="task-name"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What are you working on?"
              maxLength={200}
              className="h-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="lg"
              onClick={handleStart}
              className="flex-1 h-10 text-sm font-semibold shadow-sm cursor-pointer"
              disabled={isActive}
            >
              <Zap className="w-4 h-4 mr-2" />
              {isActive ? 'Session Active' : 'Start Focus Session'}
            </Button>

            <button
              onClick={toggleBgm}
              className={cn(
                'h-10 w-10 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0',
                settings.audioEnabled
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              )}
              aria-label={settings.audioEnabled ? 'BGM enabled' : 'BGM disabled'}
              title={
                settings.audioEnabled
                  ? (settings.audioSource !== 'tracks'
                      ? 'BGM: Enabled (Soft White Noise)'
                      : (currentTrack ? `BGM: Enabled (${currentTrack.name})` : 'BGM: Enabled (My Music)'))
                  : 'BGM: Disabled (Click to enable)'
              }
            >
              <Music className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Session Setup Panel (Collapsible) */}
        <div className="w-full mb-4 rounded-xl bg-card border border-border p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Session setup</h2>
              <p className="text-xs text-muted-foreground">Customize your next session.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSetupExpanded}
              className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0 cursor-pointer"
              aria-expanded={isSetupExpanded}
              aria-label={isSetupExpanded ? 'Collapse session setup' : 'Expand session setup'}
              title={isSetupExpanded ? 'Collapse session setup' : 'Expand session setup'}
            >
              <span className="text-xs mr-1 inline-block">
                {isSetupExpanded ? 'Collapse' : 'Configure'}
              </span>
              {isSetupExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Button>
          </div>

          {/* Collapsed summary */}
          {!isSetupExpanded && (
            <div className="mt-2.5 pt-2.5 border-t border-border/60 text-muted-foreground">
              <div className="flex items-center flex-wrap gap-x-1.5 sm:gap-x-2 gap-y-1 text-[11px] leading-tight">
                <span className="whitespace-nowrap">Focus <strong className="text-foreground font-semibold">{formatDurationHuman(settings.focusDurationMs)}</strong></span>
                <span className="text-muted-foreground/40 select-none">·</span>
                <span className="whitespace-nowrap">Short break <strong className="text-foreground font-semibold">{formatDurationHuman(settings.shortBreakDurationMs)}</strong></span>
                <span className="text-muted-foreground/40 select-none">·</span>
                <span className="whitespace-nowrap">Long break <strong className="text-foreground font-semibold">{formatDurationHuman(settings.longBreakDurationMs)}</strong></span>
                <span className="text-muted-foreground/40 select-none">·</span>
                <span className="whitespace-nowrap"><strong className="text-foreground font-semibold">{cycleSessions}</strong> sessions/cycle</span>
              </div>
            </div>
          )}

          {/* Expanded controls: Fixed 2-column grid */}
          {isSetupExpanded && (
            <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 gap-2">
              {/* 1. Focus duration */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/40">
                <div className="min-w-0 pr-1">
                  <span className="text-xs font-medium text-foreground block truncate">Focus</span>
                  <span className="text-[10px] text-muted-foreground block truncate">Work interval</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleDecrementFocus}
                    disabled={focusMinutes <= 1}
                    aria-label="Decrease focus duration"
                    className="h-6 w-6 rounded cursor-pointer disabled:opacity-40"
                    title="Decrease focus duration by 5 minutes"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-13 text-center text-xs font-mono font-semibold tabular-nums text-foreground select-none">
                    {focusMinutes} min
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleIncrementFocus}
                    disabled={focusMinutes >= 120}
                    aria-label="Increase focus duration"
                    className="h-6 w-6 rounded cursor-pointer disabled:opacity-40"
                    title="Increase focus duration by 5 minutes"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* 2. Short break duration */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/40">
                <div className="min-w-0 pr-1">
                  <span className="text-xs font-medium text-foreground block truncate">Short break</span>
                  <span className="text-[10px] text-muted-foreground block truncate">Quick rest</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleDecrementShortBreak}
                    disabled={shortBreakMinutes <= 1}
                    aria-label="Decrease short break duration"
                    className="h-6 w-6 rounded cursor-pointer disabled:opacity-40"
                    title="Decrease short break by 1 minute"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-13 text-center text-xs font-mono font-semibold tabular-nums text-foreground select-none">
                    {shortBreakMinutes} min
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleIncrementShortBreak}
                    disabled={shortBreakMinutes >= 60}
                    aria-label="Increase short break duration"
                    className="h-6 w-6 rounded cursor-pointer disabled:opacity-40"
                    title="Increase short break by 1 minute"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* 3. Long break duration */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/40">
                <div className="min-w-0 pr-1">
                  <span className="text-xs font-medium text-foreground block truncate">Long break</span>
                  <span className="text-[10px] text-muted-foreground block truncate">Extended rest</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleDecrementLongBreak}
                    disabled={longBreakMinutes <= 1}
                    aria-label="Decrease long break duration"
                    className="h-6 w-6 rounded cursor-pointer disabled:opacity-40"
                    title="Decrease long break by 5 minutes"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-13 text-center text-xs font-mono font-semibold tabular-nums text-foreground select-none">
                    {longBreakMinutes} min
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleIncrementLongBreak}
                    disabled={longBreakMinutes >= 120}
                    aria-label="Increase long break duration"
                    className="h-6 w-6 rounded cursor-pointer disabled:opacity-40"
                    title="Increase long break by 5 minutes"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* 4. Focus sessions per cycle */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/40">
                <div className="min-w-0 pr-1">
                  <span className="text-xs font-medium text-foreground block truncate">Cycle count</span>
                  <span className="text-[10px] text-muted-foreground block truncate">Before long break</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleDecrementCycleSessions}
                    disabled={cycleSessions <= 1}
                    aria-label="Decrease sessions per cycle"
                    className="h-6 w-6 rounded cursor-pointer disabled:opacity-40"
                    title="Decrease cycle sessions by 1"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-13 text-center text-xs font-mono font-semibold tabular-nums text-foreground select-none">
                    {cycleSessions}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleIncrementCycleSessions}
                    disabled={cycleSessions >= 16}
                    aria-label="Increase sessions per cycle"
                    className="h-6 w-6 rounded cursor-pointer disabled:opacity-40"
                    title="Increase cycle sessions by 1"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Today's stats */}
        {todayStats !== null && (
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-semibold text-foreground/90 uppercase tracking-wide">Today’s Progress</h3>
              <button
                onClick={() => navigate('/analytics')}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 cursor-pointer transition-colors"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Analytics
              </button>
            </div>
            <div className="p-3 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-lg font-bold tracking-tight">{formatDurationHuman(todayStats.totalFocusMs)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">of {formatDurationHuman(settings.dailyGoalMs)} goal</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tracking-tight">{todayStats.completedSessions}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">sessions</p>
                </div>
              </div>
              <Progress value={goalPercent} className="h-1.5" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
