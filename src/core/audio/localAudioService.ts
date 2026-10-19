import { app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { AudioTrack } from '../../shared/types';

export const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];

export const SOFT_WHITE_NOISE_BASENAMES = [
  'soft-white-noise',
  'soft_white_noise',
  'soft white noise',
  'softwhitenoise',
  'white-noise',
  'white_noise',
  'whitenoise',
];

export function isSoftWhiteNoiseFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  if (!SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) return false;
  const base = path.basename(fileName, ext).toLowerCase().trim();
  return SOFT_WHITE_NOISE_BASENAMES.includes(base);
}

export class LocalAudioService {
  private audioDir: string;

  constructor() {
    this.audioDir = path.join(app.getPath('userData'), 'audio');
    this.initAudioDir();
  }

  getAudioDirectory(): string {
    return this.audioDir;
  }

  /**
   * Resolves the bundled Soft White Noise audio file from packaged application resources
   * or development locations. Never searches the user-data audio directory.
   */
  getBundledSoftWhiteNoiseFile(): string | null {
    const candidateFiles: string[] = [];

    // 1. Packaged extraResources location (production)
    if (process.resourcesPath) {
      candidateFiles.push(path.join(process.resourcesPath, 'audio', 'soft-white-noise.mp3'));
      candidateFiles.push(path.join(process.resourcesPath, 'soft-white-noise.mp3'));
    }

    // 2. Application path (development or unpackaged)
    const appPath = app.getAppPath();
    candidateFiles.push(path.join(appPath, 'public', 'audio', 'soft-white-noise.mp3'));
    candidateFiles.push(path.join(appPath, 'resources', 'audio', 'soft-white-noise.mp3'));
    candidateFiles.push(path.join(appPath, 'dist', 'audio', 'soft-white-noise.mp3'));

    // 3. Relative to build directory (dev server)
    candidateFiles.push(path.resolve(__dirname, '../../public/audio/soft-white-noise.mp3'));
    candidateFiles.push(path.resolve(__dirname, '../../resources/audio/soft-white-noise.mp3'));

    for (const filePath of candidateFiles) {
      try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          return filePath;
        }
      } catch {}
    }

    // Check candidate directories for any file with supported extension and soft-white-noise basename
    const candidateDirs = [
      process.resourcesPath ? path.join(process.resourcesPath, 'audio') : null,
      process.resourcesPath ? process.resourcesPath : null,
      path.join(appPath, 'public', 'audio'),
      path.join(appPath, 'resources', 'audio'),
      path.join(appPath, 'dist', 'audio'),
      path.resolve(__dirname, '../../public/audio'),
      path.resolve(__dirname, '../../resources/audio'),
    ].filter(Boolean) as string[];

    for (const dir of candidateDirs) {
      try {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            if (isSoftWhiteNoiseFile(file)) {
              const fullPath = path.join(dir, file);
              if (fs.statSync(fullPath).isFile()) {
                return fullPath;
              }
            }
          }
        }
      } catch {}
    }

    return null;
  }

  getSoftWhiteNoiseFile(): string | null {
    return this.getBundledSoftWhiteNoiseFile();
  }

  private initAudioDir(): void {
    try {
      if (!fs.existsSync(this.audioDir)) {
        fs.mkdirSync(this.audioDir, { recursive: true });
      }

      const readmePath = path.join(this.audioDir, 'README.txt');
      const readmeContent = `FocusFlow Local Music Directory
====================================
Place your local music and audio files here to listen to them during focus sessions when "My Music" is selected!

Supported formats:
- MP3 (.mp3)
- WAV (.wav)
- OGG (.ogg)
- FLAC (.flac)
- M4A (.m4a)
- AAC (.aac)

After adding or removing files, click "Refresh Library" in FocusFlow Settings -> Audio & Notifications.
`;
      fs.writeFileSync(readmePath, readmeContent, 'utf8');
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

  /**
   * Scans user-data audio directory for user music tracks.
   * Bundled application sounds are never included here.
   */
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
          const formattedName = baseName.replace(/[-_]/g, ' ').trim() || fileName;

          tracks.push({
            id: Buffer.from(fileName).toString('base64'),
            name: formattedName,
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
