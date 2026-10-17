import { Writable } from 'stream';

/**
 * AudioManager handles brown noise generation and alert sounds in the main process.
 * We use the Web Audio API via a renderer-side approach for brown noise,
 * but alert sounds can be played via a simple approach.
 * 
 * Since main process has no audio context, brown noise is controlled by
 * signaling the renderer via IPC. This class tracks state and the actual
 * audio operations happen in the renderer via the useAudio hook.
 */
export class AudioManager {
  private brownNoiseActive = false;
  private brownNoiseVolume = 0.4;

  startBrownNoise(volume?: number): void {
    this.brownNoiseActive = true;
    if (volume !== undefined) this.brownNoiseVolume = volume;
  }

  stopBrownNoise(): void {
    this.brownNoiseActive = false;
  }

  setBrownNoiseVolume(volume: number): void {
    this.brownNoiseVolume = volume;
  }

  isBrownNoiseActive(): boolean {
    return this.brownNoiseActive;
  }

  getBrownNoiseVolume(): number {
    return this.brownNoiseVolume;
  }

  playAlert(): void {
    // Alert is handled in renderer via Web Audio API
    // This is a state marker
  }

  destroy(): void {
    this.brownNoiseActive = false;
  }
}
