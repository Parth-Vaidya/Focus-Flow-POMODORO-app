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

  // Legacy brown noise backward compatibility
  brownNoiseActive: boolean;
  startBrownNoise: () => void;
  stopBrownNoise: () => void;
  setVolume: (v: number) => void;
  toggleBrownNoise: () => void;

  // Local audio library state
  tracks: AudioTrack[];
  loadingLibrary: boolean;
  selectedTrackId: string | null;

  // Actions
  loadLibrary: () => Promise<void>;
  refreshLibrary: () => Promise<AudioTrack[]>;
  openAudioFolder: () => Promise<{ ok: boolean; error?: string }>;
  selectTrack: (trackId: string | null) => Promise<void>;
  previewTrack: (trackId: string) => Promise<void>;
  previewBrownNoise: () => void;
  stopPreview: () => void;
  setAudioVolume: (volume: number) => Promise<void>;
  setAudioMode: (mode: AudioPlaybackMode) => Promise<void>;
  toggleBgm: () => Promise<void>;

  // Session background music methods
  playTrack: (trackId: string, explicitPosition?: number) => Promise<boolean>;
  playBrownNoise: () => void;
  pausePlayback: () => void;
  resumePlayback: () => Promise<boolean>;
  stopPlayback: () => void;
  playNextTrack: () => Promise<boolean>;
}

// Brown noise generator using Web Audio API
class BrownNoisePlayer {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;

  start(volume: number): void {
    if (this.isPlaying) return;
    try {
      this.ctx = new AudioContext();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = volume;
      this.gainNode.connect(this.ctx.destination);

      const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate brown noise
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // amplify
      }

      this.source = this.ctx.createBufferSource();
      this.source.buffer = buffer;
      this.source.loop = true;
      this.source.connect(this.gainNode);
      this.source.start();
      this.isPlaying = true;
    } catch (e) {
      console.warn('Brown noise playback failed:', e);
    }
  }

  stop(): void {
    try {
      this.source?.stop();
      this.source?.disconnect();
      this.gainNode?.disconnect();
      this.ctx?.close();
    } catch {}
    this.source = null;
    this.gainNode = null;
    this.ctx = null;
    this.isPlaying = false;
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
  }

  get playing(): boolean { return this.isPlaying; }
}

const noisePlayer = new BrownNoisePlayer();

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
 * Calculates the next track ID based on the playback mode (single, sequential, shuffle).
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
      const pool = candidates.length > 0 ? candidates : tracks;
      const randomIndex = Math.floor(Math.random() * pool.length);
      return pool[randomIndex].id;
    }

    default:
      return tracks[0].id;
  }
}

/**
 * Low-level HTML5 Audio Player managing playback of local audio tracks.
 */
class LocalAudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentTrackId: string | null = null;
  private savedPositions = new Map<string, number>();
  private playGeneration = 0;
  private onTrackEnded: (() => void) | null = null;
  private onError: ((err: unknown) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.preload = 'auto';

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
      this.audio.volume = Math.max(0, Math.min(1, volume));
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
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  getCurrentTrackId(): string | null {
    return this.currentTrackId;
  }

  isPlaying(): boolean {
    return this.audio ? !this.audio.paused && !this.audio.ended : false;
  }
}

const localPlayer = new LocalAudioPlayer();

