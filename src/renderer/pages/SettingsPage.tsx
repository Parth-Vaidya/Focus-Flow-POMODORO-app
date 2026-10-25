import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../stores/settingsStore';
import { useThemeStore } from '../stores/themeStore';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Slider } from '../components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { Button } from '../components/ui/button';
import { Theme, TimerStyle, AudioPlaybackMode, BackgroundAudioSource } from '../../shared/types';
import { useAudioStore } from '../stores/audioStore';
import { toast } from '../components/ui/toaster';
import { FolderOpen, RefreshCw, Play, Square, Music } from 'lucide-react';
import { cn } from '../lib/utils';

const MS_PER_MIN = 60_000;

function msToMin(ms: number) { return Math.round(ms / MS_PER_MIN); }
function minToMs(min: number) { return min * MS_PER_MIN; }

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  htmlFor?: string;
}

function SettingRow({ label, description, children, htmlFor }: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="flex-1 min-w-0">
        {htmlFor
          ? <Label htmlFor={htmlFor} className="text-sm font-medium cursor-pointer">{label}</Label>
          : <p className="text-sm font-medium">{label}</p>
        }
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">
        {children}
      </div>
    </div>
  );
}

function DurationSlider({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <SettingRow label={label} description={`Currently: ${value} minutes`}>
      <div className="flex items-center gap-3 w-48">
        <Slider
          min={min} max={max} step={step}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          className="flex-1"
        />
        <span className="text-sm font-mono w-8 text-right tabular-nums">{value}m</span>
      </div>
    </SettingRow>
  );
}

const BUILT_IN_THEMES_FALLBACK = [
  { id: 'midnight', name: 'Midnight' },
  { id: 'dark-burgundy', name: 'Dark Burgundy' },
  { id: 'muted-plum', name: 'Muted Plum' },
  { id: 'warm-sand', name: 'Warm Sand' },
];

