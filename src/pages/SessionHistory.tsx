import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { backends } from '@/services/database';
import { byDate } from '@/services/analytics/trends';
import { getExercise } from '@/services/exercise/exercises';
import { SessionTable } from '@/components/Dashboard/SessionTable';
import { DemoBadge, EmptyState, ErrorBox, PageHeader, Panel, Spinner } from '@/components/UI/primitives';

export default function SessionHistory() {
  const { user } = useAuth();
  const { data, error, loading, retry } = useAsync(() => backends.data.listSessions(user!.id), [user?.id]);
  const [filter, setFilter] = useState('all');
  const [source, setSource] = useState<'all' | 'camera' | 'demo'>('all');
  const all = useMemo(() => [...(data ?? [])].sort(byDate).reverse(), [data]);
  const ids = useMemo(() => [...new Set(all.map((s) => s.exerciseId))], [all]);

  if (loading) return <Spinner label="Loading history…" />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;

  const shown = all.filter((s) => (filter === 'all' || s.exerciseId === filter) && (source === 'all' || s.mode === source));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Session history"
        subtitle={<span className="inline-flex items-center gap-2">{all.length} recorded sessions {all.some((s) => s.isDemoData) && <DemoBadge label="Includes demo data" />}</span>}
        actions={<>
          <select aria-label="Filter by exercise" className="field !w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All exercises</option>
            {ids.map((id) => <option key={id} value={id}>{getExercise(id)?.name ?? id}</option>)}
          </select>
          <select aria-label="Filter by source" className="field !w-auto" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            <option value="all">All sources</option>
            <option value="camera">Live camera</option>
            <option value="demo">Demo simulation</option>
          </select>
        </>}
      />
      {shown.length ? (
        <Panel className="p-4 sm:p-6"><SessionTable sessions={shown} /></Panel>
      ) : (
        <EmptyState title="No sessions match" body="Try another filter, or record a new session." action={<Link to="/exercises" className="btn-primary">Start an exercise</Link>} />
      )}
    </div>
  );
}
