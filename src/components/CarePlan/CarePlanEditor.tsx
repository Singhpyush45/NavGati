import { useState } from 'react';
import type { AppUser, CarePlan, CarePlanItem, SidePreference } from '@/types';
import { backends } from '@/services/database';
import { EXERCISES } from '@/services/exercise/exercises';
import { PLAN_LIMITS, validateCarePlan } from '@/services/analytics/carePlan';
import { dateTime } from '@/utils/format';

const SUPPORTED = EXERCISES.filter((e) => e.supported);
const toInt = (v: string) => (v.trim() === '' ? NaN : Math.round(Number(v)));

/** Therapist editor for a patient's weekly care plan (exercise prescription). */
export function CarePlanEditor({ patientId, author, initial, onSaved }: {
  patientId: string; author: AppUser; initial: CarePlan | null; onSaved: (p: CarePlan) => void;
}) {
  const [items, setItems] = useState<CarePlanItem[]>(initial?.items ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(initial?.updatedAt ?? null);
  const [dirty, setDirty] = useState(false);
  const errors = validateCarePlan(items);

  const update = (i: number, patch: Partial<CarePlanItem>) => {
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    setDirty(true);
  };
  const add = () => {
    const free = SUPPORTED.find((e) => !items.some((x) => x.exerciseId === e.id));
    if (!free) return;
    setItems((xs) => [...xs, { exerciseId: free.id, side: 'auto', targetReps: 12, sessionsPerWeek: 3, targetRom: null, instructions: '' }]);
    setDirty(true);
  };
  const remove = (i: number) => { setItems((xs) => xs.filter((_, j) => j !== i)); setDirty(true); };

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const clean = items.map((x) => ({ ...x, instructions: x.instructions?.trim() || undefined, targetRom: x.targetRom || null }));
      const p = await backends.data.saveCarePlan({ patientId, items: clean, updatedById: author.id, updatedByName: author.name }, author.role);
      setSavedAt(p.updatedAt); setDirty(false); onSaved(p);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="no-print">
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="rounded-xl border border-line/60 p-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(150px,1.6fr)_minmax(80px,1fr)_minmax(70px,0.8fr)_minmax(70px,0.8fr)_minmax(80px,0.9fr)_auto] sm:items-end">
              <label className="text-xs text-muted">Exercise
                <select className="field mt-1" value={it.exerciseId} onChange={(e) => update(i, { exerciseId: e.target.value })}>
                  {SUPPORTED.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-muted">Side
                <select className="field mt-1" value={it.side} onChange={(e) => update(i, { side: e.target.value as SidePreference })}>
                  <option value="auto">Auto</option><option value="left">Left</option><option value="right">Right</option>
                </select>
              </label>
              <label className="text-xs text-muted">Reps
                <input type="number" min={1} max={50} className="field mt-1" value={Number.isNaN(it.targetReps) ? '' : it.targetReps} onChange={(e) => update(i, { targetReps: toInt(e.target.value) })} />
              </label>
              <label className="text-xs text-muted">Per week
                <input type="number" min={1} max={14} className="field mt-1" value={Number.isNaN(it.sessionsPerWeek) ? '' : it.sessionsPerWeek} onChange={(e) => update(i, { sessionsPerWeek: toInt(e.target.value) })} />
              </label>
              <label className="text-xs text-muted">ROM goal (°)
                <input type="number" min={1} max={180} placeholder="optional" className="field mt-1" value={it.targetRom ?? ''} onChange={(e) => update(i, { targetRom: e.target.value ? toInt(e.target.value) : null })} />
              </label>
              <button type="button" className="btn-secondary !py-2 text-sm" onClick={() => remove(i)} aria-label={`Remove exercise ${i + 1}`}>Remove</button>
            </div>
            <label className="mt-3 block text-xs text-muted">Instruction for the patient
              <input className="field mt-1" maxLength={PLAN_LIMITS.instructions} placeholder="e.g. Keep the thigh supported. Stop if pain is above 5/10." value={it.instructions ?? ''} onChange={(e) => update(i, { instructions: e.target.value })} />
            </label>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="text-sm text-muted">No exercises yet.</p>}

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-alert">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>
      )}
      {err && <p className="mt-3 text-sm text-alert">{err}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary !py-2" onClick={add} disabled={items.length >= PLAN_LIMITS.maxItems}>+ Add exercise</button>
        <button type="button" className="btn-primary !py-2" onClick={save} disabled={busy || errors.length > 0 || !dirty}>{busy ? 'Saving…' : 'Save care plan'}</button>
        <span className="text-xs text-muted">{dirty ? 'Unsaved changes' : savedAt ? `Saved ${dateTime(savedAt)}` : ''}</span>
      </div>
    </div>
  );
}
