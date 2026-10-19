import { app, BrowserWindow, ipcMain, Notification, nativeTheme, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { WindowManager } from './windowManager';
import { setupIpcHandlers } from './ipcHandlers';
import { TimerEngine } from '../core/timer/timerEngine';
import { Database } from '../core/persistence/db';
import { PreferencesStore } from '../core/persistence/preferences';
import { RecoveryStore } from '../core/persistence/recovery';
import { AudioManager } from '../core/audio/audioManager';
import { ThemeService } from '../core/theme/themeService';
import { LocalAudioService } from '../core/audio/localAudioService';
import { APP_VERSION } from '../shared/constants';

// Register local-audio scheme as privileged before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-audio',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

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
let themeService: ThemeService;
let localAudioService: LocalAudioService;

app.whenReady().then(async () => {
  // Initialize stores
  prefs = new PreferencesStore();
  db = new Database();
  await db.init();
  recovery = new RecoveryStore();
  audioManager = new AudioManager();
  themeService = new ThemeService();
  localAudioService = new LocalAudioService();

  // Register local-audio protocol for streaming local audio files securely
  protocol.handle('local-audio', async (request) => {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          },
        });
      }

      const url = new URL(request.url);
      let rawId = url.pathname.replace(/^\/+/, '');
      if (url.host && url.host !== 'track' && (!rawId || rawId === '')) {
        rawId = url.host;
      } else if (rawId.startsWith('track/')) {
        rawId = rawId.substring('track/'.length);
      }
      const trackId = decodeURIComponent(rawId);

      // Handle Soft White Noise audio stream alias
      if (trackId === 'soft-white-noise' || rawId.startsWith('asset/soft-white-noise')) {
        const softNoisePath = localAudioService.getSoftWhiteNoiseFile();
        if (!softNoisePath || !fs.existsSync(softNoisePath)) {
          return new Response('Soft white noise file not found', { status: 404 });
        }
        const res = await net.fetch(pathToFileURL(softNoisePath).href, {
          headers: request.headers,
          method: request.method,
        });
        const headers = new Headers(res.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers,
        });
      }

      const tracks = localAudioService.getTracks();
      const track = tracks.find(t => t.id === trackId);
      if (!track) {
        return new Response('Track not found', { status: 404 });
      }

      const audioDir = localAudioService.getAudioDirectory();
      if (!fs.existsSync(audioDir) || !fs.existsSync(track.path)) {
        return new Response('File not found', { status: 404 });
      }

      // Security check: resolve symlinks and assert file is inside designated audio directory
      const realAudioDir = fs.realpathSync(audioDir);
      const realTrackPath = fs.realpathSync(track.path);
      const relative = path.relative(realAudioDir.toLowerCase(), realTrackPath.toLowerCase());
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return new Response('Access denied', { status: 403 });
      }

      // Forward request headers and method to net.fetch for HTTP Range / media seeking support
      const res = await net.fetch(pathToFileURL(realTrackPath).href, {
        headers: request.headers,
        method: request.method,
      });
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    } catch (err) {
      console.error('Error handling local-audio protocol:', err);
      return new Response('Internal error', { status: 500 });
    }
  });

  const settings = prefs.getAll();

  // Create timer engine
  timerEngine = new TimerEngine({
    settings,
    onStateChange: (state) => {
      windowManager?.broadcastTimerState(state);
    },
    onSessionComplete: async (record) => {
      db.insertSession(record);
      const currentSettings = prefs.getAll();
      // Play alert only on natural completion
      if (currentSettings.alertSoundEnabled && record.status === 'completed') {
        audioManager.playAlert();
      }
      // Desktop notification
      if (currentSettings.notificationsEnabled && Notification.isSupported() && record.status === 'completed') {
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
      if (state.status === 'idle') {
        recovery.clear();
      } else {
        recovery.save({ timerState: state, savedAt: Date.now(), appVersion: APP_VERSION });
      }
    },
  });

  // Window manager
  windowManager = new WindowManager({ timerEngine, prefs });

  // IPC handlers: must be registered before creating windows so renderer initial calls succeed
  setupIpcHandlers({ timerEngine, windowManager, db, prefs, recovery, audioManager, themeService, localAudioService, ipcMain });

  await windowManager.createMainWindow();

  if (settings.widgetVisible) {
    await windowManager.createWidgetWindow(false);
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
  windowManager?.setQuitting(true);
  const state = timerEngine?.getState();
  if (state && (state.status === 'running' || state.status === 'paused')) {
    recovery?.save({ timerState: state, savedAt: Date.now(), appVersion: APP_VERSION });
  }
  timerEngine?.destroy();
  audioManager?.destroy();
});