export const useAudioStore = create<AudioState>()((set, get) => ({
  // Unified active source & playback status
  activeSource: null,
  isPlaying: false,
  isPlayingPreview: false,
  previewingTrackId: null,
  currentPlaybackTrackId: null,
  volume: 0.5,
  isManuallyPaused: false,

  // Brown noise legacy compatibility
  brownNoiseActive: false,

  startBrownNoise: () => {
    get().playBrownNoise();
  },

  stopBrownNoise: () => {
    if (get().activeSource === 'brown-noise') {
      get().stopPlayback();
    } else {
      noisePlayer.stop();
      set({ brownNoiseActive: false });
    }
  },

  setVolume: (v) => {
    get().setAudioVolume(v);
  },

  toggleBrownNoise: () => {
    const { activeSource, isPlaying } = get();
    if (activeSource === 'brown-noise' && isPlaying) {
      get().stopPlayback();
    } else {
      get().playBrownNoise();
    }
  },

  // Library management
  loadLibrary: async () => {
    try {
      set({ loadingLibrary: true });
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
  previewTrack: async (trackId: string) => {
    const { previewingTrackId, isPlayingPreview } = get();
    if (previewingTrackId === trackId && isPlayingPreview) {
      get().stopPreview();
      return;
    }

    // Stop brown noise and pause active playback without wiping session track
    noisePlayer.stop();
    localPlayer.pause();

    set({
      previewingTrackId: trackId,
      isPlayingPreview: true,
      isPlaying: false,
      brownNoiseActive: false,
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

  previewBrownNoise: () => {
    const { previewingTrackId, isPlayingPreview } = get();
    if (previewingTrackId === 'brown-noise' && isPlayingPreview) {
      get().stopPreview();
      return;
    }

    localPlayer.pause();
    noisePlayer.stop();

    set({
      previewingTrackId: 'brown-noise',
      isPlayingPreview: true,
      isPlaying: false,
      brownNoiseActive: true,
    });

    const settings = useSettingsStore.getState().settings;
    const vol = typeof settings.audioVolume === 'number' ? settings.audioVolume : 0.5;
    noisePlayer.start(vol);
  },

  stopPreview: () => {
    if (!get().isPlayingPreview) return;
    localPlayer.pause();
    noisePlayer.stop();
    set({
      previewingTrackId: null,
      isPlayingPreview: false,
      brownNoiseActive: false,
    });
  },

  setAudioVolume: async (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    localPlayer.setVolume(clamped);
    noisePlayer.setVolume(clamped);
    set({ volume: clamped });
    await useSettingsStore.getState().update({ audioVolume: clamped, brownNoiseVolume: clamped });
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
  playTrack: async (trackId: string, explicitPosition?: number) => {
    if (get().isPlayingPreview) {
      get().stopPreview();
    }
    // Stop brown noise to prevent overlapping playback
    noisePlayer.stop();

    const settings = useSettingsStore.getState().settings;
    const vol = typeof settings.audioVolume === 'number' ? settings.audioVolume : 0.5;
    const ok = await localPlayer.loadAndPlay(trackId, vol, explicitPosition);
    set({
      isPlaying: ok,
      activeSource: ok ? 'tracks' : null,
      currentPlaybackTrackId: ok ? trackId : get().currentPlaybackTrackId,
      brownNoiseActive: false,
      isManuallyPaused: false,
    });
    return ok;
  },

  playBrownNoise: () => {
    if (get().isPlayingPreview) {
      get().stopPreview();
    }
    // Stop local tracks to prevent overlapping playback
    localPlayer.stop();

    const settings = useSettingsStore.getState().settings;
    const vol = typeof settings.audioVolume === 'number' ? settings.audioVolume : 0.5;
    noisePlayer.start(vol);
    set({
      isPlaying: true,
      activeSource: 'brown-noise',
      brownNoiseActive: true,
      isManuallyPaused: false,
    });
  },

  pausePlayback: () => {
    const { activeSource } = get();
    if (activeSource === 'tracks') {
      localPlayer.pause();
    } else if (activeSource === 'brown-noise') {
      noisePlayer.stop();
    }
    set({ isPlaying: false, brownNoiseActive: false });
  },

  resumePlayback: async () => {
    const { activeSource, currentPlaybackTrackId, tracks } = get();
    const settings = useSettingsStore.getState().settings;
    const vol = typeof settings.audioVolume === 'number' ? settings.audioVolume : 0.5;

    if (activeSource === 'brown-noise') {
      localPlayer.stop();
      noisePlayer.start(vol);
      set({ isPlaying: true, brownNoiseActive: true, isManuallyPaused: false });
      return true;
    } else {
      noisePlayer.stop();
      let ok = await localPlayer.resume();
      if (!ok) {
        const targetId = currentPlaybackTrackId || localPlayer.getCurrentTrackId() || settings.audioTrackId || (tracks[0]?.id ?? null);
        if (targetId && tracks.some(t => t.id === targetId)) {
          ok = await localPlayer.loadAndPlay(targetId, vol);
        }
      }
      const activeId = localPlayer.getCurrentTrackId() || currentPlaybackTrackId;
      set({
        isPlaying: ok,
        activeSource: ok ? 'tracks' : null,
        brownNoiseActive: false,
        isManuallyPaused: false,
        currentPlaybackTrackId: ok ? activeId : currentPlaybackTrackId,
      });
      return ok;
    }
  },

  stopPlayback: () => {
    localPlayer.stop();
    noisePlayer.stop();
    set({
      isPlaying: false,
      isPlayingPreview: false,
      previewingTrackId: null,
      brownNoiseActive: false,
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

  // If preview was playing, simply stop preview
  if (state.isPlayingPreview) {
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
    const mode = settings.audioMode || 'sequential';

    if (mode === 'single') {
      // Replay the single track from start if it still exists in the library
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
      // Sequential or shuffle: play next
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
