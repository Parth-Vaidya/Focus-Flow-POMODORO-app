import { randomUUID } from 'crypto';
const uuidv4 = () => randomUUID();
import {
  TimerState,
  SessionType,
  SessionStatus,
  SessionRecord,
  AppSettings,
  RecoveryState,
} from '../../shared/types';
import { DEFAULT_SETTINGS, RECOVERY_SAVE_INTERVAL_MS, TIMER_TICK_MS } from '../../shared/constants';

interface TimerEngineCallbacks {
  settings: AppSettings;
  onStateChange: (state: TimerState) => void;
  onSessionComplete: (record: SessionRecord) => void;
  onRecoverySave: (state: TimerState) => void;
}

const IDLE_STATE: TimerState = {
  sessionType: 'focus',
  status: 'idle',
  remainingMs: 0,
  totalDurationMs: 0,
  taskName: '',
  cycleCount: 0,
  completedTodayCount: 0,
  activeFocusMsToday: 0,
  sessionActiveFocusMs: 0,
  startedAt: null,
  pausedAt: null,
  sessionId: null,
};

export class TimerEngine {
  private state: TimerState;
  private settings: AppSettings;
  private callbacks: TimerEngineCallbacks;
  private tickInterval: NodeJS.Timeout | null = null;
  private recoverySaveInterval: NodeJS.Timeout | null = null;
  private sessionStartWallMs: number | null = null; // wall clock when session (re)started
  private sessionDeadlineMs: number | null = null;   // wall clock deadline for completion
  private sessionPausedRemainingMs: number | null = null; // remaining ms at pause time
  private accumulatedPausedMs: number = 0; // total paused ms in this session run
  private pauseWallMs: number | null = null;

  constructor(callbacks: TimerEngineCallbacks) {
    this.callbacks = callbacks;
    this.settings = callbacks.settings;
    this.state = {
      ...IDLE_STATE,
      totalDurationMs: this.settings.focusDurationMs,
    };
  }

  // ── Public controls ────────────────────────────────────────────────────────

  start(taskName: string = '', type: SessionType = 'focus'): void {
    this.stopTick();
    const duration = this.getDurationForType(type);
    const now = Date.now();
    const sessionId = uuidv4();

    this.sessionDeadlineMs = now + duration;
    this.sessionStartWallMs = now;
    this.accumulatedPausedMs = 0;
    this.pauseWallMs = null;
    this.sessionPausedRemainingMs = null;

    this.state = {
      ...this.state,
      sessionType: type,
      status: 'running',
      remainingMs: duration,
      totalDurationMs: duration,
      taskName,
      sessionActiveFocusMs: 0,
      startedAt: now,
      pausedAt: null,
      sessionId,
    };

    this.startTick();
    this.startRecoverySave();
    this.emit();
  }

  pause(): void {
    if (this.state.status !== 'running') return;
    const now = Date.now();
    this.pauseWallMs = now;
    this.sessionPausedRemainingMs = this.calculateRemainingMs();

    this.stopTick();
    this.state = {
      ...this.state,
      status: 'paused',
      remainingMs: this.sessionPausedRemainingMs,
      pausedAt: now,
    };
    this.callbacks.onRecoverySave(this.state);
    this.emit();
  }

  resume(): void {
    if (this.state.status !== 'paused') return;
    const now = Date.now();
    const remaining = this.sessionPausedRemainingMs ?? this.state.remainingMs;

    // Accumulate paused time
    if (this.pauseWallMs !== null) {
      this.accumulatedPausedMs += now - this.pauseWallMs;
    }
    this.pauseWallMs = null;
    this.sessionPausedRemainingMs = null;

    // Recalculate deadline from now
    this.sessionDeadlineMs = now + remaining;

    this.state = {
      ...this.state,
      status: 'running',
      remainingMs: remaining,
      pausedAt: null,
    };

    this.startTick();
    this.emit();
  }

