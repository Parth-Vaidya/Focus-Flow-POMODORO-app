import { create } from 'zustand';
import { AudioTrack, AudioPlaybackMode, BackgroundAudioSource } from '../../shared/types';
import { useSettingsStore } from './settingsStore';

interface AudioState {
  // Unified active source & playback status
  activeSource: BackgroundAudioSource | null;
  isPlaying: boolean;
  isPlayingPreview: boolean;
  previewingTrackId: string | null;
  currentPlaybackTrackId: string | null;
  volume: number;
  isManuallyPaused: boolean;

  // Bundled Soft White Noise status
  softWhiteNoiseAvailable: boolean | null;
  softWhiteNoiseFileName: string | null;
  checkSoftWhiteNoiseAsset: () => Promise<boolean>;
  previewSoftWhiteNoise: () => Promise<boolean>;
  playSoftWhiteNoise: () => Promise<boolean>;

  // Source selection
  selectAudioSource: (source: BackgroundAudioSource) => Promise<void>;

  // Local audio library state (My Music)
  tracks: AudioTrack[];
  loadingLibrary: boolean;
  selectedTrackId: string | null;

  // Actions
  loadLibrary: () => Promise<void>;
  refreshLibrary: () => Promise<AudioTrack[]>;
  openAudioFolder: () => Promise<{ ok: boolean; error?: string }>;
  selectTrack: (trackId: string | null) => Promise<void>;
  previewTrack: (trackId: string) => Promise<void>;
  stopPreview: () => void;
  setAudioVolume: (volume: number) => void;
  applyLiveVolume: (volume: number) => void;
  setAudioMode: (mode: AudioPlaybackMode) => Promise<void>;
  toggleBgm: () => Promise<void>;

  // Session background music methods
  playTrack: (trackId: string, explicitPosition?: number) => Promise<boolean>;
  pausePlayback: () => void;
  resumePlayback: () => Promise<boolean>;
  stopPlayback: () => void;
  playNextTrack: () => Promise<boolean>;

  // Legacy alias for volume
  setVolume: (v: number) => void;
}

export const playAlertSound = (): void => {
  try {
    const ctx = new AudioContext();
    // Simple two-tone chime
    const frequencies = [880, 1100];
    let startTime = ctx.currentTime;
    frequencies.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
      osc.start(startTime);
      osc.stop(startTime + 0.6);
      startTime += 0.35;
    });
  } catch (e) {
    console.warn('Alert sound failed:', e);
  }
};

/**
 * Calculates the next track ID in My Music based on the playback mode (single, sequential, shuffle).
 * Bundled Soft White Noise is never included in this pool.
 */
export function getNextTrackId(
  currentTrackId: string | null,
  mode: AudioPlaybackMode,
  tracks: AudioTrack[]
): string | null {
  if (!tracks || tracks.length === 0) return null;
  if (tracks.length === 1) return tracks[0].id;

  const currentIndex = tracks.findIndex(t => t.id === currentTrackId);

  switch (mode) {
    case 'single': {
      if (currentIndex === -1) return tracks[0].id;
      return currentTrackId || tracks[0].id;
    }

    case 'sequential': {
      if (currentIndex === -1) return tracks[0].id;
      return tracks[(currentIndex + 1) % tracks.length].id;
    }

    case 'shuffle': {
      const candidates = tracks.filter(t => t.id !== currentTrackId);
      const shufflePool = candidates.length > 0 ? candidates : tracks;
      const randomIndex = Math.floor(Math.random() * shufflePool.length);
      return shufflePool[randomIndex].id;
    }

    default:
      return tracks[0].id;
  }
}

/**
 * Internal gain multiplier for Soft White Noise ambient sound.
 * Ambient/noise assets typically sit at a lower RMS loudness than mastered music tracks.
 * A 2.0x multiplier (+6 dB) raises perceived loudness while preserving master volume slider range.
 * A transparent Web Audio limiter prevents any digital clipping or harsh distortion at 100% volume.
 */
export const SOFT_WHITE_NOISE_GAIN_MULTIPLIER = 2.0;

