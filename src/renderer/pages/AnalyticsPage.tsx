import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { BarChart2, Target, Zap, Award, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useSettingsStore } from '../stores/settingsStore';
import { formatDurationHuman, formatDateShort } from '../lib/utils';

interface DayRow { date: string; totalFocusMs: number; completedSessions: number; }
interface TaskRow { taskName: string | null; totalFocusMs: number; completedSessions: number; }
interface AnalyticsData {
  sevenDayChart: DayRow[];
  taskStats: TaskRow[];
  todayStats: { totalFocusMs: number; completedSessions: number };
}
interface StreakData { currentStreak: number; bestStreak: number; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-medium text-foreground">{formatDurationHuman(payload[0].value)}</p>
    </div>
  );
};

export default function AnalyticsPage() {
  const settings = useSettingsStore(s => s.settings);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [streaks, setStreaks] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      window.focusFlow.analytics.get(7),
      window.focusFlow.analytics.getStreaks(),
    ]).then(([analyticsData, streakData]) => {
      setData(analyticsData as AnalyticsData);
      setStreaks(streakData as StreakData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const goalPercent = data && settings.dailyGoalMs > 0
    ? Math.min(100, (data.todayStats.totalFocusMs / settings.dailyGoalMs) * 100)
    : 0;

  // Fill chart with all 7 days even if empty
  const chartData = useMemo(() => {
    const days: { date: string; label: string; totalFocusMs: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const found = data?.sevenDayChart.find(r => r.date === dateStr);
      days.push({
        date: dateStr,
        label: i === 0 ? 'Today' : formatDateShort(d.getTime()),
        totalFocusMs: found?.totalFocusMs ?? 0,
      });
    }
    return days;
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <p className="text-muted-foreground text-sm">Loading analytics…</p>
      </div>
    );
  }

  const noData = !data || (data.todayStats.totalFocusMs === 0 && data.sevenDayChart.length === 0);

  return (
    <div className="p-5 sm:p-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <BarChart2 className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold">Analytics</h1>
      </div>

      {noData ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Zap className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">No focus sessions recorded yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Complete your first session to see metrics and charts here</p>
        </div>
      ) : (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Focus Today</p>
                <p className="text-2xl font-bold">{formatDurationHuman(data?.todayStats.totalFocusMs ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Sessions Today</p>
                <p className="text-2xl font-bold">{data?.todayStats.completedSessions ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Goal Progress</p>
                <p className="text-2xl font-bold">{Math.round(goalPercent)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-1 mb-1">
                  <Award className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Current Streak</p>
                </div>
                <p className="text-2xl font-bold">{streaks?.currentStreak ?? 0} <span className="text-sm font-normal text-muted-foreground">days</span></p>
              </CardContent>
            </Card>
          </div>

          {/* 7-day chart */}
          <Card className="mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Focus Time — Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.every(d => d.totalFocusMs === 0) ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  No focus time recorded this week
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={v => `${Math.round(v / 60000)}m`}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="totalFocusMs"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Task breakdown */}
          {data && data.taskStats.length > 0 && (
            <Card className="mb-8">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Focus Time by Task</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3.5">
                  {data.taskStats.map((task, i) => {
                    const maxMs = data.taskStats[0].totalFocusMs;
                    const pct = maxMs > 0 ? (task.totalFocusMs / maxMs) * 100 : 0;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="font-medium truncate max-w-[60%]">
                            {task.taskName ?? 'Unassigned tasks'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDurationHuman(task.totalFocusMs)} · {task.completedSessions} {task.completedSessions === 1 ? 'session' : 'sessions'}
                          </span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Streak details */}
          {streaks && (
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-primary/70 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Current Daily Streak</p>
                    <p className="text-2xl font-bold">{streaks.currentStreak} <span className="text-sm font-normal text-muted-foreground">days</span></p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Award className="w-8 h-8 text-primary/70 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Best Daily Streak</p>
                    <p className="text-2xl font-bold">{streaks.bestStreak} <span className="text-sm font-normal text-muted-foreground">days</span></p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
