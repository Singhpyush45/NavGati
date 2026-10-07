import { useEffect, useRef } from 'react';
import type { ExerciseConfig, Landmark } from '@/types';
import { DemoSimulator } from '@/services/pose/demoSimulator';
import { drawOverlay } from '@/services/pose/overlay';
import { indexOf } from '@/algorithms/landmarks';
import { calculateAngle } from '@/algorithms/angleCalculation';

/**
 * Looping "how to do it" animation for an exercise, generated from the same
 * simulator the demo mode uses (so it always matches the exercise config).
 * Pauses automatically when scrolled off-screen to save battery on phones.
 */
export function ExercisePreview({ exercise, className = '', showAngle = true }: { exercise: ExerciseConfig; className?: string; showAngle?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !exercise.supported) return;
    const sim = new DemoSimulator(exercise, { cycleSec: 3.4, noiseDeg: 0, sway: 0 });
    const side = 'left' as const;
    const tri = exercise.landmarks.map((p) => indexOf(p, side)) as [number, number, number];

    // Fit the figure to the canvas: bounding box of the whole cycle, then zoom.
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (let t = 0; t < 3400; t += 200) {
      (sim.frameAt(t).landmarks ?? []).forEach((l) => {
        if ((l.visibility ?? 0) < 0.35) return;
        minX = Math.min(minX, l.x); maxX = Math.max(maxX, l.x); minY = Math.min(minY, l.y); maxY = Math.max(maxY, l.y);
      });
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    // Canvas has the simulator's 4:3 aspect, so one uniform factor keeps proportions.
    const k = Math.min(1.9, 0.78 / Math.max(0.05, maxX - minX), 0.78 / Math.max(0.05, maxY - minY));
    const fit = (l: Landmark): Landmark => ({ ...l, x: (l.x - cx) * k + 0.5, y: (l.y - cy) * k + 0.5 });

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = cv.getContext('2d');
    let raf = 0, visible = true, last = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || now - last < 33) return; // ~30 fps is plenty
      last = now;
      const lm = (sim.frameAt(reduce ? 1700 : now - t0).landmarks ?? []).map(fit);
      const a = lm[tri[0]], b = lm[tri[1]], c = lm[tri[2]];
      const angle = a && b && c ? calculateAngle(a, b, c, cv.width / cv.height) : null;
      if (ctx) drawOverlay(ctx, lm, { mirrored: false, drawBackdrop: true, highlight: tri, angle: showAngle ? angle : null });
    };
    raf = requestAnimationFrame(draw);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.05 });
    io.observe(cv);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [exercise, showAngle]);

  if (!exercise.supported) {
    return <div className={`grid place-items-center bg-sunken text-xs text-muted ${className}`}>Not supported yet</div>;
  }
  return <canvas ref={ref} width={480} height={360} className={`block w-full ${className}`} role="img" aria-label={`Animated demonstration of ${exercise.name}`} />;
}
