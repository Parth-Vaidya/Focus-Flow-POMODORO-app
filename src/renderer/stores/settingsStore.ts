import { create } from 'zustand';
import { AppSettings } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/constants';

interface SettingsStoreState {
  settings: AppSettings;
  loading: boolean;
  load: () => Promise<void>;
  update: (updates: Partial<AppSettings>) => Promise<void>;
  reset: () => Promise<void>;
}

let settingsListenerRegistered = false;

export const useSettingsStore = create<SettingsStoreState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loading: true,

  load: async () => {
    if (!settingsListenerRegistered && window.focusFlow?.settings?.onUpdate) {
      settingsListenerRegistered = true;
      window.focusFlow.settings.onUpdate((newSettings) => {
        set({ settings: newSettings });
      });
    }
    try {
      const settings = await window.focusFlow.settings.get();
      set({ settings, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  update: async (updates) => {
    const current = get().settings;
    const optimistic = { ...current, ...updates };
    set({ settings: optimistic });
    try {
      await window.focusFlow.settings.set(updates);
      // Re-fetch to get validated values
      const settings = await window.focusFlow.settings.get();
      set({ settings });
    } catch {
      // Revert
      set({ settings: current });
    }
  },

  reset: async () => {
    try {
      const settings = await window.focusFlow.settings.reset();
      set({ settings });
    } catch {}
  },
}));
