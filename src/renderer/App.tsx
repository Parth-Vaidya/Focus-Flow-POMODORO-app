import React, { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useSettingsStore } from './stores/settingsStore';
import { useTimerStore } from './stores/timerStore';
import { useAudioStore } from './stores/audioStore';
import { initAudioLifecycle } from './stores/audioLifecycle';
import { ThemeProvider } from './components/ThemeProvider';
import { Toaster } from './components/ui/toaster';
import HomePage from './pages/HomePage';
import ActiveSessionPage from './pages/ActiveSessionPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/Layout';
import RecoveryBanner from './components/RecoveryBanner';

export default function App() {
  const navigate = useNavigate();
  const navigateRef = React.useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    // 1. Initial loads from main process
    useSettingsStore.getState().load();
    useTimerStore.getState().syncFromMain();
    useTimerStore.getState().checkRecovery();
    useAudioStore.getState().loadLibrary();

    // 2. Persistent background audio timer lifecycle coordinator
    const cleanupAudioLifecycle = initAudioLifecycle();

    // 3. Subscribe to timer state updates with exact unsubscription cleanup
    const unsubTimer = window.focusFlow.timer.onStateUpdate((stateJson: string) => {
      try {
        const state = JSON.parse(stateJson);
        useTimerStore.getState().setTimerState(state);
      } catch {}
    });

    // 4. Handle navigation from main process with exact unsubscription cleanup
    const unsubNavigate = window.focusFlow.onNavigate((route: string) => {
      navigateRef.current(route);
    });

    return () => {
      unsubTimer?.();
      unsubNavigate?.();
      cleanupAudioLifecycle?.();
    };
  }, []);

  return (
    <ThemeProvider>
      <Layout>
        <RecoveryBanner />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/session" element={<ActiveSessionPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
      <Toaster />
    </ThemeProvider>
  );
}
