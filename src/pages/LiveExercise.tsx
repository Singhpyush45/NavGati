import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { AnalysisResult, FeedbackItem, MovementState, PoseFrame, SidePreference } from '@/types';
import { getExercise } from '@/services/exercise/exercises';
import { MovementEngine } from '@/services/movement/movementEngine';
import { FeedbackStabilizer } from '@/algorithms/feedbackEngine';
import { indexOf } from '@/algorithms/landmarks';
import { qualityLabel } from '@/algorithms/formAssessment';
import { buildSessionRecord } from '@/services/analytics/sessionBuilder';
import { formatDuration } from '@/services/analytics/trends';
import { backends } from '@/services/database';
import { usePoseStream } from '@/hooks/usePoseStream';
import { PoseStage } from '@/components/Camera/PoseStage';
import { FeedbackList } from '@/components/Feedback/FeedbackList';
import { Badge, Disclaimer, EmptyState, Panel } from '@/components/UI/primitives';
import { useAuth } from '@/context/AuthContext';
import { getPrefs } from '@/utils/prefs';
import { deg, pct, uid } from '@/utils/format';
import type { Facing } from '@/services/pose/camera';
import { Confetti, CountUp, ProgressRing } from '@/components/FX/motion';

const STATE_LABEL: Record<MovementState, string> = {
  REST: 'At start position',
  MOVING: 'Moving',
  PEAK: 'Peak reached',
  RETURNING: 'Returning',
};

interface View {
  result: AnalysisResult | null;
  feedback: FeedbackItem[];
  elapsedMs: number;
}

/** Speak short phrases (rep counts) if the patient enabled voice feedback. */
function say(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  } catch { /* speech unavailable — silent fallback */ }
}

export default function LiveExercise() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const exercise = getExercise(params.get('exercise'));
  const side = (['left', 'right', 'auto'].includes(params.get('side') ?? '') ? params.get('side') : 'auto') as SidePreference;
  const targetReps = Math.max(1, Math.min(50, Number(params.get('reps')) || getPrefs().defaultTargetReps));
  const mode: 'camera' | 'demo' = params.get('mode') === 'demo' ? 'demo' : 'camera';
  const facing: Facing = params.get('cam') === 'environment' ? 'environment' : 'user';

  if (!exercise || !exercise.supported) {
    return (
      <EmptyState
        title="Exercise not supported yet."
        body="This movement can’t be measured reliably by the current version of RehabX. Please choose another exercise, or follow your therapist’s instructions for this one."
        action={<Link to="/exercises" className="btn-primary">Back to exercise library</Link>}
      />
    );
  }
  return <LiveSession key={`${exercise.id}-${side}-${targetReps}-${mode}-${facing}`} exerciseId={exercise.id} side={side} targetReps={targetReps} mode={mode} facing={facing}
    onFinished={(id, state) => navigate(`/sessions/${id}`, { state })} patientId={user!.id} />;
}

/** Keeps the phone screen awake during a session (where the browser supports it). */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let dead = false;
    const req = async () => {
      try { lock = await (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen'); if (dead) lock?.release(); } catch { /* not allowed — ignore */ }
    };
    req();
    const onVis = () => { if (document.visibilityState === 'visible') req(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { dead = true; document.removeEventListener('visibilitychange', onVis); lock?.release().catch(() => {}); };
  }, [on]);
}

const vibrate = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };

