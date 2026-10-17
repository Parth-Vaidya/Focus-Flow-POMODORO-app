import type { FocusFlowAPI } from '../../preload/index';

declare global {
  interface Window {
    focusFlow: FocusFlowAPI;
  }
}
