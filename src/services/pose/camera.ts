export type CameraErrorCode = 'permission_denied' | 'unavailable' | 'in_use' | 'insecure' | 'unknown';

export class CameraError extends Error {
  constructor(public code: CameraErrorCode, message: string) { super(message); }
}

export const CAMERA_ERROR_TEXT: Record<CameraErrorCode, string> = {
  permission_denied: 'Camera access was blocked. Allow camera access in your browser’s site settings, then try again.',
  unavailable: 'No camera was found. Connect a camera, or use demo simulation mode.',
  in_use: 'The camera is being used by another app. Close that app and try again.',
  insecure: 'The camera only works on https:// or localhost. Open NavGati from a secure address.',
  unknown: 'The camera could not be started. Try again, or use demo simulation mode.',
};

/** Requests a modest resolution — pose models don't need HD, and small frames keep it real-time. */
export type Facing = 'user' | 'environment';

export async function startCamera(video: HTMLVideoElement, facing: Facing = 'user'): Promise<MediaStream> {
  if (!window.isSecureContext) throw new CameraError('insecure', CAMERA_ERROR_TEXT.insecure);
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unavailable', CAMERA_ERROR_TEXT.unavailable);
  let stream: MediaStream;
  try {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: { ideal: facing }, frameRate: { ideal: 30 } },
        audio: false,
      });
    } catch (first) {
      // Some phones reject size/fps constraints — retry with the bare minimum.
      if ((first as DOMException)?.name !== 'OverconstrainedError') throw first;
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
    }
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new CameraError('permission_denied', CAMERA_ERROR_TEXT.permission_denied);
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new CameraError('unavailable', CAMERA_ERROR_TEXT.unavailable);
    if (name === 'NotReadableError' || name === 'AbortError') throw new CameraError('in_use', CAMERA_ERROR_TEXT.in_use);
    throw new CameraError('unknown', CAMERA_ERROR_TEXT.unknown);
  }
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Average brightness 0–255 from a tiny downscaled copy of the frame (cheap). */
export function measureBrightness(video: HTMLVideoElement, scratch: HTMLCanvasElement): number | null {
  if (video.readyState < 2) return null;
  scratch.width = 32; scratch.height = 24;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, 32, 24);
  const d = ctx.getImageData(0, 0, 32, 24).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return sum / (d.length / 4);
}