const TIMER_STYLES: { value: TimerStyle; label: string }[] = [
  { value: 'digital', label: 'Digital (MM:SS)' },
  { value: 'circular', label: 'Circular Ring' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { settings, update, reset } = useSettingsStore();
  const { themes, load: loadThemes, refresh: refreshThemes, openFolder: openThemesFolder } = useThemeStore();
  const {
    tracks,
    loadingLibrary,
    isPlayingPreview,
    previewingTrackId,
    isPlaying,
    softWhiteNoiseAvailable,
    softWhiteNoiseFileName,
    loadLibrary,
    refreshLibrary,
    openAudioFolder,
    selectTrack,
    previewTrack,
    previewSoftWhiteNoise,
    selectAudioSource,
    stopPreview,
    setAudioVolume,
  } = useAudioStore();

  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [refreshingThemes, setRefreshingThemes] = useState(false);
  const [refreshingAudio, setRefreshingAudio] = useState(false);

  const location = useLocation();

  useEffect(() => {
    // Visiting settings marks first-launch discovery hint as completed
    try {
      localStorage.setItem('focusflow_audio_discovery_dismissed', 'true');
    } catch {}

    const isAudioTarget =
      location.hash === '#audio' ||
      location.hash === '#audio-settings' ||
      location.hash === '#audio-bgm' ||
      location.search.includes('section=audio');

    if (isAudioTarget) {
      const scrollTimer = setTimeout(() => {
        const el = document.getElementById('audio-settings');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.add('ring-2', 'ring-primary', 'transition-all');
          setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2000);
        }
      }, 100);
      return () => clearTimeout(scrollTimer);
    }
  }, [location.hash, location.search]);

  useEffect(() => {
    loadThemes();
    loadLibrary();

    return () => {
      if (useAudioStore.getState().isPlayingPreview) {
        useAudioStore.getState().stopPreview();
      }
    };
  }, [loadThemes, loadLibrary]);

  const handleOpenThemesFolder = async () => {
    try {
      const res = await openThemesFolder();
      if (res && !res.ok) {
        toast(res.error || 'Failed to open themes folder', 'error');
      }
    } catch {
      toast('Failed to open themes folder', 'error');
    }
  };

  const handleRefreshThemes = async () => {
    setRefreshingThemes(true);
    try {
      const res = await refreshThemes();
      const count = res?.custom?.length ?? 0;
      toast(`Themes refreshed (${count} custom theme${count === 1 ? '' : 's'} found)`, 'success');
    } catch {
      toast('Failed to refresh themes', 'error');
    } finally {
      setRefreshingThemes(false);
    }
  };

  const handleOpenAudioFolder = async () => {
    try {
      const res = await openAudioFolder();
      if (res && !res.ok) {
        toast(res.error || 'Failed to open audio folder', 'error');
      }
    } catch {
      toast('Failed to open audio folder', 'error');
    }
  };

  const handleRefreshAudio = async () => {
    setRefreshingAudio(true);
    try {
      const res = await refreshLibrary();
      const count = res?.length ?? 0;
      toast(`Audio library refreshed (${count} track${count === 1 ? '' : 's'} found)`, 'success');
    } catch {
      toast('Failed to refresh audio library', 'error');
    } finally {
      setRefreshingAudio(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    await window.focusFlow.history.clear();
    toast('Session history cleared', 'success');
    setConfirmClear(false);
  };

  const handleExportCsv = async () => {
    const result = await window.focusFlow.history.exportCsv();
    if (result?.ok) toast('History exported successfully', 'success');
  };

  const handleReset = async () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    await reset();
    toast('Settings reset to defaults', 'info');
    setConfirmReset(false);
  };

  const builtInList = themes.builtIn.length > 0 ? themes.builtIn : BUILT_IN_THEMES_FALLBACK;
  const isCustomTheme = themes.custom.some(t => t.id === settings.theme);
  const isBuiltInTheme = builtInList.some(t => t.id === settings.theme);
  const isUnknownTheme = !isCustomTheme && !isBuiltInTheme;

  const hasTracks = tracks.length > 0;
  const selectedTrack = tracks.find(t => t.id === settings.audioTrackId);
  const currentTrackValue = selectedTrack ? selectedTrack.id : (tracks[0]?.id || '');
  const isUnknownTrack = Boolean(settings.audioTrackId && !selectedTrack);
  const previewingTrack = tracks.find(t => t.id === previewingTrackId);

  const isNoisePreviewing = isPlayingPreview && previewingTrackId === 'soft-white-noise';
  const isTrackPreviewing = isPlayingPreview && previewingTrackId !== 'soft-white-noise';

  const handleToggleNoisePreview = () => {
    if (isNoisePreviewing) {
      stopPreview();
    } else {
      previewSoftWhiteNoise();
    }
  };

  const handleTogglePreview = () => {
    if (isTrackPreviewing) {
      stopPreview();
    } else {
      const trackIdToPreview = currentTrackValue;
      if (trackIdToPreview) {
        previewTrack(trackIdToPreview);
      }
    }
  };

  return (
    <div className="p-5 sm:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-sm text-muted-foreground mb-8">Customize your FocusFlow experience</p>

      {/* Daily Goal */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Daily Goal</h2>
        <div className="bg-card rounded-xl border border-border px-4">
          <DurationSlider
            label="Daily Focus Goal"
            value={msToMin(settings.dailyGoalMs)}
            min={10} max={480} step={10}
            onChange={v => update({ dailyGoalMs: minToMs(v) })}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 px-1">
          Session durations and cycle counts are configured directly on the{' '}
          <button
            onClick={() => navigate('/')}
            className="text-primary hover:underline font-medium cursor-pointer"
          >
            Home dashboard
          </button>.
        </p>
      </section>

      {/* Appearance */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Appearance & Themes</h2>
        <div className="bg-card rounded-xl border border-border px-4">
          <SettingRow label="Color Theme" description="Choose a calm palette for the app and widget">
            <Select value={settings.theme} onValueChange={v => update({ theme: v as Theme })}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Built-in Themes
                </div>
                {builtInList.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}

                {themes.custom.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-t border-border mt-1 pt-1">
                      Custom Themes
                    </div>
                    {themes.custom.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>{t.name}</span>
                          {t.author && <span className="text-[10px] text-muted-foreground/80">({t.author})</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}

                {isUnknownTheme && (
                  <>
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-destructive border-t border-border mt-1 pt-1">
                      Unavailable
                    </div>
                    <SelectItem value={settings.theme}>
                      {settings.theme} (Unavailable)
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </SettingRow>
          <Separator />
          <SettingRow
            label="Custom Themes"
            description="Create or edit .json theme files in your local themes folder"
          >
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenThemesFolder}
                className="flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Open Themes Folder</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshThemes}
                disabled={refreshingThemes}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", refreshingThemes && "animate-spin")} />
                <span>Refresh Themes</span>
              </Button>
            </div>
          </SettingRow>

          {themes.custom.length === 0 ? (
            <div className="mx-0 my-2 p-3 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground">
              <p className="font-medium text-foreground/90 mb-1">No custom themes found</p>
              <p>
                Add custom <code>.json</code> theme files into your themes directory to see them here. Click <strong>Open Themes Folder</strong> to view the folder and the <code>example-theme.json</code> template, then click <strong>Refresh Themes</strong>.
              </p>
            </div>
          ) : (
            <div className="mx-0 my-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/40 text-xs text-muted-foreground flex items-center justify-between">
              <span>
                {themes.custom.length} custom theme{themes.custom.length > 1 ? 's' : ''} loaded from folder
              </span>
              <span className="text-[11px] text-muted-foreground/70">
                JSON format
              </span>
            </div>
          )}

          <Separator />
          <SettingRow label="Timer Display Style" description="Toggle between clean digital text or a circular progress ring">
            <Select value={settings.timerStyle} onValueChange={v => update({ timerStyle: v as TimerStyle })}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMER_STYLES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </section>

      {/* Audio & BGM */}
      <section id="audio-settings" className="mb-6 rounded-xl transition-all duration-300">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Audio & BGM</h2>
        <div className="bg-card rounded-xl border border-border px-4">
          {/* Background Audio Toggle */}
          <SettingRow
            label="Background Audio"
            description="Play background sound during active focus sessions"
            htmlFor="audio-enabled"
          >
            <Switch
              id="audio-enabled"
              checked={settings.audioEnabled}
              onCheckedChange={v => update({ audioEnabled: v })}
            />
          </SettingRow>

          <Separator />

          {/* Sound Source Selection */}
          <SettingRow
            label="Sound Source"
            description="Choose between the bundled ambient Soft White Noise or your own music library"
          >
            <Select
              value={settings.audioSource || 'white-noise'}
              onValueChange={v => selectAudioSource(v as BackgroundAudioSource)}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="white-noise">Soft White Noise</SelectItem>
                <SelectItem value="tracks">My Music</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          {/* Soft White Noise Source Settings */}
          {(settings.audioSource || 'white-noise') === 'white-noise' ? (
            <>
              <Separator />
              <SettingRow
                label="Soft White Noise"
                description="Packaged 56 MB high-fidelity ambient sound for distraction-free focus"
              >
                <div className="flex items-center gap-2">
                  <Button
                    variant={isNoisePreviewing ? "secondary" : "outline"}
                    size="sm"
                    onClick={handleToggleNoisePreview}
                    disabled={softWhiteNoiseAvailable === false}
                    className="flex items-center gap-1.5 shrink-0"
                    title={
                      softWhiteNoiseAvailable === false
                        ? "Audio asset missing. Please provide soft-white-noise.mp3 in application resources."
                        : isNoisePreviewing
                        ? "Stop soft white noise preview"
                        : "Preview soft white noise"
                    }
                  >
                    {isNoisePreviewing ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current text-primary" />
                        <span className="text-xs">Stop</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span className="text-xs">Preview Noise</span>
                      </>
                    )}
                  </Button>
                </div>
              </SettingRow>

              {softWhiteNoiseAvailable === false && (
                <div className="mx-0 my-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-semibold mb-1">Soft White Noise audio asset missing</p>
                  <p className="text-muted-foreground leading-relaxed">
                    The bundled 56 MB file was not found in application resources. Please place <code>soft-white-noise.mp3</code> in the project's <code>public/audio/</code> or <code>resources/audio/</code> folder.
                  </p>
                </div>
              )}

              {softWhiteNoiseAvailable === true && (
                <div className="mx-0 my-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/40 text-xs text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Bundled audio asset ready: <strong>{softWhiteNoiseFileName || 'soft-white-noise.mp3'}</strong>
                  </span>
                  <span className="text-[11px] text-muted-foreground/70">
                    Continuous Loop
                  </span>
                </div>
              )}

              {isNoisePreviewing && (
                <div className="mx-0 my-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Music className="w-3.5 h-3.5 animate-pulse shrink-0" />
                    <span>Previewing: <strong>Soft White Noise</strong> (Looping)</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={stopPreview}
                    className="h-6 px-2 text-xs text-primary hover:text-primary hover:bg-primary/20"
                  >
                    Stop
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* My Music Source Settings */}
              <Separator />
              <SettingRow
                label="Music Library"
                description="Manage audio files stored in your local FocusFlow music folder"
              >
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenAudioFolder}
                    className="flex items-center gap-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Open Music Folder</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshAudio}
                    disabled={refreshingAudio}
                    className="flex items-center gap-1.5"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", refreshingAudio && "animate-spin")} />
                    <span>Refresh Library</span>
                  </Button>
                </div>
              </SettingRow>

              {/* Library State Message */}
              {loadingLibrary ? (
                <div className="mx-0 my-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/40 text-xs text-muted-foreground">
                  Scanning local music library...
                </div>
              ) : !hasTracks ? (
                <div className="mx-0 my-2 p-3 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground/90 mb-1">No music files found</p>
                  <p>
                    Add supported audio files (<code>.mp3</code>, <code>.wav</code>, <code>.ogg</code>, <code>.flac</code>, <code>.m4a</code>, <code>.aac</code>) into your music folder. Click <strong>Open Music Folder</strong> to copy your music files, then click <strong>Refresh Library</strong>.
                  </p>
                </div>
              ) : (
                <div className="mx-0 my-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/40 text-xs text-muted-foreground flex items-center justify-between">
                  <span>
                    {tracks.length} track{tracks.length > 1 ? 's' : ''} discovered in library
                  </span>
                  <span className="text-[11px] text-muted-foreground/70">
                    MP3, WAV, OGG, FLAC, M4A, AAC
                  </span>
                </div>
              )}

              {/* Track Selection and Preview */}
              <Separator />
              <SettingRow
                label="Preferred Track"
                description="Select the default audio track for sessions and preview playback"
              >
                <div className="flex items-center gap-2">
                  {hasTracks ? (
                    <Select
                      value={currentTrackValue}
                      onValueChange={v => selectTrack(v)}
                    >
                      <SelectTrigger className="w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tracks.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="truncate max-w-[180px] inline-block">{t.name}</span>
                          </SelectItem>
                        ))}
                        {isUnknownTrack && (
                          <SelectItem value={settings.audioTrackId!}>
                            <span className="text-destructive truncate max-w-[180px] inline-block">
                              (Missing track)
                            </span>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select disabled value="none">
                      <SelectTrigger className="w-52 text-muted-foreground">
                        <SelectValue placeholder="No tracks in library" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No tracks in library</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  <Button
                    variant={isTrackPreviewing ? "secondary" : "outline"}
                    size="sm"
                    onClick={handleTogglePreview}
                    disabled={!hasTracks}
                    className="flex items-center gap-1.5 shrink-0"
                    title={isTrackPreviewing ? "Stop preview" : "Preview selected track"}
                  >
                    {isTrackPreviewing ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current text-primary" />
                        <span className="text-xs">Stop</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span className="text-xs">Preview</span>
                      </>
                    )}
                  </Button>
                </div>
              </SettingRow>

              {/* Preview Banner */}
              {isTrackPreviewing && previewingTrack && (
                <div className="mx-0 my-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Music className="w-3.5 h-3.5 animate-pulse shrink-0" />
                    <span>Previewing: <strong>{previewingTrack.name}</strong></span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={stopPreview}
                    className="h-6 px-2 text-xs text-primary hover:text-primary hover:bg-primary/20"
                  >
                    Stop
                  </Button>
                </div>
              )}

              <Separator />

              {/* Playback Mode */}
              <SettingRow
                label="Playback Mode"
                description="How tracks advance during background playback"
              >
                <Select
                  value={settings.audioMode || 'sequential'}
                  onValueChange={v => update({ audioMode: v as AudioPlaybackMode })}
                >
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">Sequential (In order)</SelectItem>
                    <SelectItem value="shuffle">Shuffle (Random track)</SelectItem>
                    <SelectItem value="single">Single (Repeat track)</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </>
          )}

          {/* Session Playback Indicator */}
          {isPlaying && (
            <div className="mx-0 my-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/40 text-xs text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Session background audio is currently active ({settings.audioSource === 'tracks' ? (selectedTrack ? selectedTrack.name : 'My Music') : 'Soft White Noise'})
              </span>
            </div>
          )}

          <Separator />

          {/* Background Audio Volume */}
          <SettingRow
            label="Background Audio Volume"
            description="Set default volume level for background audio"
          >
            <div className="flex items-center gap-3 w-48">
              <Slider
                min={0} max={1} step={0.05}
                value={[settings.audioVolume ?? 0.5]}
                onValueChange={([v]) => {
                  setAudioVolume(v);
                }}
                className="flex-1"
              />
              <span className="text-sm font-mono w-10 text-right tabular-nums">
                {Math.round((settings.audioVolume ?? 0.5) * 100)}%
              </span>
            </div>
          </SettingRow>

          <Separator />

          {/* Break Session Playback Toggle */}
          <SettingRow
            label="Play background audio during breaks"
            description="Allow background audio to continue during short and long breaks"
            htmlFor="break-audio"
          >
            <Switch
              id="break-audio"
              checked={settings.playAudioDuringBreaks}
              disabled={!settings.audioEnabled}
              onCheckedChange={v => update({ playAudioDuringBreaks: v })}
            />
          </SettingRow>

          <Separator />

          {/* Completion Alert Sound */}
          <SettingRow label="Completion Alert Sound" description="Play a gentle chime when a session finishes" htmlFor="alert-sound">
            <Switch
              id="alert-sound"
              checked={settings.alertSoundEnabled}
              onCheckedChange={v => update({ alertSoundEnabled: v })}
            />
          </SettingRow>

          <Separator />

          {/* Desktop Notifications */}
          <SettingRow label="Desktop Notifications" description="Show native OS notification when sessions complete" htmlFor="notifications">
            <Switch
              id="notifications"
              checked={settings.notificationsEnabled}
              onCheckedChange={v => update({ notificationsEnabled: v })}
            />
          </SettingRow>
        </div>
      </section>

      {/* Floating Widget */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Floating Desktop Widget</h2>
        <div className="bg-card rounded-xl border border-border px-4">
          <SettingRow label="Enable Floating Widget" description="Show the compact desktop companion widget" htmlFor="widget-visible">
            <Switch
              id="widget-visible"
              checked={settings.widgetVisible}
              onCheckedChange={async v => {
                update({ widgetVisible: v });
                if (v) await window.focusFlow.widget.show();
                else await window.focusFlow.widget.hide();
              }}
            />
          </SettingRow>
          <Separator />
          <SettingRow label="Always on Top" description="Keep widget visible above other desktop applications" htmlFor="widget-top">
            <Switch
              id="widget-top"
              checked={settings.widgetAlwaysOnTop}
              onCheckedChange={v => update({ widgetAlwaysOnTop: v })}
            />
          </SettingRow>
        </div>
      </section>

      {/* Data Management */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Data & History</h2>
        <div className="bg-card rounded-xl border border-border px-4">
          <SettingRow label="Export Session History" description="Export all completed and logged sessions to a local CSV file">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>Export CSV</Button>
          </SettingRow>
          <Separator />
          <SettingRow label="Clear Session History" description="Permanently delete all stored session records">
            <Button
              variant={confirmClear ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleClearHistory}
              onBlur={() => setConfirmClear(false)}
            >
              {confirmClear ? 'Confirm Clear' : 'Clear History'}
            </Button>
          </SettingRow>
        </div>
      </section>

      {/* Defaults */}
      <section>
        <div className="bg-card rounded-xl border border-border px-4">
          <SettingRow label="Reset All Settings" description="Restore durations, theme, and widget preferences to original defaults">
            <Button
              variant={confirmReset ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleReset}
              onBlur={() => setConfirmReset(false)}
            >
              {confirmReset ? 'Confirm Reset' : 'Reset Defaults'}
            </Button>
          </SettingRow>
        </div>
      </section>
    </div>
  );
}
