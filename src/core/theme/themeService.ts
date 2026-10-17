import { app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { ThemeDefinition, ThemeColors } from '../../shared/types';

// Built-in theme definitions matching globals.css
export const BUILT_IN_THEMES: ThemeDefinition[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    version: '1.0',
    isCustom: false,
    colors: {
      background: '240 10% 5%',
      foreground: '240 10% 92%',
      card: '240 10% 8%',
      cardForeground: '240 10% 92%',
      popover: '240 10% 9%',
      popoverForeground: '240 10% 92%',
      primary: '280 60% 65%',
      primaryForeground: '0 0% 100%',
      secondary: '240 8% 14%',
      secondaryForeground: '240 10% 80%',
      muted: '240 8% 12%',
      mutedForeground: '240 8% 55%',
      accent: '320 40% 60%',
      accentForeground: '0 0% 100%',
      destructive: '0 65% 50%',
      destructiveForeground: '0 0% 100%',
      border: '240 8% 18%',
      input: '240 8% 14%',
      ring: '280 60% 65%',
      timerFocus: '280 60% 65%',
      timerShortBreak: '162 60% 50%',
      timerLongBreak: '200 80% 60%',
    },
  },
  {
    id: 'dark-burgundy',
    name: 'Dark Burgundy',
    version: '1.0',
    isCustom: false,
    colors: {
      background: '340 20% 6%',
      foreground: '340 10% 90%',
      card: '340 20% 10%',
      cardForeground: '340 10% 90%',
      popover: '340 20% 11%',
      popoverForeground: '340 10% 90%',
      primary: '345 70% 55%',
      primaryForeground: '0 0% 100%',
      secondary: '340 15% 16%',
      secondaryForeground: '340 10% 75%',
      muted: '340 15% 13%',
      mutedForeground: '340 10% 50%',
      accent: '360 60% 65%',
      accentForeground: '0 0% 100%',
      destructive: '0 65% 50%',
      destructiveForeground: '0 0% 100%',
      border: '340 15% 20%',
      input: '340 15% 16%',
      ring: '345 70% 55%',
      timerFocus: '345 70% 55%',
      timerShortBreak: '162 60% 50%',
      timerLongBreak: '200 80% 60%',
    },
  },
  {
    id: 'muted-plum',
    name: 'Muted Plum',
    version: '1.0',
    isCustom: false,
    colors: {
      background: '270 15% 8%',
      foreground: '270 10% 90%',
      card: '270 15% 12%',
      cardForeground: '270 10% 90%',
      popover: '270 15% 13%',
      popoverForeground: '270 10% 90%',
      primary: '290 50% 65%',
      primaryForeground: '0 0% 100%',
      secondary: '270 12% 18%',
      secondaryForeground: '270 10% 75%',
      muted: '270 12% 14%',
      mutedForeground: '270 8% 52%',
      accent: '320 45% 65%',
      accentForeground: '0 0% 100%',
      destructive: '0 65% 50%',
      destructiveForeground: '0 0% 100%',
      border: '270 10% 22%',
      input: '270 12% 18%',
      ring: '290 50% 65%',
      timerFocus: '290 50% 65%',
      timerShortBreak: '162 60% 50%',
      timerLongBreak: '200 80% 60%',
    },
  },
  {
    id: 'warm-sand',
    name: 'Warm Sand',
    version: '1.0',
    isCustom: false,
    colors: {
      background: '35 30% 92%',
      foreground: '35 20% 15%',
      card: '35 25% 95%',
      cardForeground: '35 20% 15%',
      popover: '35 25% 95%',
      popoverForeground: '35 20% 15%',
      primary: '25 70% 40%',
      primaryForeground: '0 0% 100%',
      secondary: '35 20% 85%',
      secondaryForeground: '35 20% 20%',
      muted: '35 20% 87%',
      mutedForeground: '35 15% 45%',
      accent: '15 65% 45%',
      accentForeground: '0 0% 100%',
      destructive: '0 65% 50%',
      destructiveForeground: '0 0% 100%',
      border: '35 15% 80%',
      input: '35 20% 85%',
      ring: '25 70% 40%',
      timerFocus: '25 70% 40%',
      timerShortBreak: '162 50% 40%',
      timerLongBreak: '200 70% 45%',
    },
  },
];

