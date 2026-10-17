// Shared types used across main, preload, and renderer

export type SessionType = 'focus' | 'short-break' | 'long-break';

export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'skipped' | 'stopped' | 'interrupted';

export type TimerStyle = 'digital' | 'circular';

export type Theme = 'midnight' | 'dark-burgundy' | 'muted-plum' | 'warm-sand';

export interface TimerState {
  sessionType: SessionType;
  status: SessionStatus;
  remainingMs: number;
  totalDurationMs: number;
  taskName: string;
  /** How many focus sessions completed in current cycle (0-3) */
  cycleCount: number;
  /** Total completed focus sessions today */
  completedTodayCount: number;
  /** Active focus ms accumulated today */
  activeFocusMsToday: number;
  /** Active focus ms in this session so far (excludes paused time) */
  sessionActiveFocusMs: number;
  startedAt: number | null; // unix ms
  pausedAt: number | null;  // unix ms
  sessionId: string | null; // UUID for dedup
}

export interface SessionRecord {
  id: string;
  sessionType: SessionType;
  taskName: string | null;
  configuredDurationMs: number;
  startedAt: number; // unix ms
  endedAt: number;   // unix ms
  activeFocusMs: number;
  status: SessionStatus;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  totalFocusMs: number;
  completedSessions: number;
  goalReached: boolean;
}

export interface AppSettings {
  focusDurationMs: number;
  shortBreakDurationMs: number;
  longBreakDurationMs: number;
  longBreakInterval: number; // completed focus sessions before long break
  dailyGoalMs: number;
  timerStyle: TimerStyle;
  theme: Theme;
  showBrownNoise: boolean;
  brownNoiseVolume: number; // 0-1
  notificationsEnabled: boolean;
  alertSoundEnabled: boolean;
  widgetVisible: boolean;
  widgetPosition: WidgetPosition | null;
  widgetAlwaysOnTop: boolean;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
}

export interface WidgetPosition {
  x: number;
  y: number;
  edge: 'left' | 'right' | 'top' | 'bottom';
}

export interface RecoveryState {
  timerState: TimerState;
  savedAt: number; // unix ms
  appVersion: string;
}

// IPC channel names
export const IPC = {
  // Timer control (renderer -> main)
  TIMER_START: 'timer:start',
  TIMER_PAUSE: 'timer:pause',
  TIMER_RESUME: 'timer:resume',
  TIMER_SKIP: 'timer:skip',
  TIMER_RESTART: 'timer:restart',
  TIMER_STOP: 'timer:stop',

  // Timer state (main -> renderer, bidirectional)
  TIMER_STATE_UPDATE: 'timer:state-update',
  TIMER_STATE_GET: 'timer:state-get',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_RESET: 'settings:reset',

  // Session history
  HISTORY_GET: 'history:get',
  HISTORY_DELETE: 'history:delete',
  HISTORY_CLEAR: 'history:clear',
  HISTORY_EXPORT_CSV: 'history:export-csv',

  // Analytics
  ANALYTICS_GET: 'analytics:get',
  ANALYTICS_DAILY: 'analytics:daily',
  ANALYTICS_STREAKS: 'analytics:streaks',

  // Widget
  WIDGET_SHOW: 'widget:show',
  WIDGET_HIDE: 'widget:hide',
  WIDGET_SET_POSITION: 'widget:set-position',
  WIDGET_GET_POSITION: 'widget:get-position',
  MAIN_FOCUS: 'main:focus',
  NAVIGATE: 'navigate',

  // Brown noise
  AUDIO_BROWN_NOISE_START: 'audio:brown-noise-start',
  AUDIO_BROWN_NOISE_STOP: 'audio:brown-noise-stop',
  AUDIO_BROWN_NOISE_VOLUME: 'audio:brown-noise-volume',
  AUDIO_ALERT: 'audio:alert',

  // Notifications
  NOTIFY: 'notify',

  // Recovery
  RECOVERY_GET: 'recovery:get',
  RECOVERY_DISMISS: 'recovery:dismiss',

  // App
  APP_VERSION: 'app:version',
  OPEN_EXTERNAL: 'open-external',
} as const;

export type IpcChannels = typeof IPC[keyof typeof IPC];