  skip(): void {
    if (this.state.status === 'idle') return;
    this.stopTick();
    this.stopRecoverySave();

    // Do not count an unfinished focus session — reset to idle on Home
    this.state = {
      ...IDLE_STATE,
      sessionType: 'focus',
      status: 'idle',
      remainingMs: this.settings.focusDurationMs,
      totalDurationMs: this.settings.focusDurationMs,
      taskName: '',
      cycleCount: this.state.cycleCount,
      completedTodayCount: this.state.completedTodayCount,
      activeFocusMsToday: this.state.activeFocusMsToday,
    };
    this.emit();
  }

  restart(): void {
    if (this.state.status === 'idle') return;
    this.stopTick();
    const now = Date.now();
    const duration = this.getDurationForType(this.state.sessionType);

    this.sessionDeadlineMs = now + duration;
    this.sessionStartWallMs = now;
    this.accumulatedPausedMs = 0;
    this.pauseWallMs = null;
    this.sessionPausedRemainingMs = null;

    const sessionId = uuidv4();
    this.state = {
      ...this.state,
      status: 'running',
      remainingMs: duration,
      totalDurationMs: duration,
      sessionActiveFocusMs: 0,
      startedAt: now,
      pausedAt: null,
      sessionId,
    };

    this.startTick();
    this.callbacks.onRecoverySave(this.state);
    this.emit();
  }

  stop(): void {
    this.stopTick();
    this.stopRecoverySave();

    this.state = {
      ...IDLE_STATE,
      totalDurationMs: this.settings.focusDurationMs,
      completedTodayCount: this.state.completedTodayCount,
      activeFocusMsToday: this.state.activeFocusMsToday,
      cycleCount: this.state.cycleCount,
    };
    this.emit();
  }

  // ── Recovery restore ───────────────────────────────────────────────────────

  restoreFromRecovery(recovery: RecoveryState): void {
    const { timerState } = recovery;
    // Restore as paused regardless of previous status
    this.sessionPausedRemainingMs = timerState.remainingMs;
    this.pauseWallMs = null;
    this.accumulatedPausedMs = 0;
    this.sessionDeadlineMs = null;
    this.sessionStartWallMs = null;

    this.state = {
      ...timerState,
      status: 'paused',
      pausedAt: Date.now(),
    };

    this.startRecoverySave();
    this.emit();
  }

  // ── Settings update ────────────────────────────────────────────────────────

  updateSettings(settings: AppSettings): void {
    this.settings = settings;
    // Only update idle total duration
    if (this.state.status === 'idle') {
      this.state = { ...this.state, totalDurationMs: settings.focusDurationMs };
      this.emit();
    }
  }

  getState(): TimerState {
    if (this.state.status === 'running') {
      return { ...this.state, remainingMs: this.calculateRemainingMs() };
    }
    return { ...this.state };
  }

