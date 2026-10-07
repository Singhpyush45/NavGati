import type { PoseFrame } from '@/types';
import type { PoseLandmarker as PoseLandmarkerT } from '@mediapipe/tasks-vision';

const WASM_PATH = import.meta.env.VITE_MEDIAPIPE_WASM_PATH
  || 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = import.meta.env.VITE_POSE_MODEL_URL
  || 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/**
 * Wraps MediaPipe Pose Landmarker (runs 100% in the browser via WebAssembly/WebGL).
 * Video frames never leave the device.
 */
export class PoseService {
  private landmarker: PoseLandmarkerT | null = null;
  private loading: Promise<void> | null = null;
  private lastVideoTime = -1;
  private lastFrame: PoseFrame | null = null;

  async init(): Promise<void> {
    if (this.landmarker) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      // Dynamic import keeps the ~1 MB vision bundle out of the initial page load.
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      const make = (delegate: 'GPU' | 'CPU') =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'VIDEO',
          numPoses: 2, // 2 so we can warn when a second person enters the frame
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      try {
        this.landmarker = await make('GPU');
      } catch {
        this.landmarker = await make('CPU');
      }
    })();
    try {
      await this.loading;
    } catch (e) {
      this.loading = null;
      throw e;
    }
  }

  get ready() { return this.landmarker !== null; }

  /** Runs inference on the current video frame. Reuses the last result if the frame hasn't changed. */
  detect(video: HTMLVideoElement, timestamp: number): PoseFrame | null {
    if (!this.landmarker || video.readyState < 2 || video.videoWidth === 0) return null;
    if (video.currentTime === this.lastVideoTime && this.lastFrame) return null;
    this.lastVideoTime = video.currentTime;
    const res = this.landmarker.detectForVideo(video, timestamp);
    const poses = res.landmarks ?? [];
    const frame: PoseFrame = {
      landmarks: poses[0] ? poses[0].map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility })) : null,
      numPoses: poses.length,
      timestamp,
      aspectRatio: video.videoWidth / video.videoHeight,
    };
    this.lastFrame = frame;
    return frame;
  }

  close() {
    this.landmarker?.close();
    this.landmarker = null;
    this.loading = null;
  }
}

let shared: PoseService | null = null;
/** One shared model instance for the whole app (loading it is the slow part). */
export function getPoseService(): PoseService {
  if (!shared) shared = new PoseService();
  return shared;
}
