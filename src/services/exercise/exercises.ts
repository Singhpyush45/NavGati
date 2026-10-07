import type { ExerciseConfig, JointName } from '@/types';

/**
 * Exercise library — fully configuration driven.
 * To add an exercise: add one object here. No engine code changes needed.
 *
 * All thresholds are starting values for a prototype. They are NOT clinically
 * validated norms and should be tuned per patient by the therapist.
 */
const speedRule = (max: number) => ({
  id: 'controlled_speed',
  type: 'controlledSpeed' as const,
  maxVelocity: max,
  weight: 2,
  message: 'Slow down — keep the movement controlled',
});

const trunkUpright = (maxDeviation: number, message: string) => ({
  id: 'trunk_upright',
  type: 'segmentOrientation' as const,
  from: 'shoulder' as const,
  to: 'hip' as const,
  reference: 'vertical' as const,
  maxDeviation,
  weight: 1,
  message,
  okMessage: 'Steady upright posture',
});

export const EXERCISES: ExerciseConfig[] = [
  // ───────────────────────── KNEE ─────────────────────────
  {
    id: 'knee_extension',
    name: 'Knee Extension',
    joint: 'knee',
    movement: 'Extension',
    supported: true,
    difficulty: 'Beginner',
    landmarks: ['hip', 'knee', 'ankle'],
    expectedRange: { min: 70, max: 180 },
    cameraView: 'side',
    position: 'seated',
    instructions: [
      'Sit on a firm chair, side-on to the camera.',
      'Start with your foot on the floor and knee bent.',
      'Slowly straighten the knee, pause briefly, then lower with control.',
    ],
    repLogic: { direction: 'increase', startThreshold: 115, peakThreshold: 150, hysteresis: 6, minRepDurationMs: 700, cooldownMs: 300 },
    formRules: [
      { id: 'target', type: 'targetReached', targetAngle: 162, weight: 3, message: 'Try slightly greater extension' },
      speedRule(220),
      {
        id: 'thigh_supported', type: 'segmentOrientation', from: 'hip', to: 'knee', reference: 'horizontal',
        maxDeviation: 25, weight: 2, message: 'Keep your thigh resting on the chair', okMessage: 'Knee alignment detected',
      },
      trunkUpright(25, 'Sit upright against the chair back'),
      { id: 'side_view', type: 'cameraView', view: 'side', weight: 1, message: 'Turn sideways to the camera for accurate knee angles' },
    ],
    referenceRom: { value: 90, source: 'Illustrative reference only — therapist should configure per patient' },
    peakWord: 'extension',
  },
  {
    id: 'knee_flexion',
    name: 'Standing Knee Flexion',
    joint: 'knee',
    movement: 'Flexion',
    supported: true,
    difficulty: 'Intermediate',
    landmarks: ['hip', 'knee', 'ankle'],
    expectedRange: { min: 40, max: 180 },
    cameraView: 'side',
    position: 'standing',
    instructions: [
      'Stand side-on to the camera, holding a chair for balance.',
      'Keep your thigh vertical and bend the knee, bringing the heel back.',
      'Lower the foot slowly back to the floor.',
    ],
    repLogic: { direction: 'decrease', startThreshold: 155, peakThreshold: 110, hysteresis: 6, minRepDurationMs: 700, cooldownMs: 300 },
    formRules: [
      { id: 'target', type: 'targetReached', targetAngle: 95, weight: 3, message: 'Try bending the knee a little further' },
      speedRule(220),
      {
        id: 'thigh_vertical', type: 'segmentOrientation', from: 'hip', to: 'knee', reference: 'vertical',
        maxDeviation: 20, weight: 2, message: 'Keep your thigh vertical — bend only at the knee', okMessage: 'Thigh stays steady',
      },
      trunkUpright(15, 'Avoid leaning forward'),
      { id: 'side_view', type: 'cameraView', view: 'side', weight: 1, message: 'Turn sideways to the camera' },
    ],
    peakWord: 'bend',
  },

  // ───────────────────────── ELBOW ─────────────────────────
  {
    id: 'elbow_flexion',
    name: 'Elbow Flexion',
    joint: 'elbow',
    movement: 'Flexion',
    supported: true,
    difficulty: 'Beginner',
    landmarks: ['shoulder', 'elbow', 'wrist'],
    expectedRange: { min: 30, max: 180 },
    cameraView: 'any',
    position: 'standing-or-seated',
    instructions: [
      'Stand or sit with your arm straight by your side.',
      'Keep your upper arm still and bend the elbow, bringing the hand up.',
      'Lower the hand slowly until the arm is straight again.',
    ],
    repLogic: { direction: 'decrease', startThreshold: 140, peakThreshold: 75, hysteresis: 6, minRepDurationMs: 600, cooldownMs: 300 },
    formRules: [
      { id: 'target', type: 'targetReached', targetAngle: 55, weight: 3, message: 'Try bending the elbow a little further' },
      speedRule(260),
      {
        id: 'upper_arm_still', type: 'segmentOrientation', from: 'shoulder', to: 'elbow', reference: 'vertical',
        maxDeviation: 25, weight: 2, message: 'Keep your upper arm still by your side', okMessage: 'Upper arm steady',
      },
      trunkUpright(15, 'Avoid swinging your body'),
    ],
    peakWord: 'bend',
  },
  {
    id: 'elbow_extension',
    name: 'Elbow Extension',
    joint: 'elbow',
    movement: 'Extension',
    supported: true,
    difficulty: 'Beginner',
    landmarks: ['shoulder', 'elbow', 'wrist'],
    expectedRange: { min: 30, max: 180 },
    cameraView: 'any',
    position: 'standing-or-seated',
    instructions: [
      'Start with the elbow bent and upper arm by your side.',
      'Straighten the elbow slowly as far as comfortable.',
      'Return to the bent position with control.',
    ],
    repLogic: { direction: 'increase', startThreshold: 80, peakThreshold: 140, hysteresis: 6, minRepDurationMs: 600, cooldownMs: 300 },
    formRules: [
      { id: 'target', type: 'targetReached', targetAngle: 160, weight: 3, message: 'Try slightly greater extension' },
      speedRule(260),
      {
        id: 'upper_arm_still', type: 'segmentOrientation', from: 'shoulder', to: 'elbow', reference: 'vertical',
        maxDeviation: 25, weight: 2, message: 'Keep your upper arm still by your side', okMessage: 'Upper arm steady',
      },
      trunkUpright(15, 'Avoid swinging your body'),
    ],
    peakWord: 'extension',
  },

  // ───────────────────────── SHOULDER ─────────────────────────
  {
    id: 'shoulder_flexion',
    name: 'Shoulder Flexion',
    joint: 'shoulder',
    movement: 'Flexion',
    supported: true,
    difficulty: 'Intermediate',
    landmarks: ['hip', 'shoulder', 'elbow'],
    expectedRange: { min: 0, max: 180 },
    cameraView: 'side',
    position: 'standing-or-seated',
    instructions: [
      'Stand side-on to the camera, arm by your side, thumb pointing forward.',
      'Keeping the elbow straight, raise the arm forward and up.',
      'Lower slowly back to your side.',
    ],
    repLogic: { direction: 'increase', startThreshold: 40, peakThreshold: 110, hysteresis: 6, minRepDurationMs: 800, cooldownMs: 300 },
    formRules: [
      { id: 'target', type: 'targetReached', targetAngle: 150, weight: 3, message: 'Try raising the arm slightly higher, if comfortable' },
      speedRule(200),
      {
        id: 'elbow_straight', type: 'jointAngleRange', points: ['shoulder', 'elbow', 'wrist'], min: 140, max: 180,
        weight: 2, message: 'Keep your elbow straight', okMessage: 'Arm straight',
      },
      trunkUpright(15, 'Avoid leaning back'),
      { id: 'side_view', type: 'cameraView', view: 'side', weight: 1, message: 'Turn sideways to the camera' },
    ],
    peakWord: 'elevation',
  },
  {
    id: 'shoulder_abduction',
    name: 'Shoulder Abduction',
    joint: 'shoulder',
    movement: 'Abduction',
    supported: true,
    difficulty: 'Intermediate',
    landmarks: ['hip', 'shoulder', 'elbow'],
    expectedRange: { min: 0, max: 180 },
    cameraView: 'front',
    position: 'standing-or-seated',
    instructions: [
      'Face the camera with arms by your sides.',
      'Keeping the elbow straight, lift the arm out to the side.',
      'Lower slowly back to your side.',
    ],
    repLogic: { direction: 'increase', startThreshold: 40, peakThreshold: 100, hysteresis: 6, minRepDurationMs: 800, cooldownMs: 300 },
    formRules: [
      { id: 'target', type: 'targetReached', targetAngle: 140, weight: 3, message: 'Try lifting the arm slightly higher, if comfortable' },
      speedRule(200),
      {
        id: 'elbow_straight', type: 'jointAngleRange', points: ['shoulder', 'elbow', 'wrist'], min: 140, max: 180,
        weight: 2, message: 'Keep your elbow straight', okMessage: 'Arm straight',
      },
      trunkUpright(12, 'Avoid leaning to the side'),
      { id: 'front_view', type: 'cameraView', view: 'front', weight: 1, message: 'Face the camera for this exercise' },
    ],
    peakWord: 'lift',
  },
  {
    id: 'shoulder_extension',
    name: 'Shoulder Extension',
    joint: 'shoulder',
    movement: 'Extension',
    supported: true,
    difficulty: 'Intermediate',
    landmarks: ['hip', 'shoulder', 'elbow'],
    expectedRange: { min: 0, max: 80 },
    cameraView: 'side',
    position: 'standing',
    instructions: [
      'Stand side-on to the camera, arm by your side.',
      'Keeping the elbow straight, move the arm backwards.',
      'Return slowly to your side. Keep your trunk still.',
    ],
    repLogic: { direction: 'increase', startThreshold: 20, peakThreshold: 35, hysteresis: 4, minRepDurationMs: 600, cooldownMs: 300 },
    formRules: [
      { id: 'target', type: 'targetReached', targetAngle: 45, weight: 3, message: 'Movement target not reached' },
      speedRule(180),
      {
        id: 'elbow_straight', type: 'jointAngleRange', points: ['shoulder', 'elbow', 'wrist'], min: 140, max: 180,
        weight: 2, message: 'Keep your elbow straight', okMessage: 'Arm straight',
      },
      trunkUpright(12, 'Avoid leaning forward'),
      { id: 'side_view', type: 'cameraView', view: 'side', weight: 1, message: 'Turn sideways to the camera' },
    ],
    peakWord: 'extension',
  },
  {
    id: 'shoulder_adduction',
    name: 'Shoulder Horizontal Adduction',
    joint: 'shoulder',
    movement: 'Adduction',
    supported: false, // needs reliable depth — not supported in the 2D MVP
    difficulty: 'Intermediate',
    landmarks: ['hip', 'shoulder', 'elbow'],
    expectedRange: { min: 0, max: 180 },
    cameraView: 'front',
    position: 'standing-or-seated',
    instructions: ['Movement across the body happens mostly in depth, which a single 2D camera cannot measure reliably yet.'],
    repLogic: { direction: 'increase', startThreshold: 0, peakThreshold: 0, hysteresis: 0, minRepDurationMs: 0, cooldownMs: 0 },
    formRules: [],
    peakWord: 'adduction',
  },

  // ───────────────────────── ANKLE ─────────────────────────
  {
    id: 'ankle_dorsiflexion',
    name: 'Ankle Dorsiflexion',
    joint: 'ankle',
    movement: 'Dorsiflexion',
    supported: true,
    difficulty: 'Advanced',
    landmarks: ['knee', 'ankle', 'foot'],
    expectedRange: { min: 60, max: 160 },
    cameraView: 'side',
    position: 'seated',
    instructions: [
      'Sit side-on to the camera, heel on the floor, camera at foot level if possible.',
      'Lift your toes up towards your shin, keeping the heel down.',
      'Lower the toes slowly. Small movements are expected — ankle tracking is sensitive to lighting.',
    ],
    repLogic: { direction: 'decrease', startThreshold: 108, peakThreshold: 98, hysteresis: 3, minRepDurationMs: 500, cooldownMs: 300 },
    formRules: [
      { id: 'target', type: 'targetReached', targetAngle: 92, weight: 3, message: 'Try lifting the toes slightly higher' },
      speedRule(160),
      {
        id: 'shin_still', type: 'segmentOrientation', from: 'knee', to: 'ankle', reference: 'vertical',
        maxDeviation: 20, weight: 2, message: 'Keep your lower leg still', okMessage: 'Lower leg steady',
      },
      { id: 'side_view', type: 'cameraView', view: 'side', weight: 1, message: 'Turn sideways to the camera' },
    ],
    peakWord: 'dorsiflexion',
  },
  {
    id: 'ankle_plantarflexion',
    name: 'Ankle Plantarflexion',
    joint: 'ankle',
    movement: 'Plantarflexion',
    supported: true,
    difficulty: 'Advanced',
    landmarks: ['knee', 'ankle', 'foot'],
    expectedRange: { min: 60, max: 170 },
    cameraView: 'side',
    position: 'seated',
    instructions: [
      'Sit side-on to the camera with your foot visible.',
      'Point your toes down and away, as if pressing a pedal.',
      'Return slowly to the neutral position.',
    ],
    repLogic: { direction: 'increase', startThreshold: 122, peakThreshold: 132, hysteresis: 3, minRepDurationMs: 500, cooldownMs: 300 },
    formRules: [
      { id: 'target', type: 'targetReached', targetAngle: 140, weight: 3, message: 'Try pointing the toes slightly further' },
      speedRule(160),
      {
        id: 'shin_still', type: 'segmentOrientation', from: 'knee', to: 'ankle', reference: 'vertical',
        maxDeviation: 20, weight: 2, message: 'Keep your lower leg still', okMessage: 'Lower leg steady',
      },
      { id: 'side_view', type: 'cameraView', view: 'side', weight: 1, message: 'Turn sideways to the camera' },
    ],
    peakWord: 'plantarflexion',
  },
];

export const JOINT_ORDER: JointName[] = ['knee', 'elbow', 'shoulder', 'ankle'];
export const JOINT_LABEL: Record<JointName, string> = { knee: 'Knee', elbow: 'Elbow', shoulder: 'Shoulder', ankle: 'Ankle' };

export function getExercise(id: string | null | undefined): ExerciseConfig | undefined {
  return EXERCISES.find((e) => e.id === id);
}

export function exercisesByJoint(): Record<JointName, ExerciseConfig[]> {
  const map = { knee: [], elbow: [], shoulder: [], ankle: [] } as Record<JointName, ExerciseConfig[]>;
  for (const e of EXERCISES) map[e.joint].push(e);
  return map;
}
