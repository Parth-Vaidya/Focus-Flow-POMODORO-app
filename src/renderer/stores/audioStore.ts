import { create } from 'zustand';

interface AudioState {
  brownNoiseActive: boolean;
  volume: number;
  startBrownNoise: () => void;
  stopBrownNoise: () => void;
  setVolume: (v: number) => void;
  toggleBrownNoise: () => void;
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

export const useAudioStore = create<AudioState>()((set, get) => ({
  brownNoiseActive: false,
  volume: 0.4,

  startBrownNoise: () => {
    noisePlayer.start(get().volume);
    set({ brownNoiseActive: true });
    window.focusFlow?.audio?.startBrownNoise(get().volume);
  },

  stopBrownNoise: () => {
    noisePlayer.stop();
    set({ brownNoiseActive: false });
    window.focusFlow?.audio?.stopBrownNoise();
  },

  setVolume: (v) => {
    set({ volume: v });
    noisePlayer.setVolume(v);
    window.focusFlow?.audio?.setBrownNoiseVolume(v);
  },

  toggleBrownNoise: () => {
    const { brownNoiseActive, startBrownNoise, stopBrownNoise } = get();
    if (brownNoiseActive) stopBrownNoise();
    else startBrownNoise();
  },
}));
