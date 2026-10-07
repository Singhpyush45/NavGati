// ─────────────────────────────────────────────────────────────
// Core domain types for NavGati.
// Algorithms depend only on these types — never on React/UI.
// ─────────────────────────────────────────────────────────────

/** One body landmark from pose estimation (normalized image coords 0..1). */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
  /** 0..1 — how likely the landmark is visible/in-frame. */
  visibility?: number;
}

/** Everything the pose layer produces for a single video frame. */
export interface PoseFrame {
  /** 33 MediaPipe landmarks of the primary person, or null if nobody detected. */
  landmarks: Landmark[] | null;
  /** How many people the model detected in this frame. */
  numPoses: number;
  /** Milliseconds (performance.now() or simulated clock). */
  timestamp: number;
  /** width / height of the source image — needed for correct angles. */
  aspectRatio: number;
  /** True when this frame came from the demo simulator, never from a real person. */
  simulated?: boolean;
}

export type JointName = 'elbow' | 'knee' | 'shoulder' | 'ankle';
export type BodyPoint =
  | 'nose' | 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle' | 'heel' | 'foot';
export type Side = 'left' | 'right';
export type SidePreference = Side | 'auto';
export type CameraView = 'side' | 'front' | 'any';
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

/** Rep-cycle states. See algorithms/repetitionDetection.ts. */
export type MovementState = 'REST' | 'MOVING' | 'PEAK' | 'RETURNING';

/** Rep logic thresholds. "direction" = how the angle changes during the working phase. */
export interface RepLogic {
  direction: 'increase' | 'decrease';
  /** Angle that separates "at rest" from "moving". */
  startThreshold: number;
  /** Angle the patient must pass for the peak of the movement. */
  peakThreshold: number;
  /** Dead-band (deg) around thresholds to prevent jitter double-counts. */
  hysteresis: number;
  /** A full rep faster than this is ignored as noise. */
  minRepDurationMs: number;
  /** Minimum gap between two counted reps. */
  cooldownMs: number;
}

/** Declarative form rules. The engine knows how to evaluate each type.
 *  `message` = patient coaching; optional `deviation` = neutral label for therapist views. */
export type FormRule = { deviation?: string } & (
  | {
      id: string;
      type: 'targetReached';
      /** Angle the rep should reach for full credit (stricter than peakThreshold). */
      targetAngle: number;
      weight: number;
      message: string;
    }
  | {
      id: string;
      type: 'controlledSpeed';
      /** Max joint angular speed in deg/s considered "controlled". */
      maxVelocity: number;
      weight: number;
      message: string;
    }
  | {
      id: string;
      type: 'segmentOrientation';
      /** Segment from → to must stay near vertical/horizontal. */
      from: BodyPoint;
      to: BodyPoint;
      reference: 'vertical' | 'horizontal';
      maxDeviation: number;
      weight: number;
      message: string;
      okMessage: string;
    }
  | {
      id: string;
      type: 'jointAngleRange';
      /** Secondary joint that should stay within a range (e.g. straight elbow). */
      points: [BodyPoint, BodyPoint, BodyPoint];
      min: number;
      max: number;
      weight: number;
      message: string;
      okMessage: string;
    }
  | {
      id: string;
      type: 'cameraView';
      view: 'side' | 'front';
      weight: number;
      message: string;
    }
);

export interface ExerciseConfig {
  id: string;
  name: string;
  joint: JointName;
  movement: string;
  supported: boolean;
  difficulty: Difficulty;
  /** Three points; the angle is measured at the middle one. */
  landmarks: [BodyPoint, BodyPoint, BodyPoint];
  /** Rough expected angle envelope for this exercise (for validation + display). */
  expectedRange: { min: number; max: number };
  cameraView: CameraView;
  /** Setup posture shown in instructions. */
  position: 'standing' | 'seated' | 'standing-or-seated';
  instructions: string[];
  repLogic: RepLogic;
  formRules: FormRule[];
  /** Optional, configurable reference ROM (clearly labelled "reference" in UI). */
  referenceRom?: { value: number; source: string };
  /** Short word used in feedback ("extension", "bend"). */
  peakWord: string;
}

export type FeedbackSeverity = 'good' | 'warning' | 'error';
export type FeedbackType =
  | 'form' | 'rom' | 'speed' | 'visibility' | 'position' | 'multiple_people'
  | 'mismatch' | 'rep' | 'safety' | 'info';

export interface FeedbackItem {
  message: string;
  severity: FeedbackSeverity;
  type: FeedbackType;
}

export interface ConfidenceReport {
  ok: boolean;
  /** Average visibility of the required landmarks (0..1). */
  score: number;
  missing: BodyPoint[];
  reason: 'ok' | 'no_person' | 'multiple_people' | 'low_confidence' | 'out_of_frame';
}

export interface RepRecord {
  index: number;
  startedAt: number;
  endedAt: number;
  minAngle: number;
  maxAngle: number;
  rom: number;
  peakAngle: number;
  formScore: number;
  reachedTarget: boolean;
  deviations: string[];
}

export interface MovementEvent {
  t: number;
  type: 'rep_completed' | 'partial_rep' | 'rep_too_fast' | 'deviation' | 'low_confidence' | 'mismatch';
  detail: string;
}