/**
 * Low-level HTML5 Audio Player managing playback of local audio tracks and bundled assets.
 * Handles instant volume adjustments, playback positions, error recovery, and looping.
 * Routes audio through a Web Audio GainNode to allow controlled amplification of Soft White Noise
 * beyond the standard 0-1 HTML audio element limit without affecting user music files.
 */
class LocalAudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private currentTrackId: string | null = null;
  private savedPositions = new Map<string, number>();
  private playGeneration = 0;
  private onTrackEnded: (() => void) | null = null;
  private onError: ((err: unknown) => void) | null = null;
  private isSoftWhiteNoise = false;
  private masterVolume = 0.5;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.crossOrigin = 'anonymous';

      // Set up persistent Web Audio API gain routing for amplification beyond 1.0 (Soft White Noise boost)
      try {
        const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
          this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
          this.gainNode = this.audioCtx.createGain();

          // Peak limiter to cleanly prevent digital clipping and harsh distortion when amplified at 100% volume
          this.limiterNode = this.audioCtx.createDynamicsCompressor();
          this.limiterNode.threshold.setValueAtTime(-0.5, this.audioCtx.currentTime);
          this.limiterNode.knee.setValueAtTime(3.0, this.audioCtx.currentTime);
          this.limiterNode.ratio.setValueAtTime(20.0, this.audioCtx.currentTime);
          this.limiterNode.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
          this.limiterNode.release.setValueAtTime(0.1, this.audioCtx.currentTime);

          // Connect audio graph: source -> gainNode -> limiterNode -> destination
          this.sourceNode.connect(this.gainNode);
          this.gainNode.connect(this.limiterNode);
          this.limiterNode.connect(this.audioCtx.destination);
        }
      } catch (err) {
        console.warn('LocalAudioPlayer: Web Audio API gain routing setup failed, falling back to direct volume:', err);
      }

      this.audio.addEventListener('ended', () => {
        this.onTrackEnded?.();
      });

      this.audio.addEventListener('timeupdate', () => {
        if (this.audio && this.currentTrackId && !Number.isNaN(this.audio.currentTime) && this.audio.currentTime > 0) {
          this.savedPositions.set(this.currentTrackId, this.audio.currentTime);
        }
      });

      this.audio.addEventListener('error', () => {
        const err = this.audio?.error || new Error('Audio playback error');
        console.warn('LocalAudioPlayer error event:', err);
        this.onError?.(err);
      });
    }
  }

  private async ensureAudioContextActive(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (e) {
        console.warn('Failed to resume AudioContext:', e);
      }
    }
  }

  private applyGain(): void {
    const multiplier = this.isSoftWhiteNoise ? SOFT_WHITE_NOISE_GAIN_MULTIPLIER : 1.0;
    const targetGain = Math.max(0, this.masterVolume * multiplier);

    if (this.gainNode && this.audioCtx) {
      // Keep audio element at unity volume (1.0) so gainNode is the sole authoritative volume stage
      if (this.audio && this.audio.volume !== 1.0) {
        this.audio.volume = 1.0;
      }
      this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.gainNode.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);
    } else if (this.audio) {
      // Fallback: clamp to 0-1 for standard HTML audio element volume
      this.audio.volume = Math.max(0, Math.min(1, targetGain));
    }
  }

  setEndedCallback(cb: () => void): void {
    this.onTrackEnded = cb;
  }

  setErrorCallback(cb: (err: unknown) => void): void {
    this.onError = cb;
  }

  getSavedPosition(trackId: string): number {
    return this.savedPositions.get(trackId) ?? 0;
  }

  setSavedPosition(trackId: string, position: number): void {
    this.savedPositions.set(trackId, Math.max(0, position));
  }

  clearSavedPosition(trackId: string): void {
    this.savedPositions.delete(trackId);
  }

  getCurrentPosition(): number {
    if (this.audio && !Number.isNaN(this.audio.currentTime)) {
      return this.audio.currentTime;
    }
    if (this.currentTrackId) {
      return this.savedPositions.get(this.currentTrackId) ?? 0;
    }
    return 0;
  }

  private seekToPosition(targetPos: number): Promise<void> {
    if (!this.audio || targetPos <= 0) return Promise.resolve();
    const audio = this.audio;

    const applySeek = () => {
      try {
        const duration = audio.duration;
        let clamped = targetPos;
        if (Number.isFinite(duration) && duration > 0) {
          clamped = Math.max(0, Math.min(targetPos, Math.max(0, duration - 0.2)));
        }
        audio.currentTime = clamped;
      } catch (err) {
        console.warn('Failed to seek audio position:', err);
      }
    };

    if (audio.readyState >= 1) { // HAVE_METADATA or higher
      applySeek();
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let resolved = false;
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          audio.removeEventListener('loadedmetadata', onLoaded);
          audio.removeEventListener('canplay', onLoaded);
          audio.removeEventListener('error', onError);
          clearTimeout(timer);
          resolve();
        }
      };
      const onLoaded = () => {
        applySeek();
        cleanup();
      };
      const onError = () => {
        cleanup();
      };
      const timer = setTimeout(() => {
        applySeek();
        cleanup();
      }, 1500);

      audio.addEventListener('loadedmetadata', onLoaded, { once: true });
      audio.addEventListener('canplay', onLoaded, { once: true });
      audio.addEventListener('error', onError, { once: true });
    });
  }

  async loadAndPlay(trackId: string, volume: number, explicitPosition?: number): Promise<boolean> {
    if (!this.audio) return false;
    const generation = ++this.playGeneration;
    try {
      this.masterVolume = Math.max(0, Math.min(1, volume));
      this.isSoftWhiteNoise = (trackId === 'soft-white-noise');
      this.applyGain();

      await this.ensureAudioContextActive();

      const targetUrl = `local-audio://track/${encodeURIComponent(trackId)}`;
      const isSameTrack = this.currentTrackId === trackId && this.audio.src === targetUrl;

      const targetPos = explicitPosition !== undefined
        ? explicitPosition
        : (this.savedPositions.get(trackId) ?? 0);

      this.currentTrackId = trackId;

      if (!isSameTrack) {
        this.audio.src = targetUrl;
      }

      if (targetPos > 0) {
        await this.seekToPosition(targetPos);
      } else if (explicitPosition === 0 && isSameTrack && this.audio.currentTime > 0) {
        this.audio.currentTime = 0;
      }

      if (generation !== this.playGeneration) {
        return false;
      }

      await this.audio.play();

      if (generation !== this.playGeneration) {
        this.audio.pause();
        return false;
      }

      return true;
    } catch (err) {
      if (generation === this.playGeneration) {
        console.warn('LocalAudioPlayer: Playback rejected or failed:', err);
      }
      return false;
    }
  }

  pause(): void {
    if (this.audio) {
      if (this.currentTrackId && !Number.isNaN(this.audio.currentTime) && this.audio.currentTime > 0) {
        this.savedPositions.set(this.currentTrackId, this.audio.currentTime);
      }
      this.audio.pause();
    }
  }

  async resume(): Promise<boolean> {
    if (!this.audio || !this.currentTrackId) return false;
    const generation = ++this.playGeneration;
    try {
      await this.ensureAudioContextActive();
      this.applyGain();

      const savedPos = this.savedPositions.get(this.currentTrackId) ?? 0;
      if (savedPos > 0 && Math.abs(this.audio.currentTime - savedPos) > 1.0) {
        await this.seekToPosition(savedPos);
      }
      await this.audio.play();
      if (generation !== this.playGeneration) {
        this.audio.pause();
        return false;
      }
      return true;
    } catch (err) {
      if (generation === this.playGeneration) {
        console.warn('LocalAudioPlayer: Resume failed:', err);
      }
      return false;
    }
  }

  stop(): void {
    this.playGeneration++;
    if (this.audio) {
      if (this.currentTrackId && !Number.isNaN(this.audio.currentTime) && this.audio.currentTime > 0) {
        this.savedPositions.set(this.currentTrackId, this.audio.currentTime);
      }
      this.audio.pause();
      // Keep src and currentTrackId so that resume works reliably
    }
  }

  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.applyGain();
  }

  getCurrentTrackId(): string | null {
    return this.currentTrackId;
  }

  isPlaying(): boolean {
    return this.audio ? !this.audio.paused && !this.audio.ended : false;
  }
}

