import { useEffect, useRef, useState } from 'react';
import type { ExerciseConfig, PoseFrame } from '@/types';
import { getPoseService } from '@/services/pose/poseService';
import { CameraError, CAMERA_ERROR_TEXT, measureBrightness, startCamera, stopCamera, type Facing } from '@/services/pose/camera';
import { DemoSimulator } from '@/services/pose/demoSimulator';
import { drawOverlay, type OverlayOptions } from '@/services/pose/overlay';

export type StreamStatus = 'idle' | 'starting-camera' | 'loading-model' | 'running' | 'error';
export type FrameHandler = (frame: PoseFrame) => Omit<OverlayOptions, 'mirrored' | 'drawBackdrop'> | void;

/**
 * Runs the real-time pipeline outside React's render cycle:
 *   camera/simulator → pose inference → onFrame(analysis) → canvas overlay
 * All per-frame work happens in requestAnimationFrame; React only sees
 * status changes. Pages throttle their own UI updates.
 */
export function usePoseStream(opts: {
  mode: 'camera' | 'demo';
  exercise: ExerciseConfig;
  active?: boolean;
  facing?: Facing;
  onFrame: FrameHandler;
}) {
  const { mode, exercise, active = true, facing = 'user' } = opts;
  const [aspect, setAspect] = useState(4 / 3);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFrameRef = useRef(opts.onFrame);
  onFrameRef.current = opts.onFrame;
  const pausedRef = useRef(false);
  const simRef = useRef<DemoSimulator | null>(null);
  const brightnessRef = useRef<number | null>(null);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let stream: MediaStream | null = null;
    let cancelled = false;
    const scratch = document.createElement('canvas');
    setError(null);

    const draw = (landmarks: PoseFrame['landmarks'], overlay: ReturnType<FrameHandler>, backdrop: boolean) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      drawOverlay(ctx, landmarks, { mirrored: mode === 'camera' && facing === 'user', drawBackdrop: backdrop, ...(overlay ?? {}) });
    };

    if (mode === 'demo') {
      const sim = new DemoSimulator(exercise);
      simRef.current = sim;
      const canvas = canvasRef.current;
      if (canvas) { canvas.width = 960; canvas.height = 720; }
      setAspect(4 / 3);
      let simTime = 0;
      let last = performance.now();
      setStatus('running');
      const loop = (now: number) => {
        if (cancelled) return;
        if (!pausedRef.current) simTime += now - last;
        last = now;
        const frame = sim.frameAt(simTime);
        const overlay = pausedRef.current ? undefined : onFrameRef.current(frame);
        draw(frame.landmarks, overlay, true);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } else {
      (async () => {
        const video = videoRef.current;
        if (!video) return;
        try {
          setStatus('starting-camera');
          stream = await startCamera(video, facing);
          if (cancelled) { stopCamera(stream); return; }
          setStatus('loading-model');
          const pose = getPoseService();
          await pose.init();
          if (cancelled) return;
          setStatus('running');
        } catch (e) {
          if (cancelled) return;
          setStatus('error');
          if (e instanceof CameraError) setError(e.message);
          else setError('The pose model could not be loaded. Check your internet connection (the model downloads once), or use demo simulation mode.');
          return;
        }
        const pose = getPoseService();
        let lastBrightness = 0;
        const loop = (now: number) => {
          if (cancelled) return;
          const v = videoRef.current;
          const c = canvasRef.current;
          if (v && c && v.videoWidth) {
            if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
              c.width = v.videoWidth; c.height = v.videoHeight;
              setAspect(v.videoWidth / v.videoHeight); // portrait phones deliver e.g. 480×640
            }
            if (now - lastBrightness > 1000) { brightnessRef.current = measureBrightness(v, scratch); lastBrightness = now; }
            try {
              const frame = pose.detect(v, now);
              if (frame) {
                const overlay = pausedRef.current ? undefined : onFrameRef.current(frame);
                draw(frame.landmarks, overlay, false);
              }
            } catch {
              // A single failed inference shouldn't kill the session; skip this frame.
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      })();
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stopCamera(stream);
      simRef.current = null;
    };
  }, [mode, exercise, active, facing]);

  return {
    videoRef, canvasRef, status, error, simRef, brightnessRef, aspect, mirrored: mode === 'camera' && facing === 'user',
    setPaused: (p: boolean) => { pausedRef.current = p; },
  };
}

export { CAMERA_ERROR_TEXT };
