import type { PatientSummary, SessionRecord, TherapistNote } from '@/types';
import { getExercise } from '@/services/exercise/exercises';
import { qualityLabel } from '@/algorithms/formAssessment';

/**
 * SYNTHETIC DEMO DATA — clearly flagged with isDemo / isDemoData.
 * These are not real patients and not real measurements.
 */
export const DEMO_THERAPIST_ID = 'demo-therapist';

export const DEMO_PATIENTS: PatientSummary[] = [
  { id: 'p001', name: 'Demo Patient A', patientCode: 'P001', condition: 'Post-operative knee (demo)', therapistId: DEMO_THERAPIST_ID, isDemo: true },
  { id: 'p002', name: 'Demo Patient B', patientCode: 'P002', condition: 'Elbow stiffness (demo)', therapistId: DEMO_THERAPIST_ID, isDemo: true },
  { id: 'p003', name: 'Demo Patient C', patientCode: 'P003', condition: 'Shoulder mobility (demo)', therapistId: DEMO_THERAPIST_ID, isDemo: true },
];

function prng(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Plan {
  patientId: string;
  exerciseId: string;
  sessions: number;
  spanDays: number;
  romFrom: number; romTo: number;
  formFrom: number; formTo: number;
  target: number;
  skipRecentDays?: number;
  deviations: string[];
  painFrom: number; painTo: number;
}

const PLANS: Plan[] = [
  { patientId: 'p001', exerciseId: 'knee_extension', sessions: 18, spanDays: 24, romFrom: 55, romTo: 76, formFrom: 72, formTo: 91, target: 12, painFrom: 6, painTo: 2,
    deviations: ['Reduced extension', 'Uncontrolled movement speed'] },
  { patientId: 'p002', exerciseId: 'elbow_flexion', sessions: 10, spanDays: 20, romFrom: 88, romTo: 96, formFrom: 80, formTo: 84, target: 10, painFrom: 3, painTo: 3,
    deviations: ['Upper-arm compensation'] },
  { patientId: 'p003', exerciseId: 'shoulder_flexion', sessions: 6, spanDays: 21, romFrom: 96, romTo: 92, formFrom: 70, formTo: 66, target: 10, skipRecentDays: 6, painFrom: 3, painTo: 6,
    deviations: ['Elbow bent during arm movement', 'Trunk lean (compensation)'] },
];

export function generateDemoSessions(now = new Date()): SessionRecord[] {
  const out: SessionRecord[] = [];
  PLANS.forEach((plan, pi) => {
    const rand = prng(101 + pi * 17);
    const ex = getExercise(plan.exerciseId)!;
    for (let i = 0; i < plan.sessions; i++) {
      const k = plan.sessions === 1 ? 1 : i / (plan.sessions - 1);
      const daysAgo = Math.round((plan.skipRecentDays ?? 0) + (plan.spanDays - (plan.skipRecentDays ?? 0)) * (1 - k));
      const start = new Date(now);
      start.setDate(start.getDate() - daysAgo);
      start.setHours(9 + Math.floor(rand() * 9), Math.floor(rand() * 60), 0, 0);
      const duration = 180 + Math.floor(rand() * 150);
      const avgRom = Math.round((plan.romFrom + (plan.romTo - plan.romFrom) * k + (rand() - 0.5) * 5) * 10) / 10;
      const form = Math.round(plan.formFrom + (plan.formTo - plan.formFrom) * k + (rand() - 0.5) * 6);
      const reps = Math.max(plan.target - 3, Math.min(plan.target, plan.target - Math.floor(rand() * 3 * (1 - k) + (rand() < 0.15 ? 1 : 0))));
      const devs = plan.deviations
        .map((label, di) => ({ label, count: Math.max(0, Math.round((1 - k) * (3 - di) + rand() * 1.5 - 0.5)) }))
        .filter((d) => d.count > 0);
      out.push({
        id: `demo-${plan.patientId}-${i + 1}`,
        patientId: plan.patientId,
        exerciseId: ex.id,
        exerciseName: ex.name,
        side: 'left',
        startedAt: start.toISOString(),
        endedAt: new Date(start.getTime() + duration * 1000).toISOString(),
        durationSec: duration,
        targetReps: plan.target,
        repetitions: reps,
        averageRom: avgRom,
        maxRom: Math.round((avgRom + 3 + rand() * 5) * 10) / 10,
        minAngle: null,
        maxAngle: null,
        formScore: form,
        movementQuality: qualityLabel(form),
        deviations: devs,
        status: reps >= plan.target ? 'completed' : 'partial',
        mode: 'demo',
        isDemoData: true,
        reps: [],
        events: [],
        ...(() => {
          const pb = Math.max(0, Math.min(10, Math.round(plan.painFrom + (plan.painTo - plan.painFrom) * k + (rand() - 0.5) * 1.5)));
          const pa = Math.max(0, Math.min(10, pb + (rand() < 0.3 ? 1 : 0) - (rand() < 0.3 ? 1 : 0)));
          return { painBefore: pb, painAfter: pa, difficulty: Math.max(1, Math.min(5, Math.round(4 - 2 * k + (rand() - 0.5)))) };
        })(),
      });
    }
  });
  return out;
}

/** Synthetic example notes from the demo therapist. */
export const DEMO_NOTES: TherapistNote[] = [
  {
    id: 'demo-note-1', patientId: 'p001', authorId: DEMO_THERAPIST_ID, authorName: 'Demo Therapist',
    body: 'Good consistency this week. Keep the lowering phase slow and controlled. (Synthetic demo note)',
    createdAt: new Date(Date.now() - 2 * 864e5).toISOString(),
  },
];