  destroy(): void {
    this.stopTick();
    this.stopRecoverySave();
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private calculateRemainingMs(): number {
    if (!this.sessionDeadlineMs) return this.state.remainingMs;
    const remaining = this.sessionDeadlineMs - Date.now();
    return Math.max(0, remaining);
  }

  private startTick(): void {
    this.stopTick();
    this.tickInterval = setInterval(() => this.tick(), TIMER_TICK_MS);
  }

  private stopTick(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private startRecoverySave(): void {
    this.stopRecoverySave();
    this.recoverySaveInterval = setInterval(() => {
      if (this.state.status === 'running' || this.state.status === 'paused') {
        this.callbacks.onRecoverySave(this.getState());
      }
    }, RECOVERY_SAVE_INTERVAL_MS);
  }

  private stopRecoverySave(): void {
    if (this.recoverySaveInterval) {
      clearInterval(this.recoverySaveInterval);
      this.recoverySaveInterval = null;
    }
  }

  private tick(): void {
    if (this.state.status !== 'running') return;

    const remaining = this.calculateRemainingMs();

    // Update active focus ms for focus sessions
    if (this.state.sessionType === 'focus') {
      const elapsed = this.state.totalDurationMs - remaining;
      this.state = { ...this.state, sessionActiveFocusMs: Math.max(0, elapsed) };
    }

    this.state = { ...this.state, remainingMs: remaining };
    this.emit();

    if (remaining <= 0) {
      this.onSessionComplete();
    }
  }

  private onSessionComplete(): void {
    this.stopTick();
    this.stopRecoverySave();

    const now = Date.now();
    const completedType = this.state.sessionType;
    const completedSessionId = this.state.sessionId;

    // Build and persist record
    const record: SessionRecord = {
      id: completedSessionId || uuidv4(),
      sessionType: completedType,
      taskName: this.state.taskName || null,
      configuredDurationMs: this.state.totalDurationMs,
      startedAt: this.state.startedAt || now - this.state.totalDurationMs,
      endedAt: now,
      activeFocusMs: completedType === 'focus' ? this.state.totalDurationMs : 0,
      status: 'completed',
    };

    // Update counters for focus sessions
    let newCycleCount = this.state.cycleCount;
    let newCompletedToday = this.state.completedTodayCount;
    let newActiveFocusMsToday = this.state.activeFocusMsToday;

    if (completedType === 'focus') {
      newCycleCount = (this.state.cycleCount + 1) % this.settings.longBreakInterval;
      newCompletedToday = this.state.completedTodayCount + 1;
      newActiveFocusMsToday = this.state.activeFocusMsToday + this.state.totalDurationMs;
    }

    // Notify persistence/notification layer exactly once
    this.callbacks.onSessionComplete(record);

    // STOP the automatic cycle and return the main UI to Home
    this.state = {
      ...IDLE_STATE,
      sessionType: 'focus',
      status: 'idle',
      remainingMs: this.settings.focusDurationMs,
      totalDurationMs: this.settings.focusDurationMs,
      taskName: '',
      cycleCount: newCycleCount,
      completedTodayCount: newCompletedToday,
      activeFocusMsToday: newActiveFocusMsToday,
    };
    this.emit();
  }

  private getNextSessionType(completing: boolean): SessionType {
    if (this.state.sessionType !== 'focus') {
      // After any break -> focus
      return 'focus';
    }

    if (!completing) {
      // Skip without completing: go to the appropriate break anyway
      // Use existing cycle count
      const count = this.state.cycleCount;
      const atLongBreak = count > 0 && count % this.settings.longBreakInterval === 0;
      return atLongBreak ? 'long-break' : 'short-break';
    }

    // Completing a focus session: new count is state.cycleCount+1
    // newCycleCount was already computed as (count+1) % interval
    // If count+1 reaches interval, it's a long break
    const nextCount = this.state.cycleCount + 1;
    if (nextCount % this.settings.longBreakInterval === 0) {
      return 'long-break';
    }
    return 'short-break';
  }

  private beginSession(type: SessionType, taskName: string): void {
    const now = Date.now();
    const duration = this.getDurationForType(type);
    const sessionId = uuidv4();

    this.sessionDeadlineMs = now + duration;
    this.sessionStartWallMs = now;
    this.accumulatedPausedMs = 0;
    this.pauseWallMs = null;
    this.sessionPausedRemainingMs = null;

    this.state = {
      ...this.state,
      sessionType: type,
      status: 'running',
      remainingMs: duration,
      totalDurationMs: duration,
      taskName,
      sessionActiveFocusMs: 0,
      startedAt: now,
      pausedAt: null,
      sessionId,
    };

    this.startTick();
    this.startRecoverySave();
    this.emit();
  }

  private getDurationForType(type: SessionType): number {
    switch (type) {
      case 'focus': return this.settings.focusDurationMs;
      case 'short-break': return this.settings.shortBreakDurationMs;
      case 'long-break': return this.settings.longBreakDurationMs;
    }
  }

  private emit(): void {
    this.callbacks.onStateChange(this.getState());
  }
}
