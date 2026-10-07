import { Link } from 'react-router-dom';
import type { SessionRecord } from '@/types';
import { dateTime, deg, pct } from '@/utils/format';
import { formatDuration } from '@/services/analytics/trends';
import { Badge } from '@/components/UI/primitives';

export function SessionTable({ sessions, linkBase = '/sessions' }: { sessions: SessionRecord[]; linkBase?: string }) {
  return (
    <>
    {/* Phones: compact tappable rows */}
    <ul className="divide-y divide-line/60 sm:hidden">
      {sessions.map((s) => (
        <li key={s.id}>
          <Link to={`${linkBase}/${s.id}`} className="flex items-center gap-3 py-3 active:opacity-70">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-tide/15 to-tide2/15 text-xs font-semibold text-tide tabular">{s.repetitions}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{s.exerciseName}</span>
              <span className="block text-xs text-muted">{dateTime(s.startedAt)}</span>
            </span>
            <span className="text-right text-xs tabular">
              <span className="block font-semibold">{deg(s.averageRom)}</span>
              <span className="block text-muted">{pct(s.formScore)} form</span>
            </span>
            <span className="text-muted" aria-hidden="true">›</span>
          </Link>
        </li>
      ))}
    </ul>
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2.5 pr-4 font-medium">Date</th>
            <th className="py-2.5 pr-4 font-medium">Exercise</th>
            <th className="py-2.5 pr-4 text-right font-medium">Reps</th>
            <th className="py-2.5 pr-4 text-right font-medium">Avg ROM</th>
            <th className="py-2.5 pr-4 text-right font-medium">Form</th>
            <th className="py-2.5 pr-4 text-right font-medium">Duration</th>
            <th className="py-2.5 pr-4 text-right font-medium">Pain</th>
            <th className="py-2.5 font-medium">Source</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {sessions.map((s) => (
            <tr key={s.id} className="border-b border-line/70 last:border-0 hover:bg-sunken/60">
              <td className="py-2.5 pr-4"><Link to={`${linkBase}/${s.id}`} className="text-tide hover:underline">{dateTime(s.startedAt)}</Link></td>
              <td className="py-2.5 pr-4">{s.exerciseName}</td>
              <td className="py-2.5 pr-4 text-right">{s.repetitions}/{s.targetReps}</td>
              <td className="py-2.5 pr-4 text-right">{deg(s.averageRom)}</td>
              <td className="py-2.5 pr-4 text-right">{pct(s.formScore)}</td>
              <td className="py-2.5 pr-4 text-right">{formatDuration(s.durationSec)}</td>
              <td className="py-2.5 pr-4 text-right">{s.painAfter ?? '—'}</td>
              <td className="py-2.5">{s.isDemoData ? <Badge tone="signal">Demo</Badge> : <Badge tone="tide">Camera</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
