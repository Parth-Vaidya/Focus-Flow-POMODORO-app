import { app, BrowserWindow, ipcMain, Notification, nativeTheme } from 'electron';
import path from 'path';
import { WindowManager } from './windowManager';
import { setupIpcHandlers } from './ipcHandlers';
import { TimerEngine } from '../core/timer/timerEngine';
import { Database } from '../core/persistence/db';
import { PreferencesStore } from '../core/persistence/preferences';
import { RecoveryStore } from '../core/persistence/recovery';
import { AudioManager } from '../core/audio/audioManager';
import { APP_VERSION } from '../shared/constants';

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let windowManager: WindowManager;
let timerEngine: TimerEngine;
let db: Database;
let prefs: PreferencesStore;
let recovery: RecoveryStore;
let audioManager: AudioManager;

app.whenReady().then(async () => {
  // Initialize stores
  prefs = new PreferencesStore();
  db = new Database();
  await db.init();
  recovery = new RecoveryStore();
  audioManager = new AudioManager();

  const settings = prefs.getAll();

  // Create timer engine
  timerEngine = new TimerEngine({
    settings,
    onStateChange: (state) => {
      windowManager?.broadcastTimerState(state);
    },
    onSessionComplete: async (record) => {
      db.insertSession(record);
      recovery.clear();
      // Play alert
      if (settings.alertSoundEnabled) {
        audioManager.playAlert();
      }
      // Desktop notification
      if (settings.notificationsEnabled && Notification.isSupported()) {
        const title = record.sessionType === 'focus'
          ? '✅ Focus session complete!'
          : record.sessionType === 'short-break'
            ? '☕ Short break over'
            : '🧘 Long break over';
        const body = record.sessionType === 'focus'
          ? 'Time for a break.'
          : 'Ready to focus?';
        new Notification({ title, body, silent: true }).show();
      }
    },
    onRecoverySave: (state) => {
      recovery.save({ timerState: state, savedAt: Date.now(), appVersion: APP_VERSION });
    },
  });

  // Window manager
  windowManager = new WindowManager({ timerEngine, prefs });

  // IPC handlers: must be registered before creating windows so renderer initial calls succeed
  setupIpcHandlers({ timerEngine, windowManager, db, prefs, recovery, audioManager, ipcMain });

  await windowManager.createMainWindow();

  if (settings.widgetVisible) {
    await windowManager.createWidgetWindow();
  }

  app.on('second-instance', () => {
    windowManager?.focusMainWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow();
    } else {
      windowManager.focusMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS keep app running
  if (process.platform !== 'darwin') {
    // Save recovery before quitting if session is active
    const state = timerEngine?.getState();
    if (state && (state.status === 'running' || state.status === 'paused')) {
      recovery?.save({ timerState: state, savedAt: Date.now(), appVersion: APP_VERSION });
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  const state = timerEngine?.getState();
  if (state && (state.status === 'running' || state.status === 'paused')) {
    recovery?.save({ timerState: state, savedAt: Date.now(), appVersion: APP_VERSION });
  }
  timerEngine?.destroy();
  audioManager?.destroy();
});
