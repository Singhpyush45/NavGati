import { useEffect, useRef, useState } from 'react';
import { getExercise } from '@/services/exercise/exercises';
import { DemoSimulator } from '@/services/pose/demoSimulator';
import { MovementEngine } from '@/services/movement/movementEngine';
import { drawOverlay } from '@/services/pose/overlay';
import { LANDMARK_INDEX } from '@/algorithms/landmarks';
import type { AnalysisResult } from '@/types';

/**
 * The landing hero is the real engine running on simulated landmarks —
 * the same code path as a live session, just with a synthetic "patient".
 */
export function HeroDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const ex = getExercise('knee_extension')!;
    const sim = new DemoSimulator(ex, { cycleSec: 3.2 });
    const engine = new MovementEngine(ex, 'left', 12);
    const idx = LANDMARK_INDEX.left;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let latest: AnalysisResult | null = null;
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const t = reduce ? 1400 : now - t0;
      const frame = sim.frameAt(t);
      latest = engine.analyze(frame);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawOverlay(ctx, frame.landmarks, { mirrored: false, drawBackdrop: true, highlight: [idx.hip, idx.knee, idx.ankle], angle: latest.jointAngle, angleLabel: 'Knee' });
      if (!reduce) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ui = setInterval(() => latest && setView(latest), 150);
    return () => { cancelAnimationFrame(raf); clearInterval(ui); };
  }, []);

  return (
    <figure className="relative">
      <canvas ref={canvasRef} width={960} height={720} className="block w-full rounded-panel" aria-label="Animated skeleton performing a knee extension with the knee angle measured" />
      <figcaption className="absolute bottom-3 left-3 right-3 grid grid-cols-3 gap-2 text-white">
        {[
          ['Knee angle', view?.jointAngle != null ? `${Math.round(view.jointAngle)}°` : '—'],
          ['Repetitions', view ? String(view.repCount).padStart(2, '0') : '00'],
          ['Range of motion', view ? `${Math.round(view.rom)}°` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-[#0c2023]/80 px-3 py-2 backdrop-blur">
            <div className="text-[11px] text-white/65">{k}</div>
            <div className="tabular text-lg font-semibold">{v}</div>
          </div>
        ))}
      </figcaption>
      <span className="absolute right-3 top-3 rounded-md bg-[#E8B04B] px-2 py-1 text-[11px] font-semibold text-[#2a1d05]">Simulated demo</span>
    </figure>
  );
}
