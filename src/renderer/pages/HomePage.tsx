import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer, BarChart2, Volume2, VolumeX, Zap } from 'lucide-react';
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

  const { start, timerState } = useTimerStore();
  const settings = useSettingsStore(s => s.settings);
  const { brownNoiseActive, toggleBrownNoise } = useAudioStore();

  const isActive = timerState.status === 'running' || timerState.status === 'paused';

  useEffect(() => {
    window.focusFlow.analytics.getDaily().then((stats: any) => {
      setTodayStats(stats);
    }).catch(() => {});
  }, []);

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
    <div className="flex flex-col min-h-full p-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Timer className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">FocusFlow</h1>
            <p className="text-sm text-muted-foreground">Distraction-light focus sessions</p>
          </div>
        </div>
      </div>

      {/* Active session resume card */}
      {isActive && (
        <div className="mb-6 p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-primary">Session in progress</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {timerState.sessionType === 'focus' ? 'Focus' : timerState.sessionType === 'short-break' ? 'Short Break' : 'Long Break'}
              {timerState.taskName && ` · ${timerState.taskName}`}
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/session')}>View Session</Button>
        </div>
      )}

      {/* Quick start */}
      <div className="max-w-md">
        <h2 className="text-lg font-semibold mb-4">Start a Focus Session</h2>

        <div className="mb-4">
          <label htmlFor="task-name" className="text-sm text-muted-foreground mb-1.5 block">
            Task name <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <Input
            id="task-name"
            value={taskName}
            onChange={e => setTaskName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What are you working on?"
            maxLength={200}
          />
        </div>

        <div className="flex items-center gap-3 mb-6">
          <Button
            size="lg"
            onClick={handleStart}
            className="flex-1"
            disabled={isActive}
          >
            <Zap className="w-4 h-4 mr-2" />
            {isActive ? 'Session Active' : 'Start Focus Session'}
          </Button>

          <button
            onClick={toggleBrownNoise}
            className={cn(
              'h-12 w-12 rounded-md border flex items-center justify-center transition-colors cursor-pointer',
              brownNoiseActive
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            )}
            aria-label={brownNoiseActive ? 'Stop brown noise' : 'Start brown noise'}
            title={brownNoiseActive ? 'Stop brown noise' : 'Start brown noise'}
          >
            {brownNoiseActive ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>

        {/* Session details */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-card border border-border">
            <p className="text-xs text-muted-foreground mb-1">Focus</p>
            <p className="text-sm font-semibold">{formatDurationHuman(settings.focusDurationMs)}</p>
          </div>
          <div className="p-3 rounded-lg bg-card border border-border">
            <p className="text-xs text-muted-foreground mb-1">Short Break</p>
            <p className="text-sm font-semibold">{formatDurationHuman(settings.shortBreakDurationMs)}</p>
          </div>
          <div className="p-3 rounded-lg bg-card border border-border">
            <p className="text-xs text-muted-foreground mb-1">Long Break</p>
            <p className="text-sm font-semibold">{formatDurationHuman(settings.longBreakDurationMs)}</p>
          </div>
        </div>
      </div>

      {/* Today's stats */}
      {todayStats !== null && (
        <div className="mt-10 max-w-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Today’s Progress</h3>
            <button
              onClick={() => navigate('/analytics')}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 cursor-pointer"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Analytics
            </button>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-2xl font-bold">{formatDurationHuman(todayStats.totalFocusMs)}</p>
                <p className="text-xs text-muted-foreground">of {formatDurationHuman(settings.dailyGoalMs)} goal</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{todayStats.completedSessions}</p>
                <p className="text-xs text-muted-foreground">sessions</p>
              </div>
            </div>
            <Progress value={goalPercent} className="h-2" />
          </div>
        </div>
      )}
    </div>
  );
}
