import { useTimerStore } from './timerStore';
import { useSettingsStore } from './settingsStore';
import { useAudioStore } from './audioStore';
import { TimerState, AppSettings, SessionType, BackgroundAudioSource } from '../../shared/types';

/**
 * AudioLifecycleCoordinator
 *
 * Coordinates background music playback with the timer lifecycle.
 * - Starts music on focus session start if audio is enabled in settings and tracks exist.
 * - Pauses and resumes music cleanly with session pause/resume.
 * - Stops music cleanly on session stop, skip, or completion.
 * - Respects break audio settings (`playAudioDuringBreaks`).
 * - Handles settings changes (enabled/disabled, volume, track switch) during sessions safely.
 * - Highly idempotent: 250ms timer ticks are filtered out instantly without overhead.
 * - Never autoplays on app launch or session recovery.
 */
class AudioLifecycleCoordinator {
  private lastStatus: TimerState['status'] = 'idle';
  private lastSessionId: string | null = null;
  private lastSessionType: SessionType = 'focus';
  private lastAudioEnabled: boolean = false;
  private lastAudioSource: BackgroundAudioSource = 'tracks';
  private lastPlayDuringBreaks: boolean = false;
  private lastAudioTrackId: string | null = null;
  private lastAudioVolume: number = 0.5;
  private operationGeneration = 0;
  private isInitialized = false;
  private unsubscribers: Array<() => void> = [];

  public init(): () => void {
    if (this.isInitialized) {
      return () => this.destroy();
    }
    this.isInitialized = true;

    // Snapshot current state
    const initialTimer = useTimerStore.getState().timerState;
    const initialSettings = useSettingsStore.getState().settings;

    this.lastStatus = initialTimer.status;
    this.lastSessionId = initialTimer.sessionId;
    this.lastSessionType = initialTimer.sessionType;
    this.lastAudioEnabled = initialSettings.audioEnabled;
    this.lastAudioSource = initialSettings.audioSource || 'tracks';
    this.lastPlayDuringBreaks = initialSettings.playAudioDuringBreaks;
    this.lastAudioTrackId = initialSettings.audioTrackId;
    this.lastAudioVolume = initialSettings.audioVolume;

    // Subscribe to timer state updates
    const unsubTimer = useTimerStore.subscribe((state) => {
      this.handleTimerStateChange(state.timerState);
    });

    // Subscribe to settings updates
    const unsubSettings = useSettingsStore.subscribe((state) => {
      this.handleSettingsChange(state.settings);
    });

    this.unsubscribers = [unsubTimer, unsubSettings];

    return () => this.destroy();
  }

  public destroy(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.isInitialized = false;
    this.operationGeneration++;
  }

  private isEligible(sessionType: SessionType, settings: AppSettings): boolean {
    if (!settings.audioEnabled) return false;
    if (sessionType === 'focus') return true;
    if ((sessionType === 'short-break' || sessionType === 'long-break') && settings.playAudioDuringBreaks) {
      return true;
    }
    return false;
  }

  private handleTimerStateChange(timerState: TimerState): void {
    const statusChanged = timerState.status !== this.lastStatus;
    const sessionChanged = timerState.sessionId !== this.lastSessionId;
    const typeChanged = timerState.sessionType !== this.lastSessionType;

    // Fast-path: Normal 250ms tick during running session. Do nothing.
    if (!statusChanged && !sessionChanged && !typeChanged) {
      return;
    }

    const previousStatus = this.lastStatus;
    this.lastStatus = timerState.status;
    this.lastSessionId = timerState.sessionId;
    this.lastSessionType = timerState.sessionType;

    const settings = useSettingsStore.getState().settings;
    const audioStore = useAudioStore.getState();

    // 1. Session stopped, skipped, completed, or returned to idle
    if (timerState.status === 'idle') {
      this.operationGeneration++;
      audioStore.stopPlayback();
      return;
    }

    // 2. Session paused
    if (timerState.status === 'paused') {
      this.operationGeneration++;
      audioStore.pausePlayback();
      return;
    }

    // 3. Session running
    if (timerState.status === 'running') {
      const eligible = this.isEligible(timerState.sessionType, settings);

      if (!eligible) {
        // Paused during breaks when playAudioDuringBreaks is false, preserving track & position
        audioStore.pausePlayback();
        return;
      }

      // Respect user manual pause: do not autoplay if user intentionally paused BGM
      if (audioStore.isManuallyPaused) {
        return;
      }

      // 3a. Resuming from pause on the same session
      if (previousStatus === 'paused' && !sessionChanged) {
        const resumeGen = ++this.operationGeneration;
        audioStore.resumePlayback().then(resumed => {
          if (!resumed && resumeGen === this.operationGeneration) {
            const current = useTimerStore.getState().timerState;
            if (current.status === 'running' && current.sessionId === timerState.sessionId) {
              this.startPlaybackForSession(timerState, settings);
            }
          }
        });
        return;
      }

      // 3b. Starting or restarting session playback if not already playing
      if (!audioStore.isPlaying) {
        this.startPlaybackForSession(timerState, settings);
      }
    }
  }