// Helper to convert hex (#rgb or #rrggbb) to "H S% L%" triplet
export function hexToHslTriplet(hex: string): string | null {
  const clean = hex.trim().replace(/^#/, '');
  let r = 0, g = 0, b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  } else {
    return null;
  }
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Normalize color value into Tailwind HSL triplet
export function normalizeColorToTriplet(color: string): string | null {
  const trimmed = color.trim();
  // If already in "H S% L%" format (e.g. "240 10% 5%")
  if (/^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(trimmed)) {
    return trimmed;
  }
  // If hex (e.g. "#10b981")
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return hexToHslTriplet(trimmed);
  }
  // If hsl(H, S%, L%) or hsl(H S% L%)
  const hslMatch = trimmed.match(/^hsla?\(\s*(\d+)[,\s]+(\d+)%?[,\s]+(\d+)%?/i);
  if (hslMatch) {
    return `${hslMatch[1]} ${hslMatch[2]}% ${hslMatch[3]}%`;
  }
  return null;
}

export class ThemeService {
  private themesDir: string;

  constructor() {
    this.themesDir = path.join(app.getPath('userData'), 'themes');
    this.initThemesDir();
  }

  getThemesDirectory(): string {
    return this.themesDir;
  }

  private initThemesDir(): void {
    try {
      if (!fs.existsSync(this.themesDir)) {
        fs.mkdirSync(this.themesDir, { recursive: true });
      }

      const readmePath = path.join(this.themesDir, 'README.txt');
      if (!fs.existsSync(readmePath)) {
        const readmeContent = `FocusFlow Custom Themes Directory
====================================
You can add your own custom themes here!

1. Create a JSON file in this folder (e.g. "my-theme.json").
2. Colors can be in HEX (e.g. "#10b981") or HSL (e.g. "160 84% 39%").
3. Refresh themes from FocusFlow Settings -> Color Schemes.

See "example-theme.json" in this folder for the complete template.
`;
        fs.writeFileSync(readmePath, readmeContent, 'utf8');
      }

      const examplePath = path.join(this.themesDir, 'example-theme.json');
      if (!fs.existsSync(examplePath)) {
        const exampleTheme = {
          id: 'emerald-forest',
          name: 'Emerald Forest',
          version: '1.0',
          author: 'FocusFlow',
          colors: {
            background: '#0a140f',
            foreground: '#e2f2e8',
            card: '#102319',
            cardForeground: '#e2f2e8',
            popover: '#102319',
            popoverForeground: '#e2f2e8',
            primary: '#10b981',
            primaryForeground: '#ffffff',
            secondary: '#173626',
            secondaryForeground: '#c2e5d0',
            muted: '#132c1f',
            mutedForeground: '#6e9e82',
            accent: '#059669',
            accentForeground: '#ffffff',
            destructive: '#ef4444',
            destructiveForeground: '#ffffff',
            border: '#1b4330',
            input: '#173626',
            ring: '#10b981',
            timerFocus: '#10b981',
            timerShortBreak: '#38bdf8',
            timerLongBreak: '#a78bfa',
          },
        };
        fs.writeFileSync(examplePath, JSON.stringify(exampleTheme, null, 2), 'utf8');
      }
    } catch (err) {
      console.warn('Failed to initialize themes directory:', err);
    }
  }

  openThemesFolder(): void {
    try {
      if (!fs.existsSync(this.themesDir)) {
        fs.mkdirSync(this.themesDir, { recursive: true });
      }
      shell.openPath(this.themesDir);
    } catch (err) {
      console.error('Failed to open themes folder:', err);
    }
  }

  getCustomThemes(): ThemeDefinition[] {
    const customThemes: ThemeDefinition[] = [];
    const seenIds = new Set<string>(BUILT_IN_THEMES.map(t => t.id));

    try {
      if (!fs.existsSync(this.themesDir)) return [];
      const files = fs.readdirSync(this.themesDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(this.themesDir, file);

        try {
          const stats = fs.statSync(filePath);
          if (!stats.isFile()) continue;

          const raw = fs.readFileSync(filePath, 'utf8');
          const json = JSON.parse(raw);

          // Validate structure
          if (!json || typeof json !== 'object') continue;
          if (typeof json.id !== 'string' || !json.id.trim()) continue;
          if (typeof json.name !== 'string' || !json.name.trim()) continue;
          if (!json.colors || typeof json.colors !== 'object') continue;

          const id = json.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
          if (seenIds.has(id)) continue; // avoid duplicates

          // Validate required color keys
          const requiredKeys: (keyof ThemeColors)[] = [
            'background', 'foreground', 'card', 'cardForeground',
            'primary', 'primaryForeground', 'secondary', 'secondaryForeground',
            'muted', 'mutedForeground', 'accent', 'accentForeground',
            'destructive', 'destructiveForeground', 'border', 'input', 'ring',
            'timerFocus', 'timerShortBreak', 'timerLongBreak',
          ];

          let valid = true;
          const normalizedColors: Partial<ThemeColors> = {};

          for (const key of requiredKeys) {
            const rawVal = json.colors[key];
            if (typeof rawVal !== 'string') {
              valid = false;
              break;
            }
            const triplet = normalizeColorToTriplet(rawVal);
            if (!triplet) {
              valid = false;
              break;
            }
            normalizedColors[key] = triplet;
          }

          if (!valid) continue;

          // Optional popover fallback
          if (!normalizedColors.popover) {
            normalizedColors.popover = normalizedColors.card;
            normalizedColors.popoverForeground = normalizedColors.cardForeground;
          }

          seenIds.add(id);
          customThemes.push({
            id,
            name: json.name.trim().slice(0, 50),
            version: typeof json.version === 'string' ? json.version : '1.0',
            author: typeof json.author === 'string' ? json.author : undefined,
            isCustom: true,
            colors: normalizedColors as ThemeColors,
          });
        } catch {
          // Ignore invalid file without crashing
        }
      }
    } catch (err) {
      console.warn('Error reading themes directory:', err);
    }

    return customThemes;
  }

  getAllThemes(): { builtIn: ThemeDefinition[]; custom: ThemeDefinition[] } {
    return {
      builtIn: BUILT_IN_THEMES,
      custom: this.getCustomThemes(),
    };
  }
}
