import { create } from 'zustand';
import { ThemeDefinition } from '../../shared/types';

interface ThemeStoreState {
  themes: { builtIn: ThemeDefinition[]; custom: ThemeDefinition[] };
  loading: boolean;
  load: () => Promise<void>;
  refresh: () => Promise<{ builtIn: ThemeDefinition[]; custom: ThemeDefinition[] }>;
  openFolder: () => Promise<{ ok: boolean; error?: string }>;
}

let themesListenerRegistered = false;

export const useThemeStore = create<ThemeStoreState>()((set) => ({
  themes: { builtIn: [], custom: [] },
  loading: false,

  load: async () => {
    if (!themesListenerRegistered && window.focusFlow?.themes?.onUpdate) {
      themesListenerRegistered = true;
      window.focusFlow.themes.onUpdate((newThemes) => {
        set({ themes: newThemes || { builtIn: [], custom: [] } });
      });
    }
    try {
      set({ loading: true });
      const themes = await window.focusFlow.themes.getAll();
      set({ themes: themes || { builtIn: [], custom: [] }, loading: false });
    } catch (err) {
      console.warn('Failed to load themes:', err);
      set({ loading: false });
    }
  },

  refresh: async () => {
    try {
      set({ loading: true });
      const themes = await window.focusFlow.themes.refresh();
      set({ themes: themes || { builtIn: [], custom: [] }, loading: false });
      return themes;
    } catch (err) {
      console.warn('Failed to refresh themes:', err);
      set({ loading: false });
      throw err;
    }
  },

  openFolder: async () => {
    try {
      return await window.focusFlow.themes.openFolder();
    } catch (err) {
      console.error('Failed to open themes folder:', err);
      return { ok: false, error: String(err) };
    }
  },
}));