const localPlayer = new LocalAudioPlayer();

let volumePersistenceTimer: NodeJS.Timeout | null = null;

export const useAudioStore = create<AudioState>()((set, get) => ({
  // Unified active source & playback status
  activeSource: null,
  isPlaying: false,
  isPlayingPreview: false,
  previewingTrackId: null,
  currentPlaybackTrackId: null,
  volume: 0.5,
  isManuallyPaused: false,

  // Bundled Soft White Noise status
  softWhiteNoiseAvailable: null,
  softWhiteNoiseFileName: null,

  checkSoftWhiteNoiseAsset: async () => {
    try {
      if (window.focusFlow?.audio?.getSoftWhiteNoiseStatus) {
        const res = await window.focusFlow.audio.getSoftWhiteNoiseStatus();
        set({
          softWhiteNoiseAvailable: res.available,
          softWhiteNoiseFileName: res.fileName || null,
        });
        return res.available;
      }
    } catch (err) {
      console.warn('Failed to check soft white noise status:', err);
    }
    set({ softWhiteNoiseAvailable: false, softWhiteNoiseFileName: null });
    return false;
  },

  selectAudioSource: async (source: BackgroundAudioSource) => {
    const current = get();
    if (current.isPlayingPreview) {
      current.stopPreview();
    }
    if (current.isPlaying) {
      current.stopPlayback();
    }
    await useSettingsStore.getState().update({ audioSource: source });
  },

  setVolume: (v) => {
    get().setAudioVolume(v);
  },

  // Local audio library state (My Music)
  tracks: [],
  loadingLibrary: false,
  selectedTrackId: null,

  // Library management
  loadLibrary: async () => {
    try {
      set({ loadingLibrary: true });
      get().checkSoftWhiteNoiseAsset();
      const tracks = await window.focusFlow.audio.getLibrary();
      const settings = useSettingsStore.getState().settings;
      const activeTrackId = settings.audioTrackId;
      set({
        tracks: tracks || [],
        selectedTrackId: activeTrackId,
        loadingLibrary: false,
      });
    } catch (err) {
      console.warn('Failed to load audio library:', err);
      set({ loadingLibrary: false });
    }
  },

  refreshLibrary: async () => {
    try {
      set({ loadingLibrary: true });
      get().checkSoftWhiteNoiseAsset();
      const tracks = await window.focusFlow.audio.refreshLibrary();
      const settings = useSettingsStore.getState().settings;
      set({
        tracks: tracks || [],
        selectedTrackId: settings.audioTrackId,
        loadingLibrary: false,
      });
      return tracks || [];
    } catch (err) {
      console.warn('Failed to refresh audio library:', err);
      set({ loadingLibrary: false });
      return [];
    }
  },

  openAudioFolder: async () => {
    try {
      return await window.focusFlow.audio.openFolder();
    } catch (err) {
      console.error('Failed to open audio folder:', err);
      return { ok: false, error: String(err) };
    }
  },

  // Track selection & persistence
  selectTrack: async (trackId: string | null) => {
    if (get().isPlayingPreview) {
      get().stopPreview();
    }
    set({ selectedTrackId: trackId, currentPlaybackTrackId: trackId });
    if (trackId) {
      localPlayer.clearSavedPosition(trackId);
    }
    await useSettingsStore.getState().update({ audioTrackId: trackId });
  },

  // Preview management
  previewSoftWhiteNoise: async () => {
    const { previewingTrackId, isPlayingPreview } = get();
    if (previewingTrackId === 'soft-white-noise' && isPlayingPreview) {
      get().stopPreview();
      return false;
    }

    const available = await get().checkSoftWhiteNoiseAsset();
    if (!available) {
      set({
        previewingTrackId: null,
        isPlayingPreview: false,
      });
      return false;
    }

    localPlayer.pause();

    set({
      previewingTrackId: 'soft-white-noise',
      isPlayingPreview: true,
      isPlaying: false,
    });

    const settings = useSettingsStore.getState().settings;
    const vol = typeof settings.audioVolume === 'number' ? settings.audioVolume : 0.5;
    const ok = await localPlayer.loadAndPlay('soft-white-noise', vol, 0);
    if (!ok) {
      set({
        previewingTrackId: null,
        isPlayingPreview: false,
      });
      return false;
    }
    return true;
  },

  previewTrack: async (trackId: string) => {
    const { previewingTrackId, isPlayingPreview } = get();
    if (previewingTrackId === trackId && isPlayingPreview) {
      get().stopPreview();
      return;
    }

    localPlayer.pause();

    set({
      previewingTrackId: trackId,
      isPlayingPreview: true,
      isPlaying: false,
    });

    const settings = useSettingsStore.getState().settings;
    const vol = typeof settings.audioVolume === 'number' ? settings.audioVolume : 0.5;
    const ok = await localPlayer.loadAndPlay(trackId, vol, 0);
    if (!ok) {
      set({
        previewingTrackId: null,
        isPlayingPreview: false,
      });
    }
  },

  stopPreview: () => {
    if (!get().isPlayingPreview) return;
    localPlayer.pause();
    set({
      previewingTrackId: null,
      isPlayingPreview: false,
    });
  },

  // Authoritative single volume-update paths
  applyLiveVolume: (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    localPlayer.setVolume(clamped);
    set({ volume: clamped });
  },

  setAudioVolume: (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));

    // 1. Immediately update audio output volume without recreating nodes or restarting audio
    localPlayer.setVolume(clamped);

    // 2. Immediately update in-memory store volume
    set({ volume: clamped });

    // 3. Immediately update settingsStore in-memory so slider and UI percentages update smoothly
    const settingsState = useSettingsStore.getState();
    if (settingsState.settings.audioVolume !== clamped) {
      useSettingsStore.setState({
        settings: {
          ...settingsState.settings,
          audioVolume: clamped,
        },
      });
    }

    // 4. Debounce disk persistence and IPC updates to prevent competing out-of-order writes and UI lag
    if (volumePersistenceTimer) {
      clearTimeout(volumePersistenceTimer);
    }
    volumePersistenceTimer = setTimeout(async () => {
      try {
        await window.focusFlow.settings.set({
          audioVolume: clamped,
        });
      } catch (err) {
        console.warn('Failed to persist audio volume:', err);
      }
    }, 250);
  },

  setAudioMode: async (mode: AudioPlaybackMode) => {
    await useSettingsStore.getState().update({ audioMode: mode });
  },

  toggleBgm: async () => {
    const settings = useSettingsStore.getState().settings;
    const nextEnabled = !settings.audioEnabled;

    if (!nextEnabled) {
      set({ isManuallyPaused: true });
      get().pausePlayback();
      await useSettingsStore.getState().update({ audioEnabled: false });
    } else {
      set({ isManuallyPaused: false });
      await useSettingsStore.getState().update({ audioEnabled: true });
    }
  },

  // Session background playback methods
  playSoftWhiteNoise: async () => {
    if (get().isPlayingPreview) {
      get().stopPreview();
    }
    localPlayer.stop();

    const available = await get().checkSoftWhiteNoiseAsset();
    if (!available) {
      set({
        isPlaying: false,
        activeSource: null,
      });
      return false;
    }

    const settings = useSettingsStore.getState().settings;
    const vol = typeof settings.audioVolume === 'number' ? settings.audioVolume : 0.5;
    const ok = await localPlayer.loadAndPlay('soft-white-noise', vol);
    set({
      isPlaying: ok,
      activeSource: ok ? 'white-noise' : null,
      currentPlaybackTrackId: ok ? 'soft-white-noise' : get().currentPlaybackTrackId,
      isManuallyPaused: false,
    });
    return ok;
  },

  playTrack: async (trackId: string, explicitPosition?: number) => {
    if (get().isPlayingPreview) {
      get().stopPreview();
    }

    const settings = useSettingsStore.getState().settings;
    const vol = typeof settings.audioVolume === 'number' ? settings.audioVolume : 0.5;
    const ok = await localPlayer.loadAndPlay(trackId, vol, explicitPosition);
    set({
      isPlaying: ok,
      activeSource: ok ? 'tracks' : null,
      currentPlaybackTrackId: ok ? trackId : get().currentPlaybackTrackId,
      isManuallyPaused: false,
    });
    return ok;
  },

  pausePlayback: () => {
    localPlayer.pause();
    set({
      isPlaying: false,
    });
  },

  resumePlayback: async () => {
    const { activeSource, currentPlaybackTrackId, tracks } = get();
    const settings = useSettingsStore.getState().settings;
    const vol = typeof settings.audioVolume === 'number' ? settings.audioVolume : 0.5;
    const source = settings.audioSource || 'white-noise';

    if (source === 'white-noise' || activeSource === 'white-noise') {
      let ok = await localPlayer.resume();
      if (!ok) {
        ok = await get().playSoftWhiteNoise();
      } else {
        set({
          isPlaying: true,
          activeSource: 'white-noise',
          currentPlaybackTrackId: 'soft-white-noise',
          isManuallyPaused: false,
        });
      }
      return ok;
    } else {
      let ok = await localPlayer.resume();
      if (!ok) {
        const targetId =
          currentPlaybackTrackId ||
          localPlayer.getCurrentTrackId() ||
          settings.audioTrackId ||
          (tracks[0]?.id ?? null);
        if (targetId && tracks.some((t) => t.id === targetId)) {
          ok = await localPlayer.loadAndPlay(targetId, vol);
        }
      }
      const activeId = localPlayer.getCurrentTrackId() || currentPlaybackTrackId;
      set({
        isPlaying: ok,
        activeSource: ok ? 'tracks' : null,
        isManuallyPaused: false,
        currentPlaybackTrackId: ok ? activeId : currentPlaybackTrackId,
      });
      return ok;
    }
  },

  stopPlayback: () => {
    localPlayer.stop();
    set({
      isPlaying: false,
      isPlayingPreview: false,
      previewingTrackId: null,
    });
  },

  playNextTrack: async () => {
    const state = get();
    const settings = useSettingsStore.getState().settings;
    const mode = settings.audioMode || 'sequential';
    const nextId = getNextTrackId(localPlayer.getCurrentTrackId(), mode, state.tracks);
    if (!nextId) {
      get().stopPlayback();
      return false;
    }
    return await get().playTrack(nextId, 0);
  },
}));

