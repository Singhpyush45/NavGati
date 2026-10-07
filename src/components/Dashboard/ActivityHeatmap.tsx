import type { SessionRecord } from '@/types';
import { activityCalendar } from '@/services/analytics/trends';

const LEVEL = ['bg-sunken', 'bg-tide/35', 'bg-tide/65', 'bg-gradient-to-br from-tide to-tide2'];

/** GitHub-style 12-week activity calendar (Mon → Sun columns). */
export function ActivityHeatmap({ sessions, weeks = 12 }: { sessions: SessionRecord[]; weeks?: number }) {
  const days = activityCalendar(sessions, weeks);
  const cols = Array.from({ length: weeks }, (_, w) => days.slice(w * 7, w * 7 + 7));
  const active = days.filter((d) => d.count > 0).length;
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-1" role="img" aria-label={`${active} active days in the last ${weeks} weeks`}>
        <div className="mr-1 grid grid-rows-7 gap-1 text-[10px] leading-none text-muted">
          {['M', '', 'W', '', 'F', '', 'S'].map((d, i) => <span key={i} className="grid h-3.5 place-items-center sm:h-4">{d}</span>)}
        </div>
        {cols.map((col, ci) => (
          <div key={ci} className="grid grid-rows-7 gap-1">
            {col.map((d, di) => (
              <span key={d.key} title={d.future ? '' : `${d.key}: ${d.count} session${d.count === 1 ? '' : 's'}`}
                className={`h-3.5 w-3.5 rounded-[4px] transition-transform hover:scale-125 sm:h-4 sm:w-4 ${d.future ? 'opacity-0' : LEVEL[Math.min(3, d.count)]}`}
                style={{ animation: `rise .5s ${(ci * 7 + di) * 6}ms both` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>{active} active days · last {weeks} weeks</span>
        <span className="flex items-center gap-1">Less {LEVEL.map((c, i) => <span key={i} className={`h-3 w-3 rounded-[3px] ${c}`} />)} More</span>
      </div>
    </div>
  );
}
