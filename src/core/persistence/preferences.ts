import Store from 'electron-store';
import { AppSettings } from '../../shared/types';
import {
  DEFAULT_SETTINGS,
  MIN_DURATION_MS,
  MAX_DURATION_MS,
  MIN_INTERVAL,
  MAX_INTERVAL,
  MIN_TOTAL_SESSIONS,
  MAX_TOTAL_SESSIONS,
  MIN_DAILY_GOAL_MS,
  MAX_DAILY_GOAL_MS,
} from '../../shared/constants';

export class PreferencesStore {
  private store: Store<AppSettings>;

  constructor() {
    this.store = new Store<AppSettings>({
      name: 'preferences',
      defaults: DEFAULT_SETTINGS,
    });
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.store.get(key);
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.set(key, value);
  }

  getAll(): AppSettings {
    return this.store.store as AppSettings;
  }

  setMany(updates: Partial<AppSettings>): void {
    // Validate and clamp values
    const validated = this.validate(updates);
    for (const [key, value] of Object.entries(validated)) {
      this.store.set(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
    }
  }

  reset(): void {
    this.store.clear();
    this.store.set(DEFAULT_SETTINGS as unknown as AppSettings);
  }

  private validate(updates: Partial<AppSettings>): Partial<AppSettings> {
    const result: Partial<AppSettings> = { ...updates };

    if ('focusDurationMs' in result && typeof result.focusDurationMs === 'number') {
      result.focusDurationMs = Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, result.focusDurationMs));
    }
    if ('shortBreakDurationMs' in result && typeof result.shortBreakDurationMs === 'number') {
      result.shortBreakDurationMs = Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, result.shortBreakDurationMs));
    }
    if ('longBreakDurationMs' in result && typeof result.longBreakDurationMs === 'number') {
      result.longBreakDurationMs = Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, result.longBreakDurationMs));
    }
    if ('longBreakInterval' in result && typeof result.longBreakInterval === 'number') {
      result.longBreakInterval = Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, Math.round(result.longBreakInterval)));
    }
    if ('totalFocusSessions' in result && typeof result.totalFocusSessions === 'number') {
      result.totalFocusSessions = Math.max(MIN_TOTAL_SESSIONS, Math.min(MAX_TOTAL_SESSIONS, Math.round(result.totalFocusSessions)));
    }
    if ('dailyGoalMs' in result && typeof result.dailyGoalMs === 'number') {
      result.dailyGoalMs = Math.max(MIN_DAILY_GOAL_MS, Math.min(MAX_DAILY_GOAL_MS, result.dailyGoalMs));
    }
    if ('brownNoiseVolume' in result && typeof result.brownNoiseVolume === 'number') {
      result.brownNoiseVolume = Math.max(0, Math.min(1, result.brownNoiseVolume));
    }
    if ('audioVolume' in result && typeof result.audioVolume === 'number') {
      result.audioVolume = Math.max(0, Math.min(1, result.audioVolume));
    }
    if ('audioSource' in result && typeof result.audioSource === 'string') {
      if (!['tracks', 'brown-noise'].includes(result.audioSource)) {
        result.audioSource = 'tracks';
      }
    }
    if ('audioMode' in result && typeof result.audioMode === 'string') {
      if (!['single', 'sequential', 'shuffle'].includes(result.audioMode)) {
        result.audioMode = 'sequential';
      }
    }
    if ('widgetDockEdge' in result && typeof result.widgetDockEdge === 'string') {
      if (!['left', 'right', 'top', 'bottom'].includes(result.widgetDockEdge)) {
        result.widgetDockEdge = 'right';
      }
    }
    if ('historyItemsPerPage' in result && typeof result.historyItemsPerPage === 'number') {
      result.historyItemsPerPage = Math.max(5, Math.min(100, Math.round(result.historyItemsPerPage)));
    }

    return result;
  }
}
