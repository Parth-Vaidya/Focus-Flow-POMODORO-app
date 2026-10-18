import { IpcMain, dialog, shell, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { IPC } from '../shared/types';
import { TimerEngine } from '../core/timer/timerEngine';
import { WindowManager } from './windowManager';
import { Database } from '../core/persistence/db';
import { PreferencesStore } from '../core/persistence/preferences';
import { RecoveryStore } from '../core/persistence/recovery';
import { AudioManager } from '../core/audio/audioManager';
import { ThemeService, BUILT_IN_THEMES } from '../core/theme/themeService';
import { LocalAudioService } from '../core/audio/localAudioService';
import { AppSettings, WidgetPosition } from '../shared/types';
import { APP_VERSION } from '../shared/constants';

interface SetupArgs {
  timerEngine: TimerEngine;
  windowManager: WindowManager;
  db: Database;
  prefs: PreferencesStore;
  recovery: RecoveryStore;
  audioManager: AudioManager;
  themeService: ThemeService;
  localAudioService: LocalAudioService;
  ipcMain: IpcMain;
}

export function setupIpcHandlers({
  timerEngine, windowManager, db, prefs, recovery, audioManager, themeService, localAudioService, ipcMain
}: SetupArgs): void {

  // ── Timer controls ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.TIMER_START, (_e, taskName: string) => {
    if (typeof taskName !== 'string') taskName = '';
    timerEngine.start(taskName.trim().slice(0, 200));
    return { ok: true };
  });

  ipcMain.handle(IPC.TIMER_PAUSE, () => {
    timerEngine.pause();
    return { ok: true };
  });

  ipcMain.handle(IPC.TIMER_RESUME, () => {
    timerEngine.resume();
    return { ok: true };
  });

  ipcMain.handle(IPC.TIMER_SKIP, () => {
    timerEngine.skip();
    return { ok: true };
  });

  ipcMain.handle(IPC.TIMER_RESTART, () => {
    timerEngine.restart();
    return { ok: true };
  });

  ipcMain.handle(IPC.TIMER_STOP, () => {
    timerEngine.stop();
    return { ok: true };
  });

  ipcMain.handle(IPC.TIMER_STATE_GET, () => {
    return JSON.stringify(timerEngine.getState());
  });

  // ── Settings ────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.SETTINGS_GET, () => {
    return prefs.getAll();
  });

  ipcMain.handle(IPC.SETTINGS_SET, (_e, updates: Partial<AppSettings>) => {
    if (!updates || typeof updates !== 'object') return { ok: false };
    prefs.setMany(updates);
    const all = prefs.getAll();
    // Propagate settings changes to timer engine
    timerEngine.updateSettings(all);
    // Handle widget-specific settings
    if ('widgetAlwaysOnTop' in updates) {
      windowManager.setWidgetAlwaysOnTop(updates.widgetAlwaysOnTop!);
    }
    if ('widgetVisible' in updates) {
      if (updates.widgetVisible) {
        windowManager.showWidget();
      } else {
        windowManager.hideWidget(true);
      }
    }
    windowManager.broadcastSettings(all);
    return { ok: true };
  });

  ipcMain.handle(IPC.SETTINGS_RESET, () => {
    prefs.reset();
    const all = prefs.getAll();
    timerEngine.updateSettings(all);
    windowManager.broadcastSettings(all);
    return all;
  });

  // ── History ──────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.HISTORY_GET, (_e, options?: { limit?: number; offset?: number; taskName?: string }) => {
    return db.getSessions(options || {});
  });

  ipcMain.handle(IPC.HISTORY_DELETE, (_e, id: string) => {
    if (typeof id !== 'string' || !id) return { ok: false };
    db.deleteSession(id);
    return { ok: true };
  });

  ipcMain.handle(IPC.HISTORY_CLEAR, () => {
    db.clearAllSessions();
    return { ok: true };
  });

  ipcMain.handle(IPC.HISTORY_EXPORT_CSV, async (_e) => {
    const win = windowManager.getMainWindow();
    const result = await dialog.showSaveDialog(win!, {
      title: 'Export Session History',
      defaultPath: 'focusflow-history.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };

    const sessions = db.getSessions({});
    const header = 'id,sessionType,taskName,configuredDurationMs,startedAt,endedAt,activeFocusMs,status\n';
    const rows = sessions.map(s =>
      [
        s.id,
        s.sessionType,
        `"${(s.taskName || '').replace(/"/g, '""')}"`,
        s.configuredDurationMs,
        new Date(s.startedAt).toISOString(),
        new Date(s.endedAt).toISOString(),
        s.activeFocusMs,
        s.status,
      ].join(',')
    ).join('\n');
    fs.writeFileSync(result.filePath, header + rows, 'utf8');
    return { ok: true, path: result.filePath };
  });

  // ── Analytics ────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.ANALYTICS_GET, (_e, days: number = 7) => {
    return db.getAnalytics(days);
  });

  ipcMain.handle(IPC.ANALYTICS_DAILY, () => {
    return db.getDailyStats();
  });

  ipcMain.handle(IPC.ANALYTICS_STREAKS, () => {
    const goalMs = prefs.get('dailyGoalMs') as number;
    return db.getStreaks(goalMs);
  });

  // ── Widget ───────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.WIDGET_SHOW, () => {
    windowManager.showWidget();
    return { ok: true };
  });

  ipcMain.handle(IPC.WIDGET_HIDE, () => {
    windowManager.hideWidget(false);
    return { ok: true };
  });

  ipcMain.handle(IPC.WIDGET_SET_COMPACT, (_e, compact: boolean) => {
    windowManager.setWidgetCompact(Boolean(compact));
    return { ok: true };
  });

  ipcMain.handle(IPC.WIDGET_SET_POSITION, (_e, pos: WidgetPosition) => {
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return { ok: false };
    windowManager.setWidgetPosition(pos);
    return { ok: true };
  });

  ipcMain.handle(IPC.WIDGET_GET_POSITION, () => {
    const win = windowManager.getWidgetWindow();
    if (!win) return null;
    const [x, y] = win.getPosition();
    return { x, y };
  });

  ipcMain.on(IPC.WIDGET_DRAG_START, (_e, payload) => {
    if (payload && typeof payload.screenX === 'number' && typeof payload.screenY === 'number') {
      windowManager.handleDragStart(payload.screenX, payload.screenY);
    }
  });

  ipcMain.on(IPC.WIDGET_DRAG_MOVE, (_e, payload) => {
    if (payload && typeof payload.screenX === 'number' && typeof payload.screenY === 'number') {
      windowManager.handleDragMove(payload.screenX, payload.screenY);
    }
  });

  ipcMain.on(IPC.WIDGET_DRAG_END, () => {
    windowManager.handleDragEnd();
  });

  ipcMain.handle(IPC.MAIN_FOCUS, async (_e, route?: string) => {
    try {
      if (route) {
        await windowManager.navigateMainWindow(route);
      } else {
        await windowManager.focusMainWindow();
      }
      return { ok: true };
    } catch (err) {
      console.error('Failed to focus/navigate main window:', err);
      return { ok: false, error: String(err) };
    }
  });

  // ── Audio ────────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.AUDIO_GET_LIBRARY, () => {
    try {
      return localAudioService.getTracks();
    } catch (err) {
      console.error('Failed to get audio library:', err);
      return [];
    }
  });

  ipcMain.handle(IPC.AUDIO_OPEN_FOLDER, () => {
    try {
      localAudioService.openAudioFolder();
      return { ok: true };
    } catch (err) {
      console.error('Failed to open audio folder:', err);
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle(IPC.AUDIO_REFRESH_LIBRARY, () => {
    try {
      return localAudioService.getTracks();
    } catch (err) {
      console.error('Failed to refresh audio library:', err);
      return [];
    }
  });

  ipcMain.handle(IPC.AUDIO_BROWN_NOISE_START, (_e, volume?: number) => {
    const vol = typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : undefined;
    audioManager.startBrownNoise(vol);
    return { ok: true };
  });

  ipcMain.handle(IPC.AUDIO_BROWN_NOISE_STOP, () => {
    audioManager.stopBrownNoise();
    return { ok: true };
  });

  ipcMain.handle(IPC.AUDIO_BROWN_NOISE_VOLUME, (_e, volume: number) => {
    if (typeof volume !== 'number') return { ok: false };
    audioManager.setBrownNoiseVolume(Math.max(0, Math.min(1, volume)));
    return { ok: true };
  });

  ipcMain.handle(IPC.AUDIO_ALERT, () => {
    audioManager.playAlert();
    return { ok: true };
  });

  // ── Recovery ─────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.RECOVERY_GET, () => {
    return recovery.load();
  });

  ipcMain.handle(IPC.RECOVERY_DISMISS, () => {
    recovery.clear();
    return { ok: true };
  });

  ipcMain.handle(IPC.RECOVERY_RESUME, () => {
    const saved = recovery.load();
    if (!saved || !saved.timerState) {
      return { ok: false };
    }
    // Restore into the engine (engine sets status → 'paused')
    timerEngine.restoreFromRecovery(saved);
    // Clear immediately so a second call is a no-op
    recovery.clear();
    // Return the restored state so the renderer can sync without a round-trip
    return { ok: true, state: JSON.stringify(timerEngine.getState()) };
  });

  // ── Themes ───────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.THEMES_GET_ALL, () => {
    try {
      return themeService.getAllThemes();
    } catch (err) {
      console.error('Failed to get themes:', err);
      return { builtIn: BUILT_IN_THEMES, custom: [] };
    }
  });

  ipcMain.handle(IPC.THEMES_OPEN_FOLDER, () => {
    try {
      themeService.openThemesFolder();
      return { ok: true };
    } catch (err) {
      console.error('Failed to open themes folder:', err);
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle(IPC.THEMES_REFRESH, () => {
    try {
      const themes = themeService.getAllThemes();
      windowManager.broadcastThemes(themes);
      return themes;
    } catch (err) {
      console.error('Failed to refresh themes:', err);
      return { builtIn: BUILT_IN_THEMES, custom: [] };
    }
  });

  // ── App ───────────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.APP_VERSION, () => APP_VERSION);

  ipcMain.handle(IPC.OPEN_EXTERNAL, (_e, url: string) => {
    if (typeof url === 'string' && url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { ok: true };
  });
}
