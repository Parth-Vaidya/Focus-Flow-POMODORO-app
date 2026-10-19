import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer, BarChart2, Zap, Music, X } from 'lucide-react';
import { useTimerStore } from '../stores/timerStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAudioStore } from '../stores/audioStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { cn, formatDurationHuman } from '../lib/utils';

export default function HomePage() {
  const navigate = useNavigate();
  const [taskName, setTaskName] = useState('');
  const [todayStats, setTodayStats] = useState<{ totalFocusMs: number; completedSessions: number } | null>(null);
  const [showAudioHint, setShowAudioHint] = useState(false);

  const { start, timerState } = useTimerStore();
  const settings = useSettingsStore(s => s.settings);
  const { isPlaying, toggleBgm, tracks } = useAudioStore();
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

  const handleStart = async () => {
    await start(taskName.trim());
    navigate('/session');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  const goalPercent = todayStats && settings.dailyGoalMs > 0
    ? Math.min(100, (todayStats.totalFocusMs / settings.dailyGoalMs) * 100)
    : 0;

  return (
    <div className="min-h-full w-full py-6 px-4 sm:px-6 md:px-8 flex justify-center">
      <div className="w-full max-w-[660px] flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Timer className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight leading-tight">FocusFlow</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Distraction-light focus sessions</p>
            </div>
          </div>
        </div>

        {/* Active session resume card */}
        {isActive && (
          <div className="mb-5 p-3.5 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary">Session in progress</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {timerState.sessionType === 'focus' ? 'Focus' : timerState.sessionType === 'short-break' ? 'Short Break' : 'Long Break'}
                {timerState.taskName && ` · ${timerState.taskName}`}
              </p>
            </div>
            <Button size="sm" onClick={() => navigate('/session')} className="shrink-0 h-8 px-3 text-xs">
              View Session
            </Button>
          </div>
        )}

        {/* First-launch Audio & BGM feature discovery hint */}
        {showAudioHint && !isActive && (
          <div className="mb-5 p-3.5 rounded-xl bg-card border border-primary/25 shadow-sm flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Music className="w-4 h-4 text-primary" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-foreground">Personalize your focus sessions</p>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  You can use Soft White Noise or choose your own music for your focus sessions.{' '}
                  <button
                    onClick={() => {
                      handleDismissHint();
                      navigate('/settings#audio');
                    }}
                    className="text-primary hover:underline font-medium cursor-pointer inline-flex items-center gap-0.5"
                  >
                    Explore Audio & BGM in Settings &rarr;
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

        {/* Quick start */}
        <div className="w-full">
          <h2 className="text-base font-semibold mb-3">Start a Focus Session</h2>

          <div className="mb-3.5">
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
              className="h-10 text-sm"
            />
          </div>

          <div className="flex items-center gap-2.5 mb-5">
            <Button
              size="lg"
              onClick={handleStart}
              className="flex-1 h-11 text-sm font-semibold"
              disabled={isActive}
            >
              <Zap className="w-4 h-4 mr-2" />
              {isActive ? 'Session Active' : 'Start Focus Session'}
            </Button>

            <button
              onClick={toggleBgm}
              className={cn(
                'h-11 w-11 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0',
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
              <Music className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Session details */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="py-2.5 px-3 rounded-lg bg-card border border-border">
              <p className="text-[11px] text-muted-foreground mb-0.5 font-medium">Focus</p>
              <p className="text-sm font-semibold">{formatDurationHuman(settings.focusDurationMs)}</p>
            </div>
            <div className="py-2.5 px-3 rounded-lg bg-card border border-border">
              <p className="text-[11px] text-muted-foreground mb-0.5 font-medium">Short Break</p>
              <p className="text-sm font-semibold">{formatDurationHuman(settings.shortBreakDurationMs)}</p>
            </div>
            <div className="py-2.5 px-3 rounded-lg bg-card border border-border">
              <p className="text-[11px] text-muted-foreground mb-0.5 font-medium">Long Break</p>
              <p className="text-sm font-semibold">{formatDurationHuman(settings.longBreakDurationMs)}</p>
            </div>
          </div>
        </div>

        {/* Today's stats */}
        {todayStats !== null && (
          <div className="mt-6 w-full">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold text-foreground/90 uppercase tracking-wide">Today’s Progress</h3>
              <button
                onClick={() => navigate('/analytics')}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 cursor-pointer transition-colors"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Analytics
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <p className="text-xl font-bold tracking-tight">{formatDurationHuman(todayStats.totalFocusMs)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">of {formatDurationHuman(settings.dailyGoalMs)} goal</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold tracking-tight">{todayStats.completedSessions}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">sessions</p>
                </div>
              </div>
              <Progress value={goalPercent} className="h-2" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
