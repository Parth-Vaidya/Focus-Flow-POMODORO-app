import { BrowserWindow, screen, app, Rectangle } from 'electron';
import path from 'path';
import { TimerEngine } from '../core/timer/timerEngine';
import { PreferencesStore } from '../core/persistence/preferences';
import { TimerState, WidgetPosition, IPC, AppSettings, ThemeDefinition } from '../shared/types';
import { WIDGET_WIDTH, WIDGET_HEIGHT, COMPACT_WIDGET_WIDTH, COMPACT_WIDGET_HEIGHT, WIDGET_MARGIN } from '../shared/constants';

const isDev = process.env.NODE_ENV === 'development';
const RENDERER_URL = 'http://localhost:5173';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private widgetWindow: BrowserWindow | null = null;
  private timerEngine: TimerEngine;
  private prefs: PreferencesStore;
  private isWidgetDismissed = false;
  private isQuitting = false;
  private isMainWindowDeliberatelyClosed = false;
  private isWidgetCompact = false;
  private isProgrammaticMove = false;
  private dragStartOffset: { x: number; y: number } | null = null;
  private dragWorkArea: Rectangle | null = null;

  constructor({ timerEngine, prefs }: { timerEngine: TimerEngine; prefs: PreferencesStore }) {
    this.timerEngine = timerEngine;
    this.prefs = prefs;
  }

  setQuitting(val: boolean): void {
    this.isQuitting = val;
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

    this.mainWindow.on('close', (e) => {
      if (this.isQuitting) {
        return;
      }

      const timerState = this.timerEngine.getState();
      const isSessionActive = timerState.status === 'running' || timerState.status === 'paused';

      if (isSessionActive) {
        // Active session or break: do NOT quit or destroy. Hide main window.
        e.preventDefault();
        this.isMainWindowDeliberatelyClosed = true;
        this.mainWindow?.hide();
      } else {
        // Idle: user closed window while idle.
        // On non-macOS, destroy the widget window too so app shuts down cleanly.
        if (process.platform !== 'darwin') {
          if (this.widgetWindow && !this.widgetWindow.isDestroyed()) {
            this.widgetWindow.destroy();
            this.widgetWindow = null;
          }
        }
      }
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

  async createWidgetWindow(show = false): Promise<BrowserWindow> {
    if (this.widgetWindow && !this.widgetWindow.isDestroyed()) {
      if (show && !this.widgetWindow.isVisible()) {
        this.widgetWindow.show();
      }
      return this.widgetWindow;
    }

    const pos = this.getWidgetPosition();

    this.widgetWindow = new BrowserWindow({
      width: WIDGET_WIDTH,
      height: WIDGET_HEIGHT,
      x: pos.x,
      y: pos.y,
      frame: false,
      transparent: true,
      alwaysOnTop: this.prefs.get('widgetAlwaysOnTop') !== false,
      skipTaskbar: true,
      resizable: false,
      movable: true,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // needed for preload
        webSecurity: true,
      },
    });

    if (this.prefs.get('widgetAlwaysOnTop') !== false) {
      this.widgetWindow.setAlwaysOnTop(true, 'screen-saver');
      this.widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }

    if (show) {
      this.widgetWindow.once('ready-to-show', () => {
        this.widgetWindow?.show();
        this.widgetWindow?.setAlwaysOnTop(true, 'screen-saver');
      });
    }

    this.widgetWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error(`Widget window failed to load ${url}: [${code}] ${desc}`);
    });

    this.widgetWindow.on('moved', () => {
      if (this.isProgrammaticMove) return;
      if (this.widgetWindow && !this.widgetWindow.isDestroyed()) {
        const [x, y] = this.widgetWindow.getPosition();
        const [w, h] = this.widgetWindow.getSize();
        const edge = this.calculateNearestEdge(x, y, w, h);
        const position: WidgetPosition = { x, y, edge };
        this.prefs.set('widgetPosition', position);
      }
    });

    this.widgetWindow.on('closed', () => {
      this.widgetWindow = null;
    });

    if (isDev) {
      await this.widgetWindow.loadURL(RENDERER_URL + '/widget.html');
    } else {
      await this.widgetWindow.loadFile(path.join(__dirname, '../../dist/widget.html'));
    }

    if (show && this.widgetWindow && !this.widgetWindow.isVisible()) {
      this.widgetWindow.show();
      this.widgetWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    return this.widgetWindow;
  }

  private calculateNearestEdge(
    x: number,
    y: number,
    width = WIDGET_WIDTH,
    height = WIDGET_HEIGHT
  ): 'left' | 'right' | 'top' | 'bottom' {
    const display = screen.getDisplayMatching({ x, y, width, height }) || screen.getPrimaryDisplay();
    const { workArea } = display;

    const distLeft = Math.abs(x - (workArea.x + WIDGET_MARGIN));
    const distRight = Math.abs((workArea.x + workArea.width - width - WIDGET_MARGIN) - x);
    const distTop = Math.abs(y - (workArea.y + WIDGET_MARGIN));
    const distBottom = Math.abs((workArea.y + workArea.height - height - WIDGET_MARGIN) - y);

    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    if (minDist === distRight) return 'right';
    if (minDist === distLeft) return 'left';
    if (minDist === distTop) return 'top';
    return 'bottom';
  }

  setWidgetCompact(compact: boolean): void {
    if (!this.widgetWindow || this.widgetWindow.isDestroyed()) return;
    if (this.isWidgetCompact === compact) return;

    this.isWidgetCompact = compact;
    const [currentX, currentY] = this.widgetWindow.getPosition();
    const currentWidth = compact ? WIDGET_WIDTH : COMPACT_WIDGET_WIDTH;
    const currentHeight = compact ? WIDGET_HEIGHT : COMPACT_WIDGET_HEIGHT;

    const targetWidth = compact ? COMPACT_WIDGET_WIDTH : WIDGET_WIDTH;
    const targetHeight = compact ? COMPACT_WIDGET_HEIGHT : WIDGET_HEIGHT;

    const display = screen.getDisplayMatching({
      x: currentX,
      y: currentY,
      width: currentWidth,
      height: currentHeight,
    }) || screen.getPrimaryDisplay();
    const { workArea } = display;

    let newX = currentX;
    let newY = currentY;

    // Anchor logic: preserve dock edge position
    const isCloserToRight = (currentX + currentWidth / 2) > (workArea.x + workArea.width / 2);
    if (isCloserToRight) {
      newX = currentX + (currentWidth - targetWidth);
    }

    const isCloserToBottom = (currentY + currentHeight / 2) > (workArea.y + workArea.height / 2);
    if (isCloserToBottom) {
      newY = currentY + (currentHeight - targetHeight);
    }

    // Clamp coordinates within workArea
    newX = Math.round(Math.max(workArea.x + WIDGET_MARGIN, Math.min(newX, workArea.x + workArea.width - targetWidth - WIDGET_MARGIN)));
    newY = Math.round(Math.max(workArea.y + WIDGET_MARGIN, Math.min(newY, workArea.y + workArea.height - targetHeight - WIDGET_MARGIN)));

    this.isProgrammaticMove = true;
    this.widgetWindow.setBounds({
      x: newX,
      y: newY,
      width: Math.round(targetWidth),
      height: Math.round(targetHeight),
    });
    this.widgetWindow.setAlwaysOnTop(true, 'screen-saver');

    const edge = this.calculateNearestEdge(newX, newY, targetWidth, targetHeight);
    this.prefs.set('widgetPosition', { x: newX, y: newY, edge });

    setTimeout(() => {
      this.isProgrammaticMove = false;
    }, 150);
  }

  handleDragStart(screenX: number, screenY: number): void {
    if (!this.widgetWindow || this.widgetWindow.isDestroyed()) return;
    const intX = Math.round(screenX);
    const intY = Math.round(screenY);
    if (!Number.isFinite(intX) || !Number.isFinite(intY)) return;

    this.isProgrammaticMove = true;
    const [winX, winY] = this.widgetWindow.getPosition();
    this.dragStartOffset = { x: intX - winX, y: intY - winY };

    const targetWidth = this.isWidgetCompact ? COMPACT_WIDGET_WIDTH : WIDGET_WIDTH;
    const targetHeight = this.isWidgetCompact ? COMPACT_WIDGET_HEIGHT : WIDGET_HEIGHT;
    const [currentW, currentH] = this.widgetWindow.getSize();
    if (currentW !== targetWidth || currentH !== targetHeight) {
      this.widgetWindow.setBounds({
        x: winX,
        y: winY,
        width: targetWidth,
        height: targetHeight,
      });
    }

    const display = screen.getDisplayNearestPoint({ x: intX, y: intY }) || screen.getPrimaryDisplay();
    this.dragWorkArea = display.workArea;
  }

  handleDragMove(screenX: number, screenY: number): void {
    if (!this.widgetWindow || this.widgetWindow.isDestroyed() || !this.dragStartOffset) return;

    const intX = Math.round(screenX);
    const intY = Math.round(screenY);
    if (!Number.isFinite(intX) || !Number.isFinite(intY)) return;

    const targetWidth = this.isWidgetCompact ? COMPACT_WIDGET_WIDTH : WIDGET_WIDTH;
    const targetHeight = this.isWidgetCompact ? COMPACT_WIDGET_HEIGHT : WIDGET_HEIGHT;

    // Fast-path: reuse cached workArea unless pointer moved outside current monitor
    let workArea = this.dragWorkArea;
    if (
      !workArea ||
      intX < workArea.x ||
      intX > workArea.x + workArea.width ||
      intY < workArea.y ||
      intY > workArea.y + workArea.height
    ) {
      const display = screen.getDisplayNearestPoint({ x: intX, y: intY }) || screen.getPrimaryDisplay();
      workArea = display.workArea;
      this.dragWorkArea = workArea;
    }

    const rawX = intX - this.dragStartOffset.x;
    const rawY = intY - this.dragStartOffset.y;

    // Clamp coordinates strictly within workArea as integers
    const clampedX = Math.round(Math.max(workArea.x, Math.min(rawX, workArea.x + workArea.width - targetWidth)));
    const clampedY = Math.round(Math.max(workArea.y, Math.min(rawY, workArea.y + workArea.height - targetHeight)));

    if (Number.isFinite(clampedX) && Number.isFinite(clampedY)) {
      const [currentX, currentY] = this.widgetWindow.getPosition();
      const [currentW, currentH] = this.widgetWindow.getSize();
      if (currentX !== clampedX || currentY !== clampedY || currentW !== targetWidth || currentH !== targetHeight) {
        this.widgetWindow.setBounds({
          x: clampedX,
          y: clampedY,
          width: targetWidth,
          height: targetHeight,
        });
      }
    }
  }

  handleDragEnd(): void {
    this.dragWorkArea = null;
    if (!this.widgetWindow || this.widgetWindow.isDestroyed() || !this.dragStartOffset) {
      this.dragStartOffset = null;
      this.isProgrammaticMove = false;
      return;
    }
    this.dragStartOffset = null;

    const [finalX, finalY] = this.widgetWindow.getPosition();
    const [w, h] = this.widgetWindow.getSize();
    const edge = this.calculateNearestEdge(finalX, finalY, w, h);

    // Snap to nearest dock edge with WIDGET_MARGIN and persist position
    this.setWidgetPosition({ x: Math.round(finalX), y: Math.round(finalY), edge });
  }

  private getWidgetPosition(): { x: number; y: number } {
    const savedPos = this.prefs.get('widgetPosition') as WidgetPosition | null;
    const primaryDisplay = screen.getPrimaryDisplay();
    const currentWidth = this.isWidgetCompact ? COMPACT_WIDGET_WIDTH : WIDGET_WIDTH;
    const currentHeight = this.isWidgetCompact ? COMPACT_WIDGET_HEIGHT : WIDGET_HEIGHT;

    if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
      const allDisplays = screen.getAllDisplays();
      const matchingDisplay = allDisplays.find(d => {
        const wa = d.workArea;
        return savedPos.x < wa.x + wa.width &&
               savedPos.x + COMPACT_WIDGET_WIDTH > wa.x &&
               savedPos.y < wa.y + wa.height &&
               savedPos.y + COMPACT_WIDGET_HEIGHT > wa.y;
      }) || primaryDisplay;

      const wa = matchingDisplay.workArea;
      const clampedX = Math.max(wa.x + WIDGET_MARGIN, Math.min(savedPos.x, wa.x + wa.width - currentWidth - WIDGET_MARGIN));
      const clampedY = Math.max(wa.y + WIDGET_MARGIN, Math.min(savedPos.y, wa.y + wa.height - currentHeight - WIDGET_MARGIN));
      return { x: clampedX, y: clampedY };
    }

    const { workArea } = primaryDisplay;
    return {
      x: workArea.x + workArea.width - currentWidth - WIDGET_MARGIN,
      y: workArea.y + Math.floor((workArea.height - currentHeight) / 2),
    };
  }

  syncWidgetWithTimerState(state: TimerState): void {
    const widgetEnabled = this.prefs.get('widgetVisible') !== false;

    if (state.status === 'idle') {
      // The floating widget must not remain visible when FocusFlow is idle
      this.isWidgetDismissed = false;
      if (this.widgetWindow && !this.widgetWindow.isDestroyed() && this.widgetWindow.isVisible()) {
        this.widgetWindow.hide();
      }
      // Reset compact mode for next active session
      if (this.isWidgetCompact) {
        this.setWidgetCompact(false);
      }
      // If the main window was hidden during an active session and the session ended/completed,
      // bring it back only if the user did NOT deliberately close it
      if (this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.isVisible()) {
        if (!this.isMainWindowDeliberatelyClosed) {
          this.mainWindow.show();
        }
      }
    } else if (state.status === 'running' || state.status === 'paused') {
      // Keep widget visible during active cycle (focus sessions, short/long breaks, paused states)
      if (widgetEnabled && !this.isWidgetDismissed) {
        if (!this.widgetWindow || this.widgetWindow.isDestroyed()) {
          this.createWidgetWindow(true);
        } else if (!this.widgetWindow.isVisible()) {
          this.widgetWindow.show();
          this.widgetWindow.setAlwaysOnTop(true, 'screen-saver');
        }
      }
    }
  }

  broadcastTimerState(state: TimerState): void {
    this.syncWidgetWithTimerState(state);

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

  async focusMainWindow(): Promise<BrowserWindow> {
    this.isMainWindowDeliberatelyClosed = false;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      this.mainWindow.focus();
      return this.mainWindow;
    }

    return await this.createMainWindow();
  }

  async navigateMainWindow(route: string): Promise<void> {
    const win = await this.focusMainWindow();
    if (!win || win.isDestroyed()) return;

    const sendNavigation = () => {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(IPC.NAVIGATE, route);
      }
    };

    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', () => {
        sendNavigation();
      });
    } else {
      sendNavigation();
    }
  }

  showWidget(): void {
    this.prefs.set('widgetVisible', true);
    this.isWidgetDismissed = false;
    const state = this.timerEngine.getState();
    if (state.status === 'running' || state.status === 'paused') {
      if (!this.widgetWindow || this.widgetWindow.isDestroyed()) {
        this.createWidgetWindow(true);
      } else {
        this.widgetWindow.show();
        this.widgetWindow.setAlwaysOnTop(true, 'screen-saver');
      }
    }
  }

  hideWidget(isExplicitSettingChange = false): void {
    if (isExplicitSettingChange) {
      this.prefs.set('widgetVisible', false);
    }
    this.isWidgetDismissed = true;
    this.widgetWindow?.hide();
  }

  setWidgetPosition(pos: WidgetPosition): void {
    if (!this.widgetWindow || this.widgetWindow.isDestroyed()) {
      this.prefs.set('widgetPosition', pos);
      return;
    }

    const targetWidth = this.isWidgetCompact ? COMPACT_WIDGET_WIDTH : WIDGET_WIDTH;
    const targetHeight = this.isWidgetCompact ? COMPACT_WIDGET_HEIGHT : WIDGET_HEIGHT;

    const intPosX = Math.round(pos.x);
    const intPosY = Math.round(pos.y);

    const display = screen.getDisplayMatching({
      x: intPosX,
      y: intPosY,
      width: targetWidth,
      height: targetHeight,
    }) || screen.getPrimaryDisplay();
    const { workArea } = display;

    let x = intPosX;
    let y = intPosY;

    // Snap to edge
    switch (pos.edge) {
      case 'right':
        x = workArea.x + workArea.width - targetWidth - WIDGET_MARGIN;
        break;
      case 'left':
        x = workArea.x + WIDGET_MARGIN;
        break;
      case 'top':
        y = workArea.y + WIDGET_MARGIN;
        break;
      case 'bottom':
        y = workArea.y + workArea.height - targetHeight - WIDGET_MARGIN;
        break;
    }

    // Clamp
    x = Math.round(Math.max(workArea.x + WIDGET_MARGIN, Math.min(x, workArea.x + workArea.width - targetWidth - WIDGET_MARGIN)));
    y = Math.round(Math.max(workArea.y + WIDGET_MARGIN, Math.min(y, workArea.y + workArea.height - targetHeight - WIDGET_MARGIN)));

    const snappedPosition: WidgetPosition = { x, y, edge: pos.edge };
    this.prefs.set('widgetPosition', snappedPosition);

    this.isProgrammaticMove = true;
    this.widgetWindow.setBounds({
      x,
      y,
      width: Math.round(targetWidth),
      height: Math.round(targetHeight),
    });
    this.widgetWindow.setAlwaysOnTop(true, 'screen-saver');
    setTimeout(() => {
      this.isProgrammaticMove = false;
    }, 150);
  }

  setWidgetAlwaysOnTop(value: boolean): void {
    if (value) {
      this.widgetWindow?.setAlwaysOnTop(true, 'screen-saver');
    } else {
      this.widgetWindow?.setAlwaysOnTop(false);
    }
    this.prefs.set('widgetAlwaysOnTop', value);
  }

  getMainWindow(): BrowserWindow | null { return this.mainWindow; }
  getWidgetWindow(): BrowserWindow | null { return this.widgetWindow; }
}
