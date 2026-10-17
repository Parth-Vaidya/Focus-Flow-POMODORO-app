import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Clock, Trash2, Download, Search, CheckCircle2, XCircle, SkipForward } from 'lucide-react';
import { SessionRecord } from '../../shared/types';
import { formatDateShort, formatTimeShort, formatDurationHuman, cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from '../components/ui/toaster';

const STATUS_CONFIG: Record<string, { label: string; icon: React.FC<any>; className: string }> = {
  completed: { label: 'Completed', icon: CheckCircle2, className: 'text-[hsl(var(--timer-focus))]' },
  stopped: { label: 'Stopped', icon: XCircle, className: 'text-muted-foreground' },
  skipped: { label: 'Skipped', icon: SkipForward, className: 'text-muted-foreground' },
  interrupted: { label: 'Interrupted', icon: XCircle, className: 'text-muted-foreground' },
  paused: { label: 'Paused', icon: XCircle, className: 'text-muted-foreground' },
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  focus: 'Focus',
  'short-break': 'Short Break',
  'long-break': 'Long Break',
};

function SessionRow({ session, onDelete }: { session: SessionRecord; onDelete: (id: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const config = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.stopped;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 py-3 px-4 hover:bg-secondary/40 rounded-lg group transition-colors">
      <div className="mt-0.5 shrink-0">
        <Icon className={cn('w-4 h-4', config.className)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate max-w-xs">
            {session.taskName ?? 'Unassigned tasks'}
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
            {SESSION_TYPE_LABELS[session.sessionType] ?? session.sessionType}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{formatDateShort(session.startedAt)} at {formatTimeShort(session.startedAt)}</span>
          {session.sessionType === 'focus' && session.status === 'completed' && (
            <span>· {formatDurationHuman(session.activeFocusMs)} focused</span>
          )}
          <span>· {config.label}</span>
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => {
            if (!confirmDelete) { setConfirmDelete(true); return; }
            onDelete(session.id);
          }}
          onBlur={() => setConfirmDelete(false)}
          className={cn(
            'p-1.5 rounded text-sm transition-colors cursor-pointer',
            confirmDelete
              ? 'text-destructive bg-destructive/10'
              : 'text-muted-foreground hover:text-destructive'
          )}
          aria-label={confirmDelete ? 'Confirm delete' : 'Delete session'}
          title={confirmDelete ? 'Click again to confirm' : 'Delete'}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      const result = await window.focusFlow.history.get({ limit: 300 });
      setSessions(result || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleDelete = async (id: string) => {
    await window.focusFlow.history.delete(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    toast('Session record deleted', 'info');
  };

  const handleExport = async () => {
    const result = await window.focusFlow.history.exportCsv();
    if (result?.ok) toast('History exported successfully', 'success');
  };

  const filtered = sessions.filter(s =>
    !search ||
    (s.taskName ?? 'Unassigned tasks').toLowerCase().includes(search.toLowerCase())
  );

  // Group sessions by local date
  const groups = useMemo(() => {
    const map = new Map<string, SessionRecord[]>();
    for (const s of filtered) {
      const d = new Date(s.startedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Session History</h1>
        </div>
        {sessions.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        )}
      </div>

      {sessions.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by task name…"
            className="pl-9"
          />
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Clock className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">No sessions recorded yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Your recorded focus and break sessions will appear here</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">No results found for &ldquo;{search}&rdquo;</p>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, group]) => {
            const focusMs = group.filter(s => s.sessionType === 'focus' && s.status === 'completed')
              .reduce((sum, s) => sum + s.activeFocusMs, 0);
            const d = new Date(group[0].startedAt);
            const label = (() => {
              const today = new Date();
              const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
              if (d.toDateString() === today.toDateString()) return 'Today';
              if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
              return formatDateShort(d.getTime());
            })();
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h3>
                  {focusMs > 0 && (
                    <span className="text-xs text-muted-foreground">{formatDurationHuman(focusMs)} focused</span>
                  )}
                </div>
                <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                  {group.map((session) => (
                    <SessionRow key={session.id} session={session} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
