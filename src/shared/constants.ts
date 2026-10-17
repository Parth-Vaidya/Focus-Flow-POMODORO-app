export const APP_VERSION = '1.0.0';

export const DEFAULT_SETTINGS = {
  focusDurationMs: 25 * 60 * 1000,
  shortBreakDurationMs: 5 * 60 * 1000,
  longBreakDurationMs: 15 * 60 * 1000,
  longBreakInterval: 4,
  dailyGoalMs: 120 * 60 * 1000,
  timerStyle: 'digital' as const,
  theme: 'midnight',
  // Audio defaults
  audioEnabled: false,
  audioVolume: 0.5,
  audioMode: 'sequential' as const,
  audioTrackId: null as string | null,
  playAudioDuringBreaks: false,
  // Notifications & alerts
  notificationsEnabled: true,
  alertSoundEnabled: true,
  // Widget defaults
  widgetVisible: true,
  widgetPosition: null,
  widgetAlwaysOnTop: true,
  widgetDockEdge: 'right' as const,
  // History defaults
  historyItemsPerPage: 25,
  // Legacy compatibility
  showBrownNoise: false,
  brownNoiseVolume: 0.4,
  autoStartBreaks: false,
  autoStartFocus: false,
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
