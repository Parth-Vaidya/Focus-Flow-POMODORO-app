import React, { useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Slider } from '../components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { Button } from '../components/ui/button';
import { Theme, TimerStyle } from '../../shared/types';
import { toast } from '../components/ui/toaster';

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

const THEMES: { value: Theme; label: string }[] = [
  { value: 'midnight', label: 'Midnight' },
  { value: 'dark-burgundy', label: 'Dark Burgundy' },
  { value: 'muted-plum', label: 'Muted Plum' },
  { value: 'warm-sand', label: 'Warm Sand' },
];

const TIMER_STYLES: { value: TimerStyle; label: string }[] = [
  { value: 'digital', label: 'Digital (MM:SS)' },
  { value: 'circular', label: 'Circular Ring' },
];

export default function SettingsPage() {
  const { settings, update, reset } = useSettingsStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

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

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-sm text-muted-foreground mb-8">Customize your FocusFlow experience</p>

      {/* Timer durations */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Timer Configuration</h2>
        <div className="bg-card rounded-xl border border-border px-4">
          <DurationSlider
            label="Focus Duration"
            value={msToMin(settings.focusDurationMs)}
            min={1} max={120}
            onChange={v => update({ focusDurationMs: minToMs(v) })}
          />
          <Separator />
          <DurationSlider
            label="Short Break Duration"
            value={msToMin(settings.shortBreakDurationMs)}
            min={1} max={60}
            onChange={v => update({ shortBreakDurationMs: minToMs(v) })}
          />
          <Separator />
          <DurationSlider
            label="Long Break Duration"
            value={msToMin(settings.longBreakDurationMs)}
            min={1} max={120}
            onChange={v => update({ longBreakDurationMs: minToMs(v) })}
          />
          <Separator />
          <SettingRow label="Long Break Interval" description="Completed focus sessions before a long break">
            <div className="flex items-center gap-3 w-48">
              <Slider
                min={1} max={10} step={1}
                value={[settings.longBreakInterval]}
                onValueChange={([v]) => update({ longBreakInterval: v })}
                className="flex-1"
              />
              <span className="text-sm font-mono w-6 text-right tabular-nums">{settings.longBreakInterval}</span>
            </div>
          </SettingRow>
          <Separator />
          <DurationSlider
            label="Daily Focus Goal"
            value={msToMin(settings.dailyGoalMs)}
            min={10} max={480} step={10}
            onChange={v => update({ dailyGoalMs: minToMs(v) })}
          />
        </div>
      </section>

      {/* Appearance */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Appearance & Themes</h2>
        <div className="bg-card rounded-xl border border-border px-4">
          <SettingRow label="Color Theme" description="Choose a calm palette for the app and widget">
            <Select value={settings.theme} onValueChange={v => update({ theme: v as Theme })}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </SettingRow>
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

      {/* Audio & Notifications */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Audio & Notifications</h2>
        <div className="bg-card rounded-xl border border-border px-4">
          <SettingRow label="Completion Alert Sound" description="Play a gentle chime when a session finishes" htmlFor="alert-sound">
            <Switch
              id="alert-sound"
              checked={settings.alertSoundEnabled}
              onCheckedChange={v => update({ alertSoundEnabled: v })}
            />
          </SettingRow>
          <Separator />
          <SettingRow label="Brown Noise Volume" description="Set preferred background brown noise level">
            <div className="flex items-center gap-3 w-48">
              <Slider
                min={0} max={1} step={0.05}
                value={[settings.brownNoiseVolume]}
                onValueChange={([v]) => update({ brownNoiseVolume: v })}
                className="flex-1"
              />
              <span className="text-sm font-mono w-10 text-right tabular-nums">{Math.round(settings.brownNoiseVolume * 100)}%</span>
            </div>
          </SettingRow>
          <Separator />
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
