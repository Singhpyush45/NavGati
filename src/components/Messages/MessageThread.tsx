import { useEffect, useRef, useState } from 'react';
import type { AppUser, MessageCategory, PatientMessage, VoiceClip } from '@/types';
import { backends } from '@/services/database';
import { CATEGORY_LABEL, MESSAGE_LIMITS, validateMessage } from '@/services/analytics/messages';
import { Badge } from '@/components/UI/primitives';
import { dateTime } from '@/utils/format';
import { VoiceRecorder } from './VoiceRecorder';

const CATEGORY_TONE: Record<MessageCategory, 'neutral' | 'alert' | 'tide' | 'signal'> = {
  general: 'neutral', pain: 'alert', question: 'tide', problem: 'signal',
};

/**
 * Patient ⇄ therapist conversation with text + voice notes.
 * Patients pick a category (pain / question / problem) so the therapist can triage.
 */
export function MessageThread({ patientId, me, initial, height = 420 }: {
  patientId: string; me: AppUser; initial: PatientMessage[]; height?: number;
}) {
  const role: 'PATIENT' | 'THERAPIST' = me.role === 'PATIENT' ? 'PATIENT' : 'THERAPIST';
  const [messages, setMessages] = useState(initial);
  const [body, setBody] = useState('');
  const [clip, setClip] = useState<VoiceClip | null>(null);
  const [category, setCategory] = useState<MessageCategory>(role === 'PATIENT' ? 'question' : 'general');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);
  useEffect(() => {
    // Opening the thread marks the other side's messages as read.
    backends.data.markMessagesRead(patientId, role).catch(() => undefined);
    // Light polling so new messages show up during the demo without a refresh.
    const t = window.setInterval(async () => {
      try { setMessages(await backends.data.listMessages(patientId)); } catch { /* offline: keep current */ }
    }, 8000);
    return () => window.clearInterval(t);
  }, [patientId, role]);

  const problem = validateMessage({ body, audio: clip });
  const send = async () => {
    if (problem) { setErr(problem); return; }
    setBusy(true); setErr(null);
    try {
      const m = await backends.data.sendMessage({ patientId, senderRole: role, senderId: me.id, senderName: me.name, category, body, audio: clip });
      setMessages((xs) => [...xs, m]); setBody(''); setClip(null);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="space-y-3 overflow-y-auto rounded-xl border border-line/60 bg-sunken/30 p-3" style={{ maxHeight: height }} aria-live="polite">
        {messages.length === 0 && <p className="p-4 text-center text-sm text-muted">No messages yet.</p>}
        {messages.map((m) => {
          const mine = m.senderRole === role;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${mine ? 'rounded-br-md bg-tide text-white dark:text-[#04181b]' : 'rounded-bl-md border border-line/60 bg-surface'}`}>
                <div className={`mb-1 flex flex-wrap items-center gap-2 text-[11px] ${mine ? 'text-white/80 dark:text-[#04181b]/70' : 'text-muted'}`}>
                  <span className="font-medium">{mine ? 'You' : m.senderName}</span>
                  <span>{dateTime(m.createdAt)}</span>
                  {m.senderRole === 'PATIENT' && m.category !== 'general' && !mine && <Badge tone={CATEGORY_TONE[m.category]}>{CATEGORY_LABEL[m.category]}</Badge>}
                </div>
                {m.body && <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>}
                {m.audio && (
                  <div className="mt-2 flex items-center gap-2">
                    <audio controls preload="none" src={m.audio.dataUrl} className="h-9 max-w-[240px]" aria-label={`Voice note, ${m.audio.durationSec} seconds`} />
                    <span className={`tabular text-[11px] ${mine ? 'text-white/80' : 'text-muted'}`}>🎙 {m.audio.durationSec}s</span>
                  </div>
                )}
                {mine && <div className="mt-1 text-right text-[10px] opacity-75">{m.readAt ? 'Seen' : 'Sent'}</div>}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <div className="no-print mt-3 space-y-3">
        {role === 'PATIENT' && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What is this about?">
            {(['question', 'pain', 'problem', 'general'] as MessageCategory[]).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={category === c} onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1 text-xs transition ${category === c ? 'border-tide bg-tideSoft text-tide' : 'border-line text-muted hover:text-ink'}`}>
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        )}
        <label htmlFor={`msg-${patientId}`} className="sr-only">Message</label>
        <textarea id={`msg-${patientId}`} rows={3} maxLength={MESSAGE_LIMITS.body} className="field resize-none" value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={role === 'PATIENT' ? 'Tell your therapist what’s happening — pain, a question, or a problem…' : 'Reply to the patient…'}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }} />
        <VoiceRecorder clip={clip} onChange={setClip} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">{body.length}/{MESSAGE_LIMITS.body} · Ctrl+Enter to send</span>
          <button type="button" className="btn-primary !py-2" onClick={send} disabled={busy || !!problem}>{busy ? 'Sending…' : 'Send'}</button>
        </div>
        {err && <p className="text-sm text-alert">{err}</p>}
        {role === 'PATIENT' && <p className="text-xs text-muted">Not for emergencies. If pain is severe or sudden, stop exercising and contact your doctor.</p>}
      </div>
    </div>
  );
}
