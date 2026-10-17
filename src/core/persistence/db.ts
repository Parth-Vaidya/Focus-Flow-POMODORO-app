import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { randomUUID } from 'crypto';
import { SessionRecord, DailyStats } from '../../shared/types';

const uuidv4 = () => randomUUID();

interface AnalyticsRow {
  date: string;
  totalFocusMs: number;
  completedSessions: number;
}

interface TaskStats {
  taskName: string | null;
  totalFocusMs: number;
  completedSessions: number;
}

interface AnalyticsResult {
  sevenDayChart: AnalyticsRow[];
  taskStats: TaskStats[];
  todayStats: { totalFocusMs: number; completedSessions: number };
}

interface StreakResult {
  currentStreak: number;
  bestStreak: number;
}

const toLocalDateString = (ts: number): string => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const today = () => toLocalDateString(Date.now());

export class Database {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'focusflow.db');
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs();
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(fileBuffer);
      } catch {
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    this.initialize();
  }

  private save(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (err) {
      console.error('Failed to save SQLite database:', err);
    }
  }

  private initialize(): void {
    if (!this.db) return;
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        sessionType TEXT NOT NULL,
        taskName TEXT,
        configuredDurationMs INTEGER NOT NULL,
        startedAt INTEGER NOT NULL,
        endedAt INTEGER NOT NULL,
        activeFocusMs INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_startedAt ON sessions(startedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_taskName ON sessions(taskName);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    `);
    this.save();
  }

  insertSession(record: SessionRecord): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO sessions
        (id, sessionType, taskName, configuredDurationMs, startedAt, endedAt, activeFocusMs, status)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      record.id || uuidv4(),
      record.sessionType,
      record.taskName || null,
      record.configuredDurationMs,
      record.startedAt,
      record.endedAt,
      record.activeFocusMs,
      record.status,
    ]);
    stmt.free();
    this.save();
  }

  getSessions(options: { limit?: number; offset?: number; taskName?: string }): SessionRecord[] {
    if (!this.db) return [];
    const { limit = 500, offset = 0, taskName } = options;
    const results: SessionRecord[] = [];

    let stmt;
    if (taskName !== undefined) {
      stmt = this.db.prepare(`
        SELECT * FROM sessions
        WHERE taskName = ?
        ORDER BY startedAt DESC
        LIMIT ? OFFSET ?
      `);
      stmt.bind([taskName, limit, offset]);
    } else {
      stmt = this.db.prepare(`
        SELECT * FROM sessions
        ORDER BY startedAt DESC
        LIMIT ? OFFSET ?
      `);
      stmt.bind([limit, offset]);
    }

    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as SessionRecord);
    }
    stmt.free();
    return results;
  }

  deleteSession(id: string): void {
    if (!this.db) return;
    this.db.run('DELETE FROM sessions WHERE id = ?', [id]);
    this.save();
  }

  clearAllSessions(): void {
    if (!this.db) return;
    this.db.run('DELETE FROM sessions');
    this.save();
  }

  getDailyStats(): DailyStats {
    const todayStr = today();
    if (!this.db) {
      return { date: todayStr, totalFocusMs: 0, completedSessions: 0, goalReached: false };
    }

    const stmt = this.db.prepare(`
      SELECT
        COALESCE(SUM(activeFocusMs), 0) as totalFocusMs,
        COUNT(*) as completedSessions
      FROM sessions
      WHERE date(startedAt / 1000, 'unixepoch', 'localtime') = ?
        AND sessionType = 'focus'
        AND status = 'completed'
    `);
    stmt.bind([todayStr]);

    let totalFocusMs = 0;
    let completedSessions = 0;
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      totalFocusMs = Number(row.totalFocusMs || 0);
      completedSessions = Number(row.completedSessions || 0);
    }
    stmt.free();

    return {
      date: todayStr,
      totalFocusMs,
      completedSessions,
      goalReached: false,
    };
  }

  getAnalytics(days: number): AnalyticsResult {
    const emptyResult: AnalyticsResult = {
      sevenDayChart: [],
      taskStats: [],
      todayStats: { totalFocusMs: 0, completedSessions: 0 },
    };
    if (!this.db) return emptyResult;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    // 7-day chart
    const chartRows: AnalyticsRow[] = [];
    const chartStmt = this.db.prepare(`
      SELECT
        date(startedAt / 1000, 'unixepoch', 'localtime') as date,
        COALESCE(SUM(activeFocusMs), 0) as totalFocusMs,
        COUNT(*) as completedSessions
      FROM sessions
      WHERE startedAt >= ?
        AND sessionType = 'focus'
        AND status = 'completed'
      GROUP BY date
      ORDER BY date ASC
    `);
    chartStmt.bind([cutoff]);
    while (chartStmt.step()) {
      const r = chartStmt.getAsObject() as any;
      chartRows.push({
        date: String(r.date),
        totalFocusMs: Number(r.totalFocusMs || 0),
        completedSessions: Number(r.completedSessions || 0),
      });
    }
    chartStmt.free();

    // Task stats
    const taskStats: TaskStats[] = [];
    const taskStmt = this.db.prepare(`
      SELECT
        taskName,
        COALESCE(SUM(activeFocusMs), 0) as totalFocusMs,
        COUNT(*) as completedSessions
      FROM sessions
      WHERE sessionType = 'focus'
        AND status = 'completed'
      GROUP BY taskName
      ORDER BY totalFocusMs DESC
      LIMIT 20
    `);
    while (taskStmt.step()) {
      const r = taskStmt.getAsObject() as any;
      taskStats.push({
        taskName: r.taskName ? String(r.taskName) : null,
        totalFocusMs: Number(r.totalFocusMs || 0),
        completedSessions: Number(r.completedSessions || 0),
      });
    }
    taskStmt.free();

    // Today stats
    const todayStr = today();
    let todayFocus = 0;
    let todaySessions = 0;
    const todayStmt = this.db.prepare(`
      SELECT
        COALESCE(SUM(activeFocusMs), 0) as totalFocusMs,
        COUNT(*) as completedSessions
      FROM sessions
      WHERE date(startedAt / 1000, 'unixepoch', 'localtime') = ?
        AND sessionType = 'focus'
        AND status = 'completed'
    `);
    todayStmt.bind([todayStr]);
    if (todayStmt.step()) {
      const r = todayStmt.getAsObject() as any;
      todayFocus = Number(r.totalFocusMs || 0);
      todaySessions = Number(r.completedSessions || 0);
    }
    todayStmt.free();

    return {
      sevenDayChart: chartRows,
      taskStats,
      todayStats: { totalFocusMs: todayFocus, completedSessions: todaySessions },
    };
  }

  getStreaks(goalMs: number): StreakResult {
    if (!this.db) return { currentStreak: 0, bestStreak: 0 };

    const rows: { date: string; totalFocusMs: number }[] = [];
    const stmt = this.db.prepare(`
      SELECT
        date(startedAt / 1000, 'unixepoch', 'localtime') as date,
        SUM(activeFocusMs) as totalFocusMs
      FROM sessions
      WHERE sessionType = 'focus' AND status = 'completed'
      GROUP BY date
      ORDER BY date DESC
    `);

    while (stmt.step()) {
      const r = stmt.getAsObject() as any;
      rows.push({
        date: String(r.date),
        totalFocusMs: Number(r.totalFocusMs || 0),
      });
    }
    stmt.free();

    if (!rows.length) return { currentStreak: 0, bestStreak: 0 };

    let currentStreak = 0;
    let bestStreak = 0;
    let streak = 0;
    let prevDate: string | null = null;
    const todayStr = today();

    for (const row of rows) {
      if (row.totalFocusMs < goalMs) {
        if (streak > bestStreak) bestStreak = streak;
        streak = 0;
        prevDate = null;
        continue;
      }

      if (prevDate === null) {
        const daysDiff = daysBetween(row.date, todayStr);
        if (daysDiff > 1) {
          if (streak > bestStreak) bestStreak = streak;
          streak = 1;
        } else {
          streak = 1;
        }
      } else {
        const daysDiff = daysBetween(row.date, prevDate);
        if (daysDiff === 1) {
          streak++;
        } else {
          if (streak > bestStreak) bestStreak = streak;
          streak = 1;
        }
      }
      prevDate = row.date;
    }

    if (streak > bestStreak) bestStreak = streak;
    currentStreak = rows[0].totalFocusMs >= goalMs ? streak : 0;

    return { currentStreak, bestStreak };
  }
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.abs(Math.round((b - a) / (1000 * 60 * 60 * 24)));
}
