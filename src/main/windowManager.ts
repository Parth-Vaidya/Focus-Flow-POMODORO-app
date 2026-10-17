import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import { TimerEngine } from '../core/timer/timerEngine';
import { PreferencesStore } from '../core/persistence/preferences';
import { TimerState, WidgetPosition, IPC, AppSettings, ThemeDefinition } from '../shared/types';
import { WIDGET_WIDTH, WIDGET_HEIGHT, WIDGET_MARGIN } from '../shared/constants';

const isDev = process.env.NODE_ENV === 'development';
const RENDERER_URL = 'http://localhost:5173';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private widgetWindow: BrowserWindow | null = null;
  private timerEngine: TimerEngine;
  private prefs: PreferencesStore;

  constructor({ timerEngine, prefs }: { timerEngine: TimerEngine; prefs: PreferencesStore }) {
    this.timerEngine = timerEngine;
    this.prefs = prefs;
  }

  async createMainWindow(): Promise<BrowserWindow> {
    this.mainWindow = new BrowserWindow({
      width: 960,
      height: 680,
      minWidth: 720,
      minHeight: 520,
      show: false,
      backgroundColor: '#0f0f14',
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // needed for preload
        webSecurity: true,
      },
    });

    // Register ready-to-show BEFORE loadURL so it catches the event
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      this.mainWindow?.focus();
    });

    this.mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error(`Main window failed to load ${url}: [${code}] ${desc}`);
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    if (isDev) {
      await this.mainWindow.loadURL(RENDERER_URL + '/index.html');
    } else {
      await this.mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    // Ensure window is shown even if ready-to-show fired during loadURL
    if (this.mainWindow && !this.mainWindow.isVisible()) {
      this.mainWindow.show();
      this.mainWindow.focus();
    }

    return this.mainWindow;
  }

  async createWidgetWindow(): Promise<BrowserWindow> {
    const pos = this.getWidgetPosition();

    this.widgetWindow = new BrowserWindow({
      width: WIDGET_WIDTH,
      height: WIDGET_HEIGHT,
      x: pos.x,
      y: pos.y,
      frame: false,
      transparent: true,
      alwaysOnTop: this.prefs.get('widgetAlwaysOnTop'),
      skipTaskbar: true,
      resizable: false,
      movable: true,
      hasShadow: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: true,
      },
    });

    // Register ready-to-show BEFORE loadURL
    this.widgetWindow.once('ready-to-show', () => {
      this.widgetWindow?.show();
    });

    this.widgetWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error(`Widget window failed to load ${url}: [${code}] ${desc}`);
    });

    this.widgetWindow.on('closed', () => {
      this.widgetWindow = null;
    });

    if (isDev) {
      await this.widgetWindow.loadURL(RENDERER_URL + '/widget.html');
    } else {
      await this.widgetWindow.loadFile(path.join(__dirname, '../../dist/widget.html'));
    }

    // Ensure widget is shown even if ready-to-show fired during loadURL
    if (this.widgetWindow && !this.widgetWindow.isVisible()) {
      this.widgetWindow.show();
    }

    return this.widgetWindow;
  }

  private getWidgetPosition(): { x: number; y: number } {
    const savedPos = this.prefs.get('widgetPosition') as WidgetPosition | null;
    const display = screen.getPrimaryDisplay();
    const { workArea } = display;

    if (savedPos) {
      // Validate position is still on screen
      const allDisplays = screen.getAllDisplays();
      const isOnScreen = allDisplays.some(d => {
        const wa = d.workArea;
        return savedPos.x >= wa.x && savedPos.y >= wa.y &&
               savedPos.x + WIDGET_WIDTH <= wa.x + wa.width &&
               savedPos.y + WIDGET_HEIGHT <= wa.y + wa.height;
      });
      if (isOnScreen) {
        return { x: savedPos.x, y: savedPos.y };
      }
    }

    // Default: right edge, vertically centered
    return {
      x: workArea.x + workArea.width - WIDGET_WIDTH - WIDGET_MARGIN,
      y: workArea.y + Math.floor((workArea.height - WIDGET_HEIGHT) / 2),
    };
  }

  broadcastTimerState(state: TimerState): void {
    const data = JSON.stringify(state);
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('timer:state-update', data);
    }
    if (this.widgetWindow && !this.widgetWindow.isDestroyed()) {
      this.widgetWindow.webContents.send('timer:state-update', data);
    }
  }

  broadcastSettings(settings: AppSettings): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC.SETTINGS_UPDATE, settings);
    }
    if (this.widgetWindow && !this.widgetWindow.isDestroyed()) {
      this.widgetWindow.webContents.send(IPC.SETTINGS_UPDATE, settings);
    }
  }

  broadcastThemes(themes: { builtIn: ThemeDefinition[]; custom: ThemeDefinition[] }): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC.THEMES_UPDATE, themes);
    }
    if (this.widgetWindow && !this.widgetWindow.isDestroyed()) {
      this.widgetWindow.webContents.send(IPC.THEMES_UPDATE, themes);
    }
  }

  focusMainWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isMinimized()) this.mainWindow.restore();
      this.mainWindow.focus();
    } else {
      this.createMainWindow();
    }
  }

  navigateMainWindow(route: string): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('navigate', route);
    }
    this.focusMainWindow();
  }

  showWidget(): void {
    if (!this.widgetWindow) {
      this.createWidgetWindow();
    } else {
      this.widgetWindow.show();
    }
    this.prefs.set('widgetVisible', true);
  }

  hideWidget(): void {
    this.widgetWindow?.hide();
    this.prefs.set('widgetVisible', false);
  }

  setWidgetPosition(pos: WidgetPosition): void {
    this.prefs.set('widgetPosition', pos);
    if (this.widgetWindow) {
      const display = screen.getPrimaryDisplay();
      const { workArea } = display;

      let x = pos.x;
      let y = pos.y;

      // Snap to edge
      switch (pos.edge) {
        case 'right':
          x = workArea.x + workArea.width - WIDGET_WIDTH - WIDGET_MARGIN;
          break;
        case 'left':
          x = workArea.x + WIDGET_MARGIN;
          break;
        case 'top':
          y = workArea.y + WIDGET_MARGIN;
          break;
        case 'bottom':
          y = workArea.y + workArea.height - WIDGET_HEIGHT - WIDGET_MARGIN;
          break;
      }

      // Clamp
      x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - WIDGET_WIDTH));
      y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - WIDGET_HEIGHT));

      this.widgetWindow.setPosition(x, y);
    }
  }

  setWidgetAlwaysOnTop(value: boolean): void {
    this.widgetWindow?.setAlwaysOnTop(value);
    this.prefs.set('widgetAlwaysOnTop', value);
  }

  getMainWindow(): BrowserWindow | null { return this.mainWindow; }
  getWidgetWindow(): BrowserWindow | null { return this.widgetWindow; }
}
