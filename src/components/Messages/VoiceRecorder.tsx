import { useEffect, useRef, useState } from 'react';
import type { VoiceClip } from '@/types';
import { MESSAGE_LIMITS } from '@/services/analytics/messages';

function pickMime(): string {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result));
  r.onerror = () => rej(r.error);
  r.readAsDataURL(b);
});

/** Records a short voice note with the browser microphone (MediaRecorder). Max 60 s. */
export function VoiceRecorder({ clip, onChange }: { clip: VoiceClip | null; onChange: (c: VoiceClip | null) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const timer = useRef<number | null>(null);

  const stopTracks = () => rec.current?.stream.getTracks().forEach((t) => t.stop());
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); stopTracks(); }, []);

  const start = async () => {
    setErr(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErr('Voice notes are not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = async () => {
        stopTracks();
        if (timer.current) window.clearInterval(timer.current);
        setState('processing');
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
        const durationSec = Math.max(1, Math.round((performance.now() - started.current) / 1000));
        if (blob.size > MESSAGE_LIMITS.voiceBytes) { setErr('That recording is too large. Try a shorter one.'); setState('idle'); return; }
        onChange({ dataUrl: await blobToDataUrl(blob), durationSec, mime: blob.type });
        setState('idle');
      };
      rec.current = r;
      started.current = performance.now();
      setSecs(0);
      r.start(250);
      setState('recording');
      timer.current = window.setInterval(() => {
        const s = Math.round((performance.now() - started.current) / 1000);
        setSecs(s);
        if (s >= MESSAGE_LIMITS.voiceSec) r.stop();
      }, 250);
    } catch {
      setErr('Microphone permission was denied. Allow the mic in your browser settings to send voice notes.');
    }
  };

  const stop = () => rec.current?.state === 'recording' && rec.current.stop();

  if (clip) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line/60 bg-sunken/40 p-2.5">
        <audio controls src={clip.dataUrl} className="h-9 max-w-full" />
        <span className="tabular text-xs text-muted">{clip.durationSec}s</span>
        <button type="button" className="text-xs text-alert hover:underline" onClick={() => onChange(null)}>Discard</button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {state === 'recording' ? (
        <button type="button" onClick={stop} className="btn-secondary !py-2 text-sm !text-alert" aria-live="polite">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-alert" aria-hidden="true" /> Stop · <span className="tabular">{secs}s / {MESSAGE_LIMITS.voiceSec}s</span>
        </button>
      ) : (
        <button type="button" onClick={start} disabled={state === 'processing'} className="btn-secondary !py-2 text-sm">
          🎙 {state === 'processing' ? 'Processing…' : 'Record voice note'}
        </button>
      )}
      {err && <span className="text-xs text-alert">{err}</span>}
    </div>
  );
}
