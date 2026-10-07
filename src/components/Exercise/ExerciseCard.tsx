import { Link } from 'react-router-dom';
import type { ExerciseConfig } from '@/types';
import { Badge } from '@/components/UI/primitives';
import { JOINT_LABEL } from '@/services/exercise/exercises';
import { ExercisePreview } from './ExercisePreview';

export function ExerciseCard({ ex, canStart }: { ex: ExerciseConfig; canStart: boolean }) {
  return (
    <article className="panel panel-hover group flex flex-col overflow-hidden">
      <div className="relative overflow-hidden">
        <ExercisePreview exercise={ex} className="transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">{JOINT_LABEL[ex.joint]}</span>
          {ex.supported && <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium capitalize text-white backdrop-blur">{ex.cameraView === 'any' ? 'Side or front' : `${ex.cameraView} view`}</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold">{ex.name}</h3>
          {ex.supported ? <Badge tone="tide">{ex.difficulty}</Badge> : <Badge>Not supported yet</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted">{ex.movement} · {ex.position.replace(/-/g, ' ')}</p>
        <ol className="mt-4 flex-1 space-y-2 text-sm text-muted">
          {ex.instructions.map((i, n) => (
            <li key={i} className="flex gap-2.5"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-tideSoft text-[11px] font-semibold text-tide">{n + 1}</span>{i}</li>
          ))}
        </ol>
        <div className="mt-5">
          {!ex.supported ? (
            <p className="text-sm text-muted">Exercise not supported yet.</p>
          ) : canStart ? (
            <Link to={`/setup?exercise=${ex.id}`} className="btn-primary w-full">Start exercise →</Link>
          ) : (
            <p className="text-xs text-muted">Patients start exercises from their account.</p>
          )}
        </div>
      </div>
    </article>
  );
}
