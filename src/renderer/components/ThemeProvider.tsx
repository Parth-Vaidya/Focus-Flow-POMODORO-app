import React, { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useThemeStore } from '../stores/themeStore';
import { ThemeColors } from '../../shared/types';

const BUILT_IN_IDS = new Set(['midnight', 'dark-burgundy', 'muted-plum', 'warm-sand']);

const THEME_COLOR_VARS: Record<keyof ThemeColors, string> = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  border: '--border',
  input: '--input',
  ring: '--ring',
  timerFocus: '--timer-focus',
  timerShortBreak: '--timer-short-break',
  timerLongBreak: '--timer-long-break',
};

function clearCustomThemeVars(): void {
  const root = document.documentElement;
  for (const varName of Object.values(THEME_COLOR_VARS)) {
    root.style.removeProperty(varName);
  }
}

function applyCustomThemeVars(colors: ThemeColors): void {
  const root = document.documentElement;
  for (const [key, varName] of Object.entries(THEME_COLOR_VARS) as [keyof ThemeColors, string][]) {
    if (colors[key]) {
      root.style.setProperty(varName, colors[key]);
    }
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore(s => s.settings.theme);
  const { themes, load } = useThemeStore();

  useEffect(() => {
    // Ensure theme definitions are loaded
    if (themes.builtIn.length === 0 && window.focusFlow?.themes) {
      load();
    }
  }, [load, themes.builtIn.length]);

  useEffect(() => {
    if (BUILT_IN_IDS.has(theme)) {
      // Built-in theme: rely on globals.css data-theme selector
      clearCustomThemeVars();
      document.documentElement.setAttribute('data-theme', theme);
      return;
    }

    // Custom theme: search loaded custom themes
    const customMatch = themes.custom.find(t => t.id === theme);
    if (customMatch) {
      document.documentElement.setAttribute('data-theme', customMatch.id);
      applyCustomThemeVars(customMatch.colors);
    } else {
      // If not found in current memory, try loading latest themes from main process
      load().then(() => {
        const latestMatch = useThemeStore.getState().themes.custom.find(t => t.id === theme);
        if (latestMatch) {
          document.documentElement.setAttribute('data-theme', latestMatch.id);
          applyCustomThemeVars(latestMatch.colors);
        } else if (useThemeStore.getState().themes.builtIn.length > 0) {
          // Themes loaded and still not found: fallback gracefully without corrupting stored settings
          clearCustomThemeVars();
          document.documentElement.setAttribute('data-theme', 'midnight');
        }
      }).catch(() => {
        clearCustomThemeVars();
        document.documentElement.setAttribute('data-theme', 'midnight');
      });
    }
  }, [theme, themes, load]);

  return <>{children}</>;
}
