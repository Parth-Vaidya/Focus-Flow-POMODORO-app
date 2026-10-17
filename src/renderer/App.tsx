import React, { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useSettingsStore } from './stores/settingsStore';
import { useTimerStore } from './stores/timerStore';
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
  const loadSettings = useSettingsStore(s => s.load);
  const syncTimer = useTimerStore(s => s.syncFromMain);
  const checkRecovery = useTimerStore(s => s.checkRecovery);

  useEffect(() => {
    // Load settings from main process
    loadSettings();
    // Sync initial timer state
    syncTimer();
    // Check for recovery data
    checkRecovery();

    // Subscribe to timer state updates
    window.focusFlow.timer.onStateUpdate((stateJson: string) => {
      try {
        const state = JSON.parse(stateJson);
        useTimerStore.getState().setTimerState(state);
      } catch {}
    });

    // Handle navigation from main process
    window.focusFlow.onNavigate((route: string) => {
      navigate(route);
    });
  }, [loadSettings, syncTimer, checkRecovery, navigate]);

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
