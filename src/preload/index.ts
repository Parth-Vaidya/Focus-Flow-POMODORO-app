import { contextBridge, ipcRenderer } from 'electron';
import { IPC, AppSettings, WidgetPosition, SessionRecord, ThemeDefinition } from '../shared/types';

// Type for the timer state update listener
type TimerStateListener = (stateJson: string) => void;
type NavigateListener = (route: string) => void;

const timerListeners = new Map<TimerStateListener, (event: Electron.IpcRendererEvent, data: string) => void>();

// Narrow, typed API exposed to the renderer
const focusFlowAPI = {
  // Timer controls
  timer: {
    start: (taskName: string) => ipcRenderer.invoke(IPC.TIMER_START, taskName),
    pause: () => ipcRenderer.invoke(IPC.TIMER_PAUSE),
    resume: () => ipcRenderer.invoke(IPC.TIMER_RESUME),
    skip: () => ipcRenderer.invoke(IPC.TIMER_SKIP),
    restart: () => ipcRenderer.invoke(IPC.TIMER_RESTART),
    stop: () => ipcRenderer.invoke(IPC.TIMER_STOP),
    getState: () => ipcRenderer.invoke(IPC.TIMER_STATE_GET),
    onStateUpdate: (cb: TimerStateListener) => {
      const listener = (_event: Electron.IpcRendererEvent, data: string) => cb(data);
      timerListeners.set(cb, listener);
      ipcRenderer.on(IPC.TIMER_STATE_UPDATE, listener);
    },
    offStateUpdate: (cb: TimerStateListener) => {
      const listener = timerListeners.get(cb);
      if (listener) {
        ipcRenderer.removeListener(IPC.TIMER_STATE_UPDATE, listener);
        timerListeners.delete(cb);
      }
    },
  },

  // Settings
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set: (updates: Partial<AppSettings>) => ipcRenderer.invoke(IPC.SETTINGS_SET, updates),
    reset: () => ipcRenderer.invoke(IPC.SETTINGS_RESET),
    onUpdate: (cb: (settings: AppSettings) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: AppSettings) => cb(data);
      ipcRenderer.on(IPC.SETTINGS_UPDATE, listener);
      return () => {
        ipcRenderer.removeListener(IPC.SETTINGS_UPDATE, listener);
      };
    },
  },

  // Session history
  history: {
    get: (options?: { limit?: number; offset?: number; taskName?: string }): Promise<SessionRecord[]> =>
      ipcRenderer.invoke(IPC.HISTORY_GET, options),
    delete: (id: string) => ipcRenderer.invoke(IPC.HISTORY_DELETE, id),
    clear: () => ipcRenderer.invoke(IPC.HISTORY_CLEAR),
    exportCsv: () => ipcRenderer.invoke(IPC.HISTORY_EXPORT_CSV),
  },

  // Analytics
  analytics: {
    get: (days?: number) => ipcRenderer.invoke(IPC.ANALYTICS_GET, days),
    getDaily: () => ipcRenderer.invoke(IPC.ANALYTICS_DAILY),
    getStreaks: () => ipcRenderer.invoke(IPC.ANALYTICS_STREAKS),
  },

  // Widget
  widget: {
    show: () => ipcRenderer.invoke(IPC.WIDGET_SHOW),
    hide: () => ipcRenderer.invoke(IPC.WIDGET_HIDE),
    setPosition: (pos: WidgetPosition) => ipcRenderer.invoke(IPC.WIDGET_SET_POSITION, pos),
    getPosition: () => ipcRenderer.invoke(IPC.WIDGET_GET_POSITION),
    focusMain: (route?: string) => ipcRenderer.invoke(IPC.MAIN_FOCUS, route),
  },

  // Audio
  audio: {
    startBrownNoise: (volume?: number) => ipcRenderer.invoke(IPC.AUDIO_BROWN_NOISE_START, volume),
    stopBrownNoise: () => ipcRenderer.invoke(IPC.AUDIO_BROWN_NOISE_STOP),
    setBrownNoiseVolume: (volume: number) => ipcRenderer.invoke(IPC.AUDIO_BROWN_NOISE_VOLUME, volume),
    playAlert: () => ipcRenderer.invoke(IPC.AUDIO_ALERT),
  },

  // Themes
  themes: {
    getAll: (): Promise<{ builtIn: ThemeDefinition[]; custom: ThemeDefinition[] }> =>
      ipcRenderer.invoke(IPC.THEMES_GET_ALL),
    openFolder: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.THEMES_OPEN_FOLDER),
    refresh: (): Promise<{ builtIn: ThemeDefinition[]; custom: ThemeDefinition[] }> =>
      ipcRenderer.invoke(IPC.THEMES_REFRESH),
    onUpdate: (cb: (themes: { builtIn: ThemeDefinition[]; custom: ThemeDefinition[] }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { builtIn: ThemeDefinition[]; custom: ThemeDefinition[] }) => cb(data);
      ipcRenderer.on(IPC.THEMES_UPDATE, listener);
      return () => {
        ipcRenderer.removeListener(IPC.THEMES_UPDATE, listener);
      };
    },
  },

  // Recovery
  recovery: {
    get: () => ipcRenderer.invoke(IPC.RECOVERY_GET),
    resume: () => ipcRenderer.invoke(IPC.RECOVERY_RESUME),
    dismiss: () => ipcRenderer.invoke(IPC.RECOVERY_DISMISS),
  },

  // Navigation (from main to renderer)
  onNavigate: (cb: NavigateListener) => {
    ipcRenderer.on(IPC.NAVIGATE, (_event, route) => cb(route));
  },

  // App info
  getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP_VERSION),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),

  // Platform info
  platform: process.platform,
};

contextBridge.exposeInMainWorld('focusFlow', focusFlowAPI);

export type FocusFlowAPI = typeof focusFlowAPI;
