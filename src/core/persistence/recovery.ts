import Store from 'electron-store';
import { RecoveryState } from '../../shared/types';
import { APP_VERSION } from '../../shared/constants';

export class RecoveryStore {
  private store: Store<{ recovery: RecoveryState | null }>;

  constructor() {
    this.store = new Store<{ recovery: RecoveryState | null }>({
      name: 'recovery',
      defaults: { recovery: null },
    });
  }

  save(state: RecoveryState): void {
    try {
      this.store.set('recovery', state);
    } catch (e) {
      // Ignore write errors
    }
  }

  load(): RecoveryState | null {
    try {
      const data = this.store.get('recovery');
      if (!data) return null;
      // Validate
      if (!data.timerState || !data.savedAt) return null;
      if (data.timerState.status === 'idle' || data.timerState.status === 'completed') return null;
      return data;
    } catch {
      return null;
    }
  }

  clear(): void {
    this.store.set('recovery', null);
  }
}