/** Per-rule accumulated pass counters for the rep in progress. */
export interface RuleStats {
  [ruleId: string]: { pass: number; total: number };
}

/** Full state carried between frames by the movement engine (pure data). */
export interface EngineState {
  rep: {
    state: MovementState;
    movementStartedAt: number | null;
    peakReachedAt: number | null;
    lastRepEndedAt: number | null;
  };
  repCount: number;
  side: Side | null;
  smoothedAngle: number | null;
  lastTimestamp: number | null;
  velocity: number; // deg/s (smoothed, signed)
  sessionMin: number | null;
  sessionMax: number | null;
  /** Stats for the repetition currently in progress (null while at rest). */
  current: {
    minAngle: number;
    maxAngle: number;
    ruleStats: RuleStats;
  } | null;
  reps: RepRecord[];
  events: MovementEvent[];
  /** Recent samples for exercise validation: [t, targetAngle, otherJointAngles...] */
  history: { t: number; angles: Record<string, number> }[];
  lowConfidenceFrames: number;
  analyzedFrames: number;
}

export interface AnalysisResult {
  jointAngle: number | null;
  rom: number;
  minAngle: number | null;
  maxAngle: number | null;
  movementState: MovementState;
  repetitionCompleted: boolean;
  repCount: number;
  formScore: number | null;
  feedback: FeedbackItem[];
  confidence: ConfidenceReport;
  velocity: number;
  side: Side | null;
  exerciseMatch: 'match' | 'mismatch' | 'unknown';
}

// ─────────────── Persistence / accounts ───────────────

export type Role = 'PATIENT' | 'THERAPIST' | 'ADMIN';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Patient code like P001 (patients only). */
  patientCode?: string;
}

export interface PatientSummary {
  id: string;
  name: string;
  patientCode: string;
  condition?: string;
  therapistId?: string;
  isDemo: boolean;
  /** Extra details shown to the therapist (all optional). */
  profile?: PatientProfile;
}

/** Patient background shown on the therapist's patient page. */
export interface PatientProfile {
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  phone?: string;
  city?: string;
  diagnosis?: string;
  affectedSide?: Side;
  /** ISO date of injury / surgery. */
  injuryDate?: string;
  /** ISO date the rehab programme started. */
  programStart?: string;
  goal?: string;
  emergencyContact?: string;
}

export interface SessionRecord {
  id: string;
  patientId: string;
  exerciseId: string;
  exerciseName: string;
  side: Side | null;
  startedAt: string; // ISO
  endedAt: string;
  durationSec: number;
  targetReps: number;
  repetitions: number;
  averageRom: number;
  maxRom: number;
  minAngle: number | null;
  maxAngle: number | null;
  formScore: number;
  movementQuality: 'Good' | 'Fair' | 'Needs review';
  deviations: { label: string; count: number }[];
  status: 'completed' | 'partial';
  mode: 'camera' | 'demo';
  /** True for synthetic data used in demos — never real patient data. */
  isDemoData: boolean;
  reps: RepRecord[];
  events: MovementEvent[];
  /** Patient-reported outcomes (optional): pain 0–10 (NPRS) before/after, perceived difficulty 1–5. */
  painBefore?: number | null;
  painAfter?: number | null;
  difficulty?: number | null;
  patientNote?: string | null;
}

export type SessionFeedback = Pick<SessionRecord, 'painBefore' | 'painAfter' | 'difficulty' | 'patientNote'>;

/** A short note from the therapist to the patient (shown on the patient's home screen). */
export interface TherapistNote {
  id: string;
  patientId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

// ─────────────── Care plan (built on-site at ReThink Hackathon 2026) ───────────────

/** One prescribed exercise in a patient's weekly care plan. */
export interface CarePlanItem {
  exerciseId: string;
  side: SidePreference;
  targetReps: number;
  /** How many sessions of this exercise the patient should do per week (Mon–Sun). */
  sessionsPerWeek: number;
  /** Optional ROM goal in degrees, set by the therapist (not a clinical norm). */
  targetRom?: number | null;
  /** Short instruction shown to the patient ("Keep the thigh supported"). */
  instructions?: string;
}

/** A therapist-prescribed weekly exercise plan for one patient. */
export interface CarePlan {
  patientId: string;
  items: CarePlanItem[];
  updatedAt: string;
  updatedById: string;
  updatedByName: string;
}

// ─────────────── Patient ⇄ therapist messages (built on-site at ReThink Hackathon 2026) ───────────────

export type MessageCategory = 'general' | 'pain' | 'question' | 'problem';

export interface VoiceClip {
  /** base64 data URL (audio/webm or audio/mp4 depending on the browser). */
  dataUrl: string;
  durationSec: number;
  mime: string;
}

export interface PatientMessage {
  id: string;
  patientId: string;
  senderRole: 'PATIENT' | 'THERAPIST';
  senderId: string;
  senderName: string;
  category: MessageCategory;
  /** Text part (may be empty when the message is voice only). */
  body: string;
  audio?: VoiceClip | null;
  createdAt: string;
  /** Set when the other side has opened the conversation. */
  readAt?: string | null;
}
