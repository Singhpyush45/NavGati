import { useState } from 'react';
import type { SessionFeedback, SessionRecord } from '@/types';
import { backends } from '@/services/database';

const FACES = ['😌', '🙂', '🙂', '😐', '😐', '😕', '😣', '😣', '😖', '😫', '😫'];
const DIFF = ['Very easy', 'Easy', 'Moderate', 'Hard', 'Very hard'];

function PainScale({ id, label, value, onChange }: { id: string; label: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <span className="tabular text-sm text-muted">{value === null ? 'not rated' : <><span className="mr-1 text-lg" aria-hidden="true">{FACES[value]}</span>{value}/10</>}</span>
      </div>
      <input id={id} type="range" min={0} max={10} step={1} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full accent-[rgb(var(--tide))]"
        style={{ background: 'linear-gradient(90deg, rgb(var(--ok)), rgb(var(--signal)) 55%, rgb(var(--alert)))' }}
        aria-valuetext={value === null ? 'not rated' : `${value} out of 10`} />
      <div className="mt-1 flex justify-between text-[10px] text-muted"><span>0 · no pain</span><span>10 · worst imaginable</span></div>
    </div>
  );
}

/** Patient-reported outcome after a session: pain before/after (0–10 NPRS) and perceived difficulty. */
export function SessionFeedbackForm({ session, onSaved }: { session: SessionRecord; onSaved?: (fb: SessionFeedback) => void }) {
  const [before, setBefore] = useState<number | null>(session.painBefore ?? null);
  const [after, setAfter] = useState<number | null>(session.painAfter ?? null);
  const [diff, setDiff] = useState<number | null>(session.difficulty ?? null);
  const [note, setNote] = useState(session.patientNote ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>(session.painAfter != null ? 'saved' : 'idle');
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setState('saving');
    const fb: SessionFeedback = { painBefore: before, painAfter: after, difficulty: diff, patientNote: note.trim() || null };
    try {
      await backends.data.updateSessionFeedback(session.id, fb);
      setState('saved'); setErr(null); onSaved?.(fb);
    } catch (e) { setState('error'); setErr((e as Error).message); }
  };

  const touched = () => state === 'saved' && setState('idle');

  return (
    <div className="space-y-5">
      <PainScale id="pb" label="Pain before the session" value={before} onChange={(v) => { setBefore(v); touched(); }} />
      <PainScale id="pa" label="Pain right now" value={after} onChange={(v) => { setAfter(v); touched(); }} />
      <div>
        <span className="text-sm font-medium">How hard did it feel?</span>
        <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Perceived difficulty">
          {DIFF.map((d, i) => (
            <button key={d} type="button" role="radio" aria-checked={diff === i + 1} onClick={() => { setDiff(i + 1); touched(); }}
              className={`rounded-xl border px-1 py-2 text-[11px] leading-tight transition-all sm:text-xs ${diff === i + 1 ? 'border-transparent bg-gradient-to-br from-tide to-tide2 font-semibold text-white shadow-md dark:text-[#04181b]' : 'border-line text-muted hover:border-tide/50'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="pn" className="text-sm font-medium">Anything your therapist should know? <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="pn" rows={2} maxLength={500} className="field mt-2 resize-none" value={note} onChange={(e) => { setNote(e.target.value); touched(); }} placeholder="e.g. knee felt stiff at the start" />
      </div>
      {after !== null && after >= 7 && (
        <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">You reported high pain. Please stop exercising and contact your therapist before your next session.</p>
      )}
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={state === 'saving' || (before === null && after === null && diff === null)}>
          {state === 'saving' ? 'Saving…' : state === 'saved' ? '✓ Saved' : 'Save how it felt'}
        </button>
        {state === 'error' && <span className="text-sm text-alert">{err}</span>}
      </div>
    </div>
  );
}
