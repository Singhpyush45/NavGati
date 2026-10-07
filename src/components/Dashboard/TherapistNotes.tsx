import { useState } from 'react';
import type { AppUser, TherapistNote } from '@/types';
import { backends } from '@/services/database';
import { dateTime } from '@/utils/format';

/** Therapist → patient notes. The newest note is shown on the patient's home screen. */
export function TherapistNotes({ patientId, author, initial }: { patientId: string; author: AppUser; initial: TherapistNote[] }) {
  const [notes, setNotes] = useState(initial);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    if (!body.trim()) return;
    setBusy(true); setErr(null);
    try {
      const n = await backends.data.addNote({ patientId, authorId: author.id, authorName: author.name, body });
      setNotes((x) => [n, ...x]); setBody('');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="no-print">
        <label htmlFor="note" className="sr-only">New note to the patient</label>
        <textarea id="note" rows={3} maxLength={1000} className="field resize-none" value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note the patient will see on their home screen…" />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-muted">{body.length}/1000</span>
          <button className="btn-primary !py-2" onClick={add} disabled={busy || !body.trim()}>{busy ? 'Sending…' : 'Send note'}</button>
        </div>
        {err && <p className="mt-2 text-sm text-alert">{err}</p>}
      </div>
      <ul className="mt-5 space-y-3">
        {notes.length === 0 && <li className="text-sm text-muted">No notes yet.</li>}
        {notes.map((n) => (
          <li key={n.id} className="fade-in rounded-xl border border-line/60 bg-sunken/40 p-3">
            <div className="text-xs text-muted">{n.authorName} · {dateTime(n.createdAt)}</div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
