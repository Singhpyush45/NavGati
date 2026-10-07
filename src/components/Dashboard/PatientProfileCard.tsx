import type { PatientSummary } from '@/types';
import { shortDate } from '@/utils/format';

const weeksSince = (iso?: string) => (iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / (7 * 864e5))) : null);

/** Patient background for the therapist: demographics, diagnosis, timeline, goal, contacts. */
export function PatientProfileCard({ patient }: { patient: PatientSummary }) {
  const p = patient.profile ?? {};
  const rows: [string, string | undefined][] = [
    ['Age / gender', [p.age ? `${p.age} yrs` : '', p.gender ?? ''].filter(Boolean).join(' · ') || undefined],
    ['Diagnosis', p.diagnosis ?? patient.condition],
    ['Affected side', p.affectedSide ? p.affectedSide[0].toUpperCase() + p.affectedSide.slice(1) : undefined],
    ['Injury / surgery', p.injuryDate ? `${shortDate(p.injuryDate)} (${weeksSince(p.injuryDate)} weeks ago)` : undefined],
    ['Rehab started', p.programStart ? `${shortDate(p.programStart)} (week ${(weeksSince(p.programStart) ?? 0) + 1})` : undefined],
    ['City', p.city],
    ['Phone', p.phone],
    ['Emergency contact', p.emergencyContact],
  ];
  const initials = patient.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-tide to-violet text-lg font-semibold text-white" aria-hidden="true">{initials}</span>
        <div>
          <div className="text-lg font-semibold">{patient.name}</div>
          <div className="text-xs text-muted">{patient.patientCode}{patient.condition ? ` · ${patient.condition}` : ''}</div>
        </div>
      </div>
      {p.goal && (
        <div className="mt-4 rounded-xl bg-tideSoft/60 p-3 text-sm"><span className="text-xs font-medium text-tide">Patient goal</span><p className="mt-0.5">{p.goal}</p></div>
      )}
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5">{v}</dd></div>
        ))}
      </dl>
      {!patient.profile && <p className="mt-3 text-xs text-muted">No profile details added yet.</p>}
    </div>
  );
}