  private async startPlaybackForSession(timerState: TimerState, settings: AppSettings): Promise<void> {
    const generation = ++this.operationGeneration;
    const audioStore = useAudioStore.getState();
    const source = settings.audioSource || 'tracks';

    // If source is built-in brown noise
    if (source === 'brown-noise') {
      audioStore.playBrownNoise();
      return;
    }

    // Otherwise, local tracks:
    let tracks = audioStore.tracks;
    if (!tracks || tracks.length === 0) {
      tracks = await audioStore.refreshLibrary();
    }

    // Abort if superseded while loading library
    if (generation !== this.operationGeneration) return;

    const currentTimer = useTimerStore.getState().timerState;
    if (currentTimer.status !== 'running' || currentTimer.sessionId !== timerState.sessionId) {
      return;
    }

    if (!tracks || tracks.length === 0) {
      return; // No tracks available in user library, fail gracefully
    }

    // Select target track:
    // 1. Existing currentPlaybackTrackId (e.g. paused midway or during break)
    // 2. Persisted settings.audioTrackId
    // 3. Fallback to first track in library
    let targetTrackId: string | null = audioStore.currentPlaybackTrackId;
    if (!targetTrackId || !tracks.some(t => t.id === targetTrackId)) {
      targetTrackId = settings.audioTrackId;
    }
    if (!targetTrackId || !tracks.some(t => t.id === targetTrackId)) {
      targetTrackId = tracks[0].id;
    }

    const ok = await audioStore.playTrack(targetTrackId);

    // Abort if superseded or stopped while waiting for play()
    if (generation !== this.operationGeneration) {
      audioStore.pausePlayback();
      return;
    }

    const latestTimer = useTimerStore.getState().timerState;
    const latestSettings = useSettingsStore.getState().settings;

    if (
      latestTimer.status !== 'running' ||
      latestTimer.sessionId !== timerState.sessionId ||
      !this.isEligible(latestTimer.sessionType, latestSettings)
    ) {
      audioStore.pausePlayback();
    }
  }

  private handleSettingsChange(settings: AppSettings): void {
    const timerState = useTimerStore.getState().timerState;
    const audioStore = useAudioStore.getState();

    // 1. Audio enabled toggle
    if (settings.audioEnabled !== this.lastAudioEnabled) {
      this.lastAudioEnabled = settings.audioEnabled;
      if (!settings.audioEnabled) {
        audioStore.pausePlayback();
      } else if (timerState.status === 'running' && this.isEligible(timerState.sessionType, settings)) {
        if (!audioStore.isPlaying && !audioStore.isManuallyPaused) {
          this.startPlaybackForSession(timerState, settings);
        }
      }
    }

    // 2. Play during breaks toggle
    if (settings.playAudioDuringBreaks !== this.lastPlayDuringBreaks) {
      this.lastPlayDuringBreaks = settings.playAudioDuringBreaks;
      const isBreak = timerState.sessionType === 'short-break' || timerState.sessionType === 'long-break';
      if (isBreak && timerState.status === 'running') {
        if (settings.playAudioDuringBreaks && settings.audioEnabled && !audioStore.isManuallyPaused) {
          if (!audioStore.isPlaying) {
            this.startPlaybackForSession(timerState, settings);
          }
        } else {
          audioStore.pausePlayback();
        }
      }
    }

    // 3. Volume adjustment
    if (settings.audioVolume !== this.lastAudioVolume) {
      this.lastAudioVolume = settings.audioVolume;
      audioStore.setAudioVolume(settings.audioVolume);
    }

    // 4. Track selection change during active session playback
    if (settings.audioTrackId !== this.lastAudioTrackId) {
      this.lastAudioTrackId = settings.audioTrackId;
      if (
        audioStore.isPlaying &&
        !audioStore.isPlayingPreview &&
        (settings.audioSource || 'tracks') === 'tracks' &&
        settings.audioTrackId &&
        settings.audioTrackId !== audioStore.currentPlaybackTrackId &&
        timerState.status === 'running' &&
        this.isEligible(timerState.sessionType, settings)
      ) {
        audioStore.playTrack(settings.audioTrackId, 0);
      }
    }

    // 5. Audio source change (tracks <-> brown-noise)
    const currentSource = settings.audioSource || 'tracks';
    if (currentSource !== this.lastAudioSource) {
      this.lastAudioSource = currentSource;
      if (timerState.status === 'running' && this.isEligible(timerState.sessionType, settings) && !audioStore.isManuallyPaused) {
        this.startPlaybackForSession(timerState, settings);
      }
    }
  }
}

export const audioLifecycleCoordinator = new AudioLifecycleCoordinator();

export function initAudioLifecycle(): () => void {
  return audioLifecycleCoordinator.init();
}