// Wire track completion and error handling
localPlayer.setEndedCallback(() => {
  const state = useAudioStore.getState();

  // If preview was playing, handle preview loop or end
  if (state.isPlayingPreview) {
    if (state.previewingTrackId === 'soft-white-noise') {
      // Loop soft white noise preview
      const settings = useSettingsStore.getState().settings;
      const vol = typeof settings.audioVolume === 'number' ? settings.audioVolume : 0.5;
      localPlayer.loadAndPlay('soft-white-noise', vol, 0);
      return;
    }
    useAudioStore.setState({
      isPlayingPreview: false,
      previewingTrackId: null,
    });
    return;
  }

  // Clear saved position for completed track
  const current = localPlayer.getCurrentTrackId();
  if (current) {
    localPlayer.clearSavedPosition(current);
  }

  // If session music is playing, handle playback mode
  if (state.isPlaying) {
    const settings = useSettingsStore.getState().settings;
    const currentSource = settings.audioSource || 'white-noise';

    // If source is Soft White Noise, loop it continuously
    if (currentSource === 'white-noise' || current === 'soft-white-noise') {
      const vol = typeof settings.audioVolume === 'number' ? settings.audioVolume : 0.5;
      localPlayer.loadAndPlay('soft-white-noise', vol, 0).then(ok => {
        if (!ok) {
          useAudioStore.setState({ isPlaying: false });
        }
      });
      return;
    }

    // Otherwise, source is "My Music" ('tracks')
    const mode = settings.audioMode || 'sequential';
    if (mode === 'single') {
      const trackExists = current && state.tracks.some(t => t.id === current);
      const trackToPlay = trackExists ? current : (state.tracks[0]?.id || null);
      if (trackToPlay) {
        const vol = typeof settings.audioVolume === 'number' ? settings.audioVolume : 0.5;
        localPlayer.loadAndPlay(trackToPlay, vol, 0).then(ok => {
          if (!ok) {
            useAudioStore.setState({ isPlaying: false });
          }
        });
      } else {
        useAudioStore.setState({ isPlaying: false });
      }
    } else {
      // Sequential or shuffle in "My Music"
      useAudioStore.getState().playNextTrack();
    }
  }
});

localPlayer.setErrorCallback((err) => {
  console.warn('LocalAudioPlayer encountered error, resetting state safely:', err);
  useAudioStore.setState({
    isPlaying: false,
    isPlayingPreview: false,
    previewingTrackId: null,
  });
});
