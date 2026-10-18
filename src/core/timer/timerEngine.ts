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
      remainingMs: this.settings.focusDurationMs,
    };
  }

  // ── Public controls ────────────────────────────────────────────────────────

  start(taskName: string = '', type: SessionType = 'focus'): void {
    // If starting a new cycle from idle, start with cycleCount 0
    const cycleCount = this.state.status === 'idle' ? 0 : this.state.cycleCount;
    this.beginSession(type, taskName, cycleCount);
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
    this.callbacks.onRecoverySave(this.state);
    this.emit();
  }

  skip(): void {
    if (this.state.status === 'idle') return;
    const now = Date.now();
    const taskName = this.state.taskName;

    // If currently in focus, record skipped focus session
    if (this.state.sessionType === 'focus') {
      const elapsed = Math.max(0, this.state.totalDurationMs - this.calculateRemainingMs());
      const record: SessionRecord = {
        id: this.state.sessionId || uuidv4(),
        sessionType: 'focus',
        taskName: taskName || null,
        configuredDurationMs: this.state.totalDurationMs,
        startedAt: this.state.startedAt || now,
        endedAt: now,
        activeFocusMs: elapsed,
        status: 'skipped',
      };
      this.callbacks.onSessionComplete(record);

      // Advance to the appropriate break
      const isLongBreak = (this.state.cycleCount + 1) % this.settings.longBreakInterval === 0;
      const nextBreak: SessionType = isLongBreak ? 'long-break' : 'short-break';
      this.beginSession(nextBreak, taskName, this.state.cycleCount);
    } else {
      // Skipping a break: check if the overall cycle has finished
      const totalLimit = this.settings.totalFocusSessions || this.settings.longBreakInterval;
      if (totalLimit > 0 && this.state.cycleCount >= totalLimit) {
        this.completeCycle();
      } else {
        this.beginSession('focus', taskName, this.state.cycleCount);
      }
    }
  }

  restart(): void {
    if (this.state.status === 'idle') return;
    // Restart current session cleanly
    this.beginSession(this.state.sessionType, this.state.taskName, this.state.cycleCount);
  }

  stop(): void {
    if (this.state.status === 'idle') return;
    this.stopTick();
    this.stopRecoverySave();

    const now = Date.now();
    // Record as stopped if active session
    if (this.state.sessionType === 'focus') {
      const elapsed = Math.max(0, this.state.totalDurationMs - this.calculateRemainingMs());
      const record: SessionRecord = {
        id: this.state.sessionId || uuidv4(),
        sessionType: 'focus',
        taskName: this.state.taskName || null,
        configuredDurationMs: this.state.totalDurationMs,
        startedAt: this.state.startedAt || now,
        endedAt: now,
        activeFocusMs: elapsed,
        status: 'stopped',
      };
      this.callbacks.onSessionComplete(record);
    }

    this.state = {
      ...IDLE_STATE,
      totalDurationMs: this.settings.focusDurationMs,
      remainingMs: this.settings.focusDurationMs,
      completedTodayCount: this.state.completedTodayCount,
      activeFocusMsToday: this.state.activeFocusMsToday,
      cycleCount: 0,
    };
    this.callbacks.onRecoverySave(this.state);
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
    // Only update idle total duration and remaining ms
    if (this.state.status === 'idle') {
      this.state = {
        ...this.state,
        totalDurationMs: settings.focusDurationMs,
        remainingMs: settings.focusDurationMs,
      };
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
    const taskName = this.state.taskName || '';

    if (completedType === 'focus') {
      const newCompletedToday = this.state.completedTodayCount + 1;
      const newActiveFocusMsToday = this.state.activeFocusMsToday + this.state.totalDurationMs;
      const newCycleCount = this.state.cycleCount + 1;

      // Build and persist completed focus session record
      const record: SessionRecord = {
        id: completedSessionId || uuidv4(),
        sessionType: 'focus',
        taskName: taskName || null,
        configuredDurationMs: this.state.totalDurationMs,
        startedAt: this.state.startedAt || now - this.state.totalDurationMs,
        endedAt: now,
        activeFocusMs: this.state.totalDurationMs,
        status: 'completed',
      };

      this.state.completedTodayCount = newCompletedToday;
      this.state.activeFocusMsToday = newActiveFocusMsToday;
      this.state.cycleCount = newCycleCount;

      // Notify persistence/notification layer exactly once
      this.callbacks.onSessionComplete(record);

      // Determine break type: long break interval or short break
      const isLongBreak = (newCycleCount % this.settings.longBreakInterval === 0);
      const nextBreakType: SessionType = isLongBreak ? 'long-break' : 'short-break';

      // Automatically transition to the break countdown
      this.beginSession(nextBreakType, taskName, newCycleCount);
    } else {
      // Break session completed ('short-break' or 'long-break')
      const record: SessionRecord = {
        id: completedSessionId || uuidv4(),
        sessionType: completedType,
        taskName: taskName || null,
        configuredDurationMs: this.state.totalDurationMs,
        startedAt: this.state.startedAt || now - this.state.totalDurationMs,
        endedAt: now,
        activeFocusMs: 0,
        status: 'completed',
      };

      // Notify completion chime and notification (do NOT count as completed focus session)
      this.callbacks.onSessionComplete(record);

      // Check if overall cycle is complete
      const totalLimit = this.settings.totalFocusSessions || this.settings.longBreakInterval;
      const isCycleComplete = totalLimit > 0 && this.state.cycleCount >= totalLimit;

      if (isCycleComplete) {
        // Final required break finished: complete cycle and return to Home
        this.completeCycle();
      } else {
        // Automatically start next focus session in the cycle
        this.beginSession('focus', taskName, this.state.cycleCount);
      }
    }
  }

  private completeCycle(): void {
    this.stopTick();
    this.stopRecoverySave();

    this.state = {
      ...IDLE_STATE,
      sessionType: 'focus',
      status: 'idle',
      remainingMs: this.settings.focusDurationMs,
      totalDurationMs: this.settings.focusDurationMs,
      taskName: '',
      cycleCount: 0,
      completedTodayCount: this.state.completedTodayCount,
      activeFocusMsToday: this.state.activeFocusMsToday,
    };
    this.callbacks.onRecoverySave(this.state);
    this.emit();
  }

  private beginSession(type: SessionType, taskName: string, cycleCount: number): void {
    this.stopTick();
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
      cycleCount,
      sessionActiveFocusMs: 0,
      startedAt: now,
      pausedAt: null,
      sessionId,
    };

    this.startTick();
    this.startRecoverySave();
    this.callbacks.onRecoverySave(this.state);
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
