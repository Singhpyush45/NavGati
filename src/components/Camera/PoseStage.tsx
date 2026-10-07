import type { ReactNode, RefObject } from 'react';
import type { StreamStatus } from '@/hooks/usePoseStream';
import { Spinner } from '@/components/UI/primitives';

/**
 * Video + overlay canvas stacked with identical object-fit so landmarks line up.
 * The stage takes the camera's real aspect ratio (portrait on most phones).
 * Front camera: video mirrored with CSS; the overlay mirrors coordinates itself so text is never reversed.
 */
export function PoseStage({ videoRef, canvasRef, mode, status, error, children, className = '', aspect = 4 / 3, mirrored = true }: {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  mode: 'camera' | 'demo';
  status: StreamStatus;
  error: string | null;
  children?: ReactNode;
  className?: string;
  aspect?: number;
  mirrored?: boolean;
}) {
  const portrait = aspect < 1;
  return (
    <div className={`relative mx-auto overflow-hidden rounded-panel bg-gradient-to-br from-[#0b2427] to-[#0a1b2a] shadow-2xl shadow-tide/10 ring-1 ring-white/10 ${portrait ? 'max-h-[72vh]' : ''} ${className}`}
      style={{ aspectRatio: String(aspect), maxWidth: portrait ? `calc(72vh * ${aspect})` : undefined }}>
      {mode === 'camera' && (
        <video ref={videoRef} className={`absolute inset-0 h-full w-full object-contain ${mirrored ? '-scale-x-100' : ''}`} playsInline muted autoPlay aria-label="Camera preview" />
      )}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain" aria-hidden="true" />
      {(status === 'starting-camera' || status === 'loading-model') && (
        <div className="absolute inset-0 grid place-items-center bg-[#0a1f22]/75 p-6 text-center text-white backdrop-blur-sm">
          <Spinner compact label={status === 'starting-camera' ? 'Starting camera — allow access when your browser asks…' : 'Loading the pose model (first time takes a few seconds)…'} />
        </div>
      )}
      {status === 'error' && error && (
        <div className="absolute inset-0 grid place-items-center bg-[#0a1f22]/90 p-6 text-center text-white">
          <div className="max-w-sm">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-alert/20 text-xl">⚠</div>
            <p className="font-medium">Camera unavailable</p>
            <p className="mt-2 text-sm text-white/75">{error}</p>
          </div>
        </div>
      )}
      {mode === 'demo' && (
        <div className="absolute left-3 top-3 z-10 rounded-lg bg-[#E8B04B] px-2.5 py-1 text-[11px] font-bold tracking-wide text-[#2a1d05] shadow-lg"><span className="sm:hidden">DEMO MODE</span><span className="hidden sm:inline">DEMO MODE · simulated landmarks</span></div>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-panel ring-1 ring-inset ring-white/10" aria-hidden="true" />
      {children}
    </div>
  );
}
