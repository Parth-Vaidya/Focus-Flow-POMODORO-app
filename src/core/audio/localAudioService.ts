import { app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { AudioTrack } from '../../shared/types';

export const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];

export class LocalAudioService {
  private audioDir: string;

  constructor() {
    this.audioDir = path.join(app.getPath('userData'), 'audio');
    this.initAudioDir();
  }

  getAudioDirectory(): string {
    return this.audioDir;
  }

  private initAudioDir(): void {
    try {
      if (!fs.existsSync(this.audioDir)) {
        fs.mkdirSync(this.audioDir, { recursive: true });
      }

      const readmePath = path.join(this.audioDir, 'README.txt');
      if (!fs.existsSync(readmePath)) {
        const readmeContent = `FocusFlow Background Audio Directory
====================================
Place your local audio files here to listen to them during focus sessions!

Supported formats:
- MP3 (.mp3)
- WAV (.wav)
- OGG (.ogg)
- FLAC (.flac)
- M4A (.m4a)
- AAC (.aac)

After copying or deleting audio files, click "Refresh Audio Library" in FocusFlow Settings -> Audio & Notifications.
`;
        fs.writeFileSync(readmePath, readmeContent, 'utf8');
      }
    } catch (err) {
      console.warn('Failed to initialize audio directory:', err);
    }
  }

  openAudioFolder(): void {
    try {
      if (!fs.existsSync(this.audioDir)) {
        fs.mkdirSync(this.audioDir, { recursive: true });
      }
      shell.openPath(this.audioDir);
    } catch (err) {
      console.error('Failed to open audio folder:', err);
    }
  }

  getTracks(): AudioTrack[] {
    const tracks: AudioTrack[] = [];
    try {
      if (!fs.existsSync(this.audioDir)) return [];
      const files = fs.readdirSync(this.audioDir);

      for (const fileName of files) {
        const ext = path.extname(fileName).toLowerCase();
        if (!SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) continue;

        const fullPath = path.join(this.audioDir, fileName);
        try {
          const stats = fs.statSync(fullPath);
          if (!stats.isFile()) continue;

          // Clean title without extension
          const baseName = path.basename(fileName, ext);
          const formattedName = baseName.replace(/[-_]/g, ' ').trim();

          tracks.push({
            id: Buffer.from(fileName).toString('base64'),
            name: formattedName || fileName,
            fileName,
            path: fullPath,
            sizeBytes: stats.size,
          });
        } catch {}
      }
    } catch (err) {
      console.warn('Failed to scan audio directory:', err);
    }

    return tracks;
  }
}
