import { create } from 'zustand';
import { TimerState, SessionType } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/constants';

const DEFAULT_TIMER_STATE: TimerState = {
  sessionType: 'focus',
  status: 'idle',
  remainingMs: DEFAULT_SETTINGS.focusDurationMs,
  totalDurationMs: DEFAULT_SETTINGS.focusDurationMs,
  taskName: '',
  cycleCount: 0,
  completedTodayCount: 0,
  activeFocusMsToday: 0,
  sessionActiveFocusMs: 0,
  startedAt: null,
  pausedAt: null,
  sessionId: null,
};

interface TimerStoreState {
  timerState: TimerState;
  hasRecovery: boolean;
  recoveryDismissed: boolean;
  setTimerState: (state: TimerState) => void;
  syncFromMain: () => Promise<void>;
  checkRecovery: () => Promise<void>;
  dismissRecovery: () => void;
  resumeRecovery: () => Promise<boolean>;
  // Controls
  start: (taskName: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  skip: () => Promise<void>;
  restart: () => Promise<void>;
  stop: () => Promise<void>;
}

export const useTimerStore = create<TimerStoreState>()((set, get) => ({
  timerState: DEFAULT_TIMER_STATE,
  hasRecovery: false,
  recoveryDismissed: false,

  setTimerState: (state) => set({ timerState: state }),

  syncFromMain: async () => {
    try {
      const json = await window.focusFlow.timer.getState();
      const state = JSON.parse(json as string);
      set({ timerState: state });
    } catch {}
  },

  checkRecovery: async () => {
    try {
      const recovery = await window.focusFlow.recovery.get();
      if (recovery && recovery.timerState) {
        set({ hasRecovery: true });
      }
    } catch {}
  },

  dismissRecovery: () => {
    set({ hasRecovery: false, recoveryDismissed: true });
    window.focusFlow.recovery.dismiss();
  },

  resumeRecovery: async () => {
    try {
      const result = await window.focusFlow.recovery.resume() as { ok: boolean; state?: string };
      if (!result?.ok) {
        // No valid recovery state — clear the banner silently
        set({ hasRecovery: false, recoveryDismissed: true });
        return false;
      }
      // Apply the restored (paused) timer state immediately
      if (result.state) {
        const restoredState = JSON.parse(result.state);
        set({ timerState: restoredState, hasRecovery: false, recoveryDismissed: true });
      } else {
        set({ hasRecovery: false, recoveryDismissed: true });
      }
      return true;
    } catch {
      set({ hasRecovery: false, recoveryDismissed: true });
      return false;
    }
  },

  start: async (taskName) => {
    await window.focusFlow.timer.start(taskName);
  },

  pause: async () => {
    await window.focusFlow.timer.pause();
  },

  resume: async () => {
    await window.focusFlow.timer.resume();
  },

  skip: async () => {
    await window.focusFlow.timer.skip();
  },

  restart: async () => {
    await window.focusFlow.timer.restart();
  },

  stop: async () => {
    await window.focusFlow.timer.stop();
  },
}));