function LiveSession({ exerciseId, side, targetReps, mode, facing, patientId, onFinished }: {
  exerciseId: string; side: SidePreference; targetReps: number; mode: 'camera' | 'demo'; facing: Facing; patientId: string;
  onFinished: (id: string, state: unknown) => void;
}) {
  const exercise = getExercise(exerciseId)!;
  // The engine and helpers live in refs: they change every frame, React should not re-render for them.
  const engine = useMemo(() => new MovementEngine(exercise, side, targetReps), [exercise, side, targetReps]);
  const stabilizer = useRef(new FeedbackStabilizer());
  const latest = useRef<AnalysisResult | null>(null);
  const shownFeedback = useRef<FeedbackItem[]>([]);
  const startedAt = useRef<number | null>(null); // wall-clock ms of first analysed frame
  const activeMs = useRef(0); // time spent un-paused
  const lastTick = useRef<number | null>(null);
  const stageWrap = useRef<HTMLDivElement>(null);
  const [paused, setPausedState] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<View>({ result: null, feedback: [], elapsedMs: 0 });
  const [demoFlags, setDemoFlags] = useState({ leave: false, second: false });
  const [popKey, setPopKey] = useState(0);
  const [confetti, setConfetti] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const lastRep = useRef(0);
  const prefs = getPrefs();

  // ── Per-frame work (called from requestAnimationFrame, NOT from React) ──
  const onFrame = useCallback((frame: PoseFrame) => {
    const r = engine.analyze(frame);
    latest.current = r;
    if (startedAt.current === null && r.confidence.ok) startedAt.current = Date.now();
    shownFeedback.current = stabilizer.current.update(r.feedback, performance.now());
    const s = r.side;
    return {
      highlight: s ? (exercise.landmarks.map((p) => indexOf(p, s)) as [number, number, number]) : null,
      angle: r.confidence.ok ? r.jointAngle : null,
      angleLabel: `${exercise.joint[0].toUpperCase()}${exercise.joint.slice(1)}`,
      status: (r.confidence.ok ? (r.exerciseMatch === 'mismatch' ? 'warn' : 'ok') : 'error') as 'ok' | 'warn' | 'error',
    };
  }, [engine, exercise]);

  const stream = usePoseStream({ mode, exercise, onFrame, facing });
  useWakeLock(stream.status === 'running' && !saving);
  // `stream` is a fresh object each render; keep a stable handle for effects/timers.
  const pauseStream = useRef(stream.setPaused);
  pauseStream.current = stream.setPaused;

  // ── 3-2-1 countdown once the camera/model is ready ──
  const started = useRef(false);
  useEffect(() => {
    if (stream.status !== 'running' || started.current) return;
    started.current = true;
    pauseStream.current(true);
    setCountdown(3);
  }, [stream.status]);
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { pauseStream.current(false); const t = setTimeout(() => setCountdown(null), 600); return () => clearTimeout(t); }
    vibrate(40);
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 850);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── UI refresh ~8×/s: decoupled from the 30–60 fps analysis loop ──
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const running = !paused && countdown === null;
      if (running && startedAt.current !== null && lastTick.current !== null) activeMs.current += now - lastTick.current;
      lastTick.current = now;
      const r = latest.current;
      if (r && r.repCount > lastRep.current) {
        lastRep.current = r.repCount;
        setPopKey((k) => k + 1);
        if (r.repCount === targetReps) { setConfetti(Date.now()); vibrate([60, 40, 60, 40, 120]); } else vibrate(50);
        if (prefs.voiceFeedback) say(r.repCount >= targetReps ? `${r.repCount}. Target reached.` : String(r.repCount));
      }
      setView({ result: r, feedback: shownFeedback.current, elapsedMs: activeMs.current });
    }, 120);
    return () => clearInterval(id);
  }, [paused, countdown, prefs.voiceFeedback, targetReps]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const canFullscreen = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageWrap.current?.requestFullscreen();
    } catch { /* ignore */ }
  };

  const togglePause = () => {
    const next = !paused;
    setPausedState(next);
    stream.setPaused(next);
  };

  const restart = () => {
    engine.reset();
    stabilizer.current = new FeedbackStabilizer();
    latest.current = null;
    shownFeedback.current = [];
    startedAt.current = null;
    activeMs.current = 0;
    lastRep.current = 0;
    setView({ result: null, feedback: [], elapsedMs: 0 });
    setPausedState(false);
    stream.setPaused(true);
    setCountdown(3);
  };

  const setFlag = (k: 'leave' | 'second', v: boolean) => {
    const sim = stream.simRef.current;
    if (sim) { if (k === 'leave') sim.simulateLeaveFrame = v; else sim.simulateSecondPerson = v; }
    setDemoFlags((f) => ({ ...f, [k]: v }));
  };

  const endSession = async () => {
    setSaving(true);
    stream.setPaused(true);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const end = Date.now();
    // Duration counts only active (un-paused) time.
    const record = buildSessionRecord(engine.getState(), exercise, {
      id: uid(), patientId, startedAt: end - Math.round(activeMs.current), endedAt: end, targetReps, mode,
    });
    try {
      await backends.data.saveSession(record);
      onFinished(record.id, { justSaved: true, record });
    } catch (e) {
      onFinished(record.id, { record, saveError: (e as Error).message || 'The session could not be saved.' });
    }
  };

  const r = view.result;
  const reps = r?.repCount ?? 0;
  const done = reps >= targetReps;
  const liveQuality = r?.formScore != null ? qualityLabel(r.formScore) : null;
  const jointName = `${exercise.joint[0].toUpperCase()}${exercise.joint.slice(1)}`;
  const topFeedback = view.feedback[0];
  const fbTone = topFeedback?.severity === 'error' ? 'bg-alert/90' : topFeedback?.severity === 'warning' ? 'bg-[#b97a12]/90' : 'bg-ok/85';

  return (
    <div className="space-y-4">
      <Confetti fire={confetti} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{exercise.name}</h1>
          <p className="text-sm text-muted">{exercise.position === 'seated' ? 'Seated' : 'Standing'} · {r?.side ? `${r.side} side` : side === 'auto' ? 'side detected automatically' : `${side} side`} · {mode === 'demo' ? 'simulated input' : 'processed on this device'}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button className="btn-secondary flex-1 whitespace-nowrap !px-3 sm:flex-none sm:!px-4" onClick={togglePause} disabled={saving || stream.status !== 'running' || countdown !== null}>{paused ? '▶ Resume' : '❚❚ Pause'}</button>
          <button className="btn-secondary flex-1 whitespace-nowrap !px-3 sm:flex-none sm:!px-4" onClick={restart} disabled={saving || stream.status !== 'running'}>↺ Restart</button>
          <button className="btn-primary flex-1 whitespace-nowrap !px-3 sm:flex-none sm:!px-4" onClick={endSession} disabled={saving || stream.status === 'starting-camera' || stream.status === 'loading-model'}>
            {saving ? 'Saving…' : 'End session'}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div ref={stageWrap} className={fullscreen ? 'grid h-full place-items-center bg-black' : ''}>
            <PoseStage videoRef={stream.videoRef} canvasRef={stream.canvasRef} mode={mode} status={stream.status} error={stream.error}
              aspect={stream.aspect} mirrored={stream.mirrored} className={fullscreen ? '!max-h-screen !rounded-none' : ''}>
              {/* ── HUD: large enough to read from 2–3 m away ── */}
              {stream.status === 'running' && (
                <>
                  <div className="absolute right-2 top-2 z-10 flex origin-top-right scale-[.82] flex-col items-end gap-2 sm:right-3 sm:top-3 sm:scale-100">
                    <div className="rounded-2xl bg-black/45 p-1.5 backdrop-blur-md">
                      <ProgressRing value={reps} max={targetReps} size={92} stroke={8}>
                        <div key={popKey} className="pop text-white">
                          <div className="text-3xl font-bold leading-none tabular">{reps}</div>
                          <div className="text-[10px] text-white/70">of {targetReps}</div>
                        </div>
                      </ProgressRing>
                    </div>
                    {r?.confidence.ok && (
                      <div className="rounded-xl bg-black/45 px-3 py-1.5 text-right text-white backdrop-blur-md">
                        <div className="text-[10px] text-white/70">{jointName} angle</div>
                        <div className="text-xl font-bold tabular text-[#F2BE5C]">{deg(r.jointAngle)}</div>
                      </div>
                    )}
                    {canFullscreen && (
                      <button onClick={toggleFullscreen} className="grid h-9 w-9 place-items-center rounded-xl bg-black/45 text-white backdrop-blur-md" aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={fullscreen ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} /></svg>
                      </button>
                    )}
                  </div>
                  {topFeedback && countdown === null && !paused && !done && (
                    <div key={topFeedback.message} className={`fade-in absolute inset-x-3 bottom-3 z-10 mx-auto w-fit max-w-[92%] rounded-2xl px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg backdrop-blur-md sm:text-base ${fbTone}`} aria-live="polite">
                      {topFeedback.message}
                    </div>
                  )}
                </>
              )}
              {countdown !== null && (
                <div className="absolute inset-0 z-20 grid place-items-center bg-[#04181b]/55 backdrop-blur-[2px]">
                  <div key={countdown} className="pop text-center text-white">
                    <div className="font-display text-[110px] leading-none drop-shadow-[0_0_30px_rgba(56,189,248,.8)]">{countdown === 0 ? 'Go!' : countdown}</div>
                    <p className="mt-2 text-sm text-white/80">{countdown === 0 ? 'Move slowly and with control' : 'Get into the start position'}</p>
                  </div>
                </div>
              )}
              {paused && (
                <div className="absolute inset-0 z-20 grid place-items-center bg-[#04181b]/60 backdrop-blur-sm">
                  <button onClick={togglePause} className="grid h-20 w-20 place-items-center rounded-full bg-white/15 text-3xl text-white ring-1 ring-white/30 transition-transform hover:scale-110" aria-label="Resume">▶</button>
                </div>
              )}
              {done && !paused && (
                <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-tide to-tide2 px-4 py-3 text-sm text-white shadow-xl">
                  <span className="font-medium">🎉 Prescribed repetitions completed.</span>
                  <button className="rounded-xl bg-white px-3 py-1.5 font-semibold text-[#0b3b3d]" onClick={endSession} disabled={saving}>Finish</button>
                </div>
              )}
            </PoseStage>
          </div>
          {stream.status === 'error' && (
            <p className="mt-3 text-sm">
              <Link className="text-tide hover:underline" to={`/live?exercise=${exercise.id}&side=${side}&reps=${targetReps}&mode=demo`}>Switch to demo simulation</Link>
              <span className="text-muted"> to explore the analysis without a camera.</span>
            </p>
          )}
          {mode === 'demo' && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              <span className="font-medium text-ink">Test error handling:</span>
              <label className="inline-flex items-center gap-2"><input type="checkbox" className="accent-[rgb(var(--tide))]" checked={demoFlags.leave} onChange={(e) => setFlag('leave', e.target.checked)} />Person leaves frame</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" className="accent-[rgb(var(--tide))]" checked={demoFlags.second} onChange={(e) => setFlag('second', e.target.checked)} />Second person appears</label>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Panel className="p-5">
            <div className="flex items-center gap-5">
              <ProgressRing value={reps} max={targetReps} size={120} stroke={10}>
                <div key={popKey} className="pop">
                  <div className="text-4xl font-semibold tracking-tight tabular">{String(reps).padStart(2, '0')}</div>
                  <div className="text-xs text-muted">of {String(targetReps).padStart(2, '0')} reps</div>
                </div>
              </ProgressRing>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted"><span>Time</span><span className="tabular font-medium text-ink">{formatDuration(Math.round(view.elapsedMs / 1000))}</span></div>
                <div className="flex items-center justify-between text-xs text-muted"><span>Movement</span><span className="font-medium text-ink">{countdown !== null ? 'Get ready' : r ? STATE_LABEL[r.movementState] : 'Waiting for pose'}</span></div>
                <div className="flex items-center justify-between text-xs text-muted"><span>Quality</span>{liveQuality ? <Badge tone={liveQuality === 'Good' ? 'ok' : liveQuality === 'Fair' ? 'signal' : 'alert'}>{liveQuality}</Badge> : <span>—</span>}</div>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3">
              {[
                [`Current ${jointName.toLowerCase()} angle`, r?.confidence.ok ? deg(r.jointAngle) : '—', 'text-signal'],
                ['Range of motion', r ? <CountUp key="rom" value={Math.round(r.rom)} suffix="°" duration={300} /> : '0°', ''],
                ['Min · max angle', `${deg(r?.minAngle)} · ${deg(r?.maxAngle)}`, 'text-base'],
                ['Form quality', pct(r?.formScore), ''],
              ].map(([k, v, cls], i) => (
                <div key={i} className="rounded-xl border border-line/60 bg-sunken/40 p-3">
                  <dt className="text-[11px] text-muted">{k}</dt>
                  <dd className={`tabular mt-0.5 text-2xl font-semibold ${cls}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel className="p-5">
            <h2 className="text-sm font-semibold">Feedback</h2>
            <div className="mt-3"><FeedbackList items={view.feedback} /></div>
          </Panel>

          <p className="px-1 text-xs text-muted">Stop and consult your therapist if you experience pain. Please follow your prescribed exercise.</p>
          <div className="px-1"><Disclaimer compact /></div>
        </div>
      </div>
    </div>
  );
}
