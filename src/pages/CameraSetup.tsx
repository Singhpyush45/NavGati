import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { PoseFrame, SidePreference } from '@/types';
import { EXERCISES, getExercise } from '@/services/exercise/exercises';
import { usePoseStream } from '@/hooks/usePoseStream';
import { PoseStage } from '@/components/Camera/PoseStage';
import { PageHeader, Panel, Segmented } from '@/components/UI/primitives';
import { checkConfidence, chooseSide, distanceGuidance, fullBodyVisible } from '@/algorithms/landmarkConfidence';
import { detectCameraView } from '@/algorithms/formAssessment';
import { calculateAngle } from '@/algorithms/angleCalculation';
import { indexOf, getPoint } from '@/algorithms/landmarks';
import { getPrefs } from '@/utils/prefs';
import type { Facing } from '@/services/pose/camera';
import { ExercisePreview } from '@/components/Exercise/ExercisePreview';
import { ProgressRing } from '@/components/FX/motion';

type Level = 'ok' | 'warn' | 'error' | 'pending';
interface Check { label: string; level: Level; detail: string }

export default function CameraSetup() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const prefs = getPrefs();
  const [exerciseId, setExerciseId] = useState(params.get('exercise') ?? 'knee_extension');
  // Pre-filled from the care plan link (/setup?exercise=…&reps=…&side=…) when present.
  const sideParam = params.get('side');
  const [side, setSide] = useState<SidePreference>(sideParam === 'left' || sideParam === 'right' || sideParam === 'auto' ? sideParam : prefs.defaultSide);
  const [reps, setReps] = useState(Math.max(1, Math.min(50, Number(params.get('reps')) || prefs.defaultTargetReps)));
  const [mode, setMode] = useState<'camera' | 'demo'>(params.get('mode') === 'demo' ? 'demo' : 'camera');
  const [facing, setFacing] = useState<Facing>(params.get('cam') === 'environment' ? 'environment' : 'user');
  const exercise = getExercise(exerciseId) ?? EXERCISES[0];
  const lastFrame = useRef<PoseFrame | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);

  const stream = usePoseStream({
    mode, exercise, active: exercise.supported, facing,
    onFrame: (frame) => {
      lastFrame.current = frame;
      if (!frame.landmarks) return;
      const s = side === 'auto' ? chooseSide(frame.landmarks, exercise.landmarks) : side;
      const [a, b, c] = exercise.landmarks.map((p) => getPoint(frame.landmarks!, p, s)!);
      const ok = checkConfidence(frame, exercise.landmarks, s).ok;
      return {
        highlight: exercise.landmarks.map((p) => indexOf(p, s)) as [number, number, number],
        angle: ok ? calculateAngle(a, b, c, frame.aspectRatio) : null,
        status: ok ? 'ok' : 'warn',
      };
    },
  });

  // Evaluate setup checks a few times per second (not every frame).
  useEffect(() => {
    const id = setInterval(() => {
      const f = lastFrame.current;
      const running = stream.status === 'running';
      const demo = mode === 'demo';
      const list: Check[] = [];
      list.push({ label: 'Camera', level: running ? 'ok' : stream.status === 'error' ? 'error' : 'pending', detail: demo ? 'Simulated camera' : running ? 'Camera ready' : stream.status === 'error' ? 'Unavailable' : 'Starting…' });
      if (!running || !f) { setChecks(list); return; }
      const people = f.numPoses;
      list.push({ label: 'Body', level: people === 1 ? 'ok' : people > 1 ? 'error' : 'warn', detail: people === 1 ? 'Body detected' : people > 1 ? 'Please ensure only one person is visible.' : 'Please move into the camera frame.' });
      const s = f.landmarks ? (side === 'auto' ? chooseSide(f.landmarks, exercise.landmarks) : side) : 'left';
      const conf = checkConfidence(f, exercise.landmarks, s);
      list.push({ label: `${exercise.joint[0].toUpperCase()}${exercise.joint.slice(1)} landmarks`, level: conf.ok ? 'ok' : 'warn', detail: conf.ok ? `${exercise.landmarks.join(', ')} visible (${s} side)` : `Not visible: ${conf.missing.join(', ') || '—'}` });
      const full = fullBodyVisible(f.landmarks);
      list.push({ label: 'Full body', level: full ? 'ok' : 'warn', detail: full ? 'Complete body visible' : 'Make sure your complete body is visible.' });
      const dist = distanceGuidance(f.landmarks);
      list.push({ label: 'Distance', level: dist === 'good' ? 'ok' : 'warn', detail: dist === 'good' ? 'Good distance' : dist === 'too_close' ? 'Step back — stand about 2–3 meters away.' : dist === 'too_far' ? 'Move a little closer.' : '—' });
      const b = stream.brightnessRef.current;
      list.push({ label: 'Lighting', level: demo ? 'ok' : b === null ? 'pending' : b < 45 ? 'warn' : b > 225 ? 'warn' : 'ok', detail: demo ? 'Simulated' : b === null ? 'Measuring…' : b < 45 ? 'Too dark — turn on a light facing you.' : b > 225 ? 'Very bright — avoid a window behind you.' : 'Good lighting detected' });
      if (exercise.cameraView !== 'any' && f.landmarks) {
        const v = detectCameraView(f.landmarks, f.aspectRatio);
        list.push({ label: 'Orientation', level: v === exercise.cameraView ? 'ok' : 'warn', detail: v === exercise.cameraView ? `${exercise.cameraView === 'side' ? 'Side-on' : 'Facing'} the camera` : exercise.cameraView === 'side' ? 'Turn sideways to the camera' : 'Face the camera' });
      }
      setChecks(list);
    }, 300);
    return () => clearInterval(id);
  }, [stream.status, stream.brightnessRef, mode, exercise, side]);

  const ready = useMemo(() => checks.length > 2 && checks.slice(0, 3).every((c) => c.level === 'ok'), [checks]);
  const start = () => navigate(`/live?exercise=${exercise.id}&side=${side}&reps=${reps}&mode=${mode}&cam=${facing}`);
  const okCount = checks.filter((c) => c.level === 'ok').length;

  const dot: Record<Level, string> = { ok: 'bg-ok', warn: 'bg-signal', error: 'bg-alert', pending: 'bg-line' };

  return (
    <div>
      <PageHeader title="Camera setup" subtitle="Check your position before you start. Video is processed on this device and never uploaded."
        actions={<Link to="/exercises" className="btn-ghost">Back to exercises</Link>} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          {exercise.supported ? (
            <PoseStage videoRef={stream.videoRef} canvasRef={stream.canvasRef} mode={mode} status={stream.status} error={stream.error} aspect={stream.aspect} mirrored={stream.mirrored} />
          ) : (
            <div className="panel grid aspect-[4/3] place-items-center border-dashed text-center">
              <div><p className="font-medium">Exercise not supported yet.</p><p className="mt-1 text-sm text-muted">Choose another exercise to continue.</p></div>
            </div>
          )}
          <p className="mt-3 text-sm text-muted">Tip: place the camera at hip height, {exercise.cameraView === 'front' ? 'facing you' : exercise.cameraView === 'side' ? 'to your side' : 'to your side or in front of you'}, about 2–3 meters away. On a phone, lean it against something stable — portrait works well for full-body exercises.</p>
          {exercise.supported && (
            <Panel className="mt-5 grid items-center gap-5 overflow-hidden p-4 sm:grid-cols-[220px_1fr]">
              <div className="overflow-hidden rounded-xl"><ExercisePreview exercise={exercise} /></div>
              <div>
                <h2 className="font-semibold">How to do it</h2>
                <ol className="mt-2 space-y-1.5 text-sm text-muted">
                  {exercise.instructions.map((i, n) => <li key={i} className="flex gap-2"><span className="font-semibold text-tide">{n + 1}.</span>{i}</li>)}
                </ol>
                <p className="mt-3 text-xs text-muted">The amber joint is the one NavGati measures.</p>
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel className="space-y-4 p-5">
            <div>
              <label className="label" htmlFor="ex">Exercise</label>
              <select id="ex" className="field" value={exercise.id} onChange={(e) => setExerciseId(e.target.value)}>
                {EXERCISES.map((e) => <option key={e.id} value={e.id} disabled={!e.supported}>{e.name}{e.supported ? '' : ' (not supported yet)'}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <span className="label">Side</span>
                <Segmented label="Body side" value={side} onChange={setSide} options={[{ value: 'auto', label: 'Auto' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />
              </div>
              <div>
                <label className="label" htmlFor="reps">Prescribed reps</label>
                <input id="reps" type="number" min={1} max={50} className="field !w-24" value={reps} onChange={(e) => setReps(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
              </div>
            </div>
            <div>
              <span className="label">Input</span>
              <Segmented label="Input mode" value={mode} onChange={setMode} options={[{ value: 'camera', label: 'Live camera' }, { value: 'demo', label: 'Demo simulation' }]} />
            </div>
            {mode === 'camera' && (
              <div>
                <span className="label">Camera</span>
                <Segmented label="Which camera" value={facing} onChange={setFacing} options={[{ value: 'user', label: 'Front (selfie)' }, { value: 'environment', label: 'Back' }]} />
                <p className="mt-1.5 text-xs text-muted">Use the back camera if someone else is holding the phone.</p>
              </div>
            )}
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center gap-4">
              <ProgressRing value={okCount} max={Math.max(1, checks.length)} size={64} stroke={7}>
                <span className="text-sm font-semibold">{okCount}/{checks.length}</span>
              </ProgressRing>
              <div>
                <h2 className="font-semibold">Readiness</h2>
                <p className="text-xs text-muted">{ready ? 'Looking good — you can start.' : 'Adjust until the key checks turn green.'}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm" aria-live="polite">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors" style={{ background: c.level === 'ok' ? 'rgb(var(--ok) / .06)' : undefined }}>
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot[c.level]} ${c.level === 'ok' ? 'shadow-[0_0_10px_rgb(var(--ok))]' : c.level === 'pending' ? 'animate-pulse' : ''}`} aria-hidden="true" />
                  <span><span className="font-medium">{c.label}</span> <span className="text-muted">— {c.detail}</span></span>
                </li>
              ))}
            </ul>
            <button className={`btn-primary mt-5 w-full !py-3.5 text-[15px] ${ready ? 'pulse-ring' : ''}`} disabled={!exercise.supported || stream.status !== 'running'} onClick={start}>
              {ready ? 'Start exercise' : 'Start anyway'}
            </button>
            {!ready && stream.status === 'running' && <p className="mt-2 text-xs text-muted">Some checks aren’t green yet. Analysis pauses automatically whenever the joint isn’t visible.</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
