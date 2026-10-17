import React from 'react';
import { cn } from '../lib/utils';
import { TimerState } from '../../shared/types';
import { useSettingsStore } from '../stores/settingsStore';

interface Props {
  timerState: TimerState;
  size?: 'sm' | 'md' | 'lg';
  showRing?: boolean;
}

const SESSION_LABELS: Record<string, string> = {
  focus: 'Focus',
  'short-break': 'Short Break',
  'long-break': 'Long Break',
};

const formatTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

function CircularTimer({ timerState, size }: { timerState: TimerState; size: 'sm' | 'md' | 'lg' }) {
  const progress = timerState.totalDurationMs > 0
    ? Math.max(0, Math.min(1, timerState.remainingMs / timerState.totalDurationMs))
    : 1;

  const dims = { sm: 140, md: 220, lg: 280 };
  const strokeWidths = { sm: 6, md: 8, lg: 10 };
  const textSizes = { sm: 'text-2xl', md: 'text-4xl', lg: 'text-6xl' };

  const dim = dims[size];
  const stroke = strokeWidths[size];
  const r = (dim - stroke) / 2;
  const cx = dim / 2;
  const cy = dim / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - progress);

  const colorClass = {
    focus: 'stroke-[hsl(var(--timer-focus))]',
    'short-break': 'stroke-[hsl(var(--timer-short-break))]',
    'long-break': 'stroke-[hsl(var(--timer-long-break))]',
  }[timerState.sessionType] || 'stroke-primary';

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: dim, height: dim }}>
      <svg
        width={dim}
        height={dim}
        className="absolute inset-0 -rotate-90 pointer-events-none"
        aria-hidden
      >
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
        />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          className={cn('timer-ring-progress', colorClass)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className={cn('font-mono font-bold tabular-nums tracking-tight', textSizes[size])}>
          {formatTime(timerState.remainingMs)}
        </span>
        {size !== 'sm' && (
          <span className="text-muted-foreground text-sm mt-1">
            {SESSION_LABELS[timerState.sessionType]}
          </span>
        )}
      </div>
    </div>
  );
}

export default function TimerDisplay({ timerState, size = 'lg', showRing = true }: Props) {
  const timerStyle = useSettingsStore(s => s.settings.timerStyle);

  if (timerStyle === 'circular' && showRing) {
    return <CircularTimer timerState={timerState} size={size} />;
  }

  const textSizes = { sm: 'text-3xl', md: 'text-5xl', lg: 'text-7xl' };

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <span
        className={cn(
          'font-mono font-bold tabular-nums tracking-tighter',
          textSizes[size]
        )}
        aria-live="polite"
        aria-atomic
        aria-label={`${SESSION_LABELS[timerState.sessionType]}: ${formatTime(timerState.remainingMs)} remaining`}
      >
        {formatTime(timerState.remainingMs)}
      </span>
      {size !== 'sm' && (
        <span className="text-muted-foreground text-sm">
          {SESSION_LABELS[timerState.sessionType]}
        </span>
      )}
    </div>
  );
}
