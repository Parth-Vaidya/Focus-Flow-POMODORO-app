export const APP_VERSION = '1.0.0';

export const DEFAULT_SETTINGS = {
  focusDurationMs: 25 * 60 * 1000,
  shortBreakDurationMs: 5 * 60 * 1000,
  longBreakDurationMs: 15 * 60 * 1000,
  longBreakInterval: 4,
  dailyGoalMs: 120 * 60 * 1000,
  timerStyle: 'digital' as const,
  theme: 'midnight' as const,
  showBrownNoise: true,
  brownNoiseVolume: 0.4,
  notificationsEnabled: true,
  alertSoundEnabled: true,
  widgetVisible: true,
  widgetPosition: null,
  widgetAlwaysOnTop: true,
  autoStartBreaks: true,
  autoStartFocus: true,
};

export const RECOVERY_SAVE_INTERVAL_MS = 10_000; // save recovery every 10s

export const MIN_DURATION_MS = 1 * 60 * 1000;    // 1 minute minimum
export const MAX_DURATION_MS = 120 * 60 * 1000;  // 120 minutes maximum
export const MIN_INTERVAL = 1;
export const MAX_INTERVAL = 10;
export const MIN_DAILY_GOAL_MS = 10 * 60 * 1000;
export const MAX_DAILY_GOAL_MS = 480 * 60 * 1000;

export const WIDGET_WIDTH = 220;
export const WIDGET_HEIGHT = 120;
export const WIDGET_MARGIN = 12;

// Timer tick interval in ms
export const TIMER_TICK_MS = 250;
