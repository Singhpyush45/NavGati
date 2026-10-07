import type { CarePlan, PatientMessage, PatientSummary, SessionRecord, TherapistNote } from '@/types';
import { getExercise } from '@/services/exercise/exercises';
import { qualityLabel } from '@/algorithms/formAssessment';

/**
 * SYNTHETIC DEMO DATA — clearly flagged with isDemo / isDemoData.
 * These are not real patients and not real measurements.
 */
export const DEMO_THERAPIST_ID = 'demo-therapist';

function daysAgoIso(d: number): string {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x.toISOString().slice(0, 10);
}

export const DEMO_THERAPIST_NAME = 'Dr. Neha Kapoor (PT)';

/** Fictional demo patients — names and details are made up, phone numbers are placeholders. */
export const DEMO_PATIENTS: PatientSummary[] = [
  { id: 'p001', name: 'Aarav Sharma', patientCode: 'P001', condition: 'ACL reconstruction – right knee', therapistId: DEMO_THERAPIST_ID, isDemo: true,
    profile: { age: 27, gender: 'Male', phone: '+91 90000 11001', city: 'New Delhi', diagnosis: 'Post-operative ACL reconstruction (week 6)', affectedSide: 'right',
      injuryDate: daysAgoIso(48), programStart: daysAgoIso(26), goal: 'Walk without a limp and return to football by March', emergencyContact: 'Sunita Sharma (mother) · +91 90000 11002' } },
  { id: 'p002', name: 'Priya Nair', patientCode: 'P002', condition: 'Elbow stiffness after fracture – left', therapistId: DEMO_THERAPIST_ID, isDemo: true,
    profile: { age: 34, gender: 'Female', phone: '+91 90000 22001', city: 'Noida', diagnosis: 'Stiffness after radial head fracture (cast removed)', affectedSide: 'left',
      injuryDate: daysAgoIso(70), programStart: daysAgoIso(21), goal: 'Full elbow bend to lift her daughter and cook comfortably', emergencyContact: 'Rohan Nair (husband) · +91 90000 22002' } },
  { id: 'p003', name: 'Arjun Mehta', patientCode: 'P003', condition: 'Frozen shoulder – right', therapistId: DEMO_THERAPIST_ID, isDemo: true,
    profile: { age: 52, gender: 'Male', phone: '+91 90000 33001', city: 'Gurugram', diagnosis: 'Adhesive capsulitis (frozen shoulder), stage 2', affectedSide: 'right',
      injuryDate: daysAgoIso(120), programStart: daysAgoIso(22), goal: 'Reach overhead shelves and sleep without shoulder pain', emergencyContact: 'Meera Mehta (wife) · +91 90000 33002' } },
  { id: 'p004', name: 'Kavya Reddy', patientCode: 'P004', condition: 'Ankle sprain rehab – left', therapistId: DEMO_THERAPIST_ID, isDemo: true,
    profile: { age: 21, gender: 'Female', phone: '+91 90000 44001', city: 'Greater Noida', diagnosis: 'Grade 2 lateral ankle sprain', affectedSide: 'left',
      injuryDate: daysAgoIso(30), programStart: daysAgoIso(19), goal: 'Back to college sports (badminton) without ankle giving way', emergencyContact: 'K. Srinivas Reddy (father) · +91 90000 44002' } },
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
  { patientId: 'p004', exerciseId: 'ankle_dorsiflexion', sessions: 12, spanDays: 18, romFrom: 14, romTo: 22, formFrom: 74, formTo: 86, target: 12, painFrom: 4, painTo: 2,
    deviations: ['Knee moving during ankle exercise'] },
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
    id: 'demo-note-1', patientId: 'p001', authorId: DEMO_THERAPIST_ID, authorName: DEMO_THERAPIST_NAME,
    body: 'Aarav, good consistency this week. Keep the lowering phase slow — count 3 seconds down. Ice for 10 min after if the knee feels warm.',
    createdAt: new Date(Date.now() - 2 * 864e5).toISOString(),
  },
];

/** Demo weekly care plans (synthetic). Keyed by patient id. */
export const DEMO_CARE_PLANS: Record<string, CarePlan> = {
  p001: {
    patientId: 'p001', updatedAt: new Date().toISOString(), updatedById: DEMO_THERAPIST_ID, updatedByName: DEMO_THERAPIST_NAME,
    items: [
      { exerciseId: 'knee_extension', side: 'auto', targetReps: 12, sessionsPerWeek: 5, targetRom: 90, instructions: 'Keep the thigh supported on the chair. Slow and controlled.' },
      { exerciseId: 'knee_flexion', side: 'auto', targetReps: 10, sessionsPerWeek: 3, targetRom: 80, instructions: 'Hold a chair for balance.' },
    ],
  },
  p002: {
    patientId: 'p002', updatedAt: new Date().toISOString(), updatedById: DEMO_THERAPIST_ID, updatedByName: DEMO_THERAPIST_NAME,
    items: [{ exerciseId: 'elbow_flexion', side: 'auto', targetReps: 10, sessionsPerWeek: 4, targetRom: 110 }],
  },
  p004: {
    patientId: 'p004', updatedAt: new Date().toISOString(), updatedById: DEMO_THERAPIST_ID, updatedByName: DEMO_THERAPIST_NAME,
    items: [{ exerciseId: 'ankle_dorsiflexion', side: 'left', targetReps: 12, sessionsPerWeek: 5, targetRom: 25, instructions: 'Keep the knee still, move only the ankle.' }],
  },
  p003: {
    patientId: 'p003', updatedAt: new Date().toISOString(), updatedById: DEMO_THERAPIST_ID, updatedByName: DEMO_THERAPIST_NAME,
    items: [{ exerciseId: 'shoulder_flexion', side: 'auto', targetReps: 10, sessionsPerWeek: 4, targetRom: 120, instructions: 'Stop if pain goes above 5/10.' }],
  },
};

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const P = (patientId: string, name: string, category: PatientMessage['category'], body: string, hoursAgo: number, read: boolean): PatientMessage => ({
  id: `demo-msg-${patientId}-${hoursAgo}`, patientId, senderRole: 'PATIENT', senderId: patientId, senderName: name, category, body, audio: null,
  createdAt: ago(hoursAgo), readAt: read ? ago(hoursAgo - 1) : null,
});
const T = (patientId: string, body: string, hoursAgo: number, read: boolean): PatientMessage => ({
  id: `demo-msg-${patientId}-t${hoursAgo}`, patientId, senderRole: 'THERAPIST', senderId: DEMO_THERAPIST_ID, senderName: DEMO_THERAPIST_NAME, category: 'general', body, audio: null,
  createdAt: ago(hoursAgo), readAt: read ? ago(hoursAgo - 1) : null,
});

/** Synthetic demo conversations (oldest first). */
export const DEMO_MESSAGES: PatientMessage[] = [
  P('p001', 'Aarav Sharma', 'question', 'Ma’am, my knee feels stiff for the first 15 minutes after waking up. Is that normal at this stage?', 30, true),
  T('p001', 'Yes, morning stiffness is common at week 6. Do 10 gentle heel slides before getting out of bed. Tell me if it lasts more than an hour.', 26, true),
  P('p001', 'Aarav Sharma', 'general', 'Done, it helps. Completed today’s knee extensions 👍', 3, false),
  P('p002', 'Priya Nair', 'problem', 'The camera is not picking up my left arm when I sit near the window. Should I change the room?', 20, true),
  T('p002', 'Yes — sit facing away from the window so the light falls on you, and keep your whole arm in frame.', 18, true),
  P('p003', 'Arjun Mehta', 'pain', 'Shoulder pain went up to 6/10 after yesterday’s session and I couldn’t sleep on that side.', 5, false),
  P('p004', 'Kavya Reddy', 'question', 'Can I start skipping rope next week or is it too early?', 9, false),
];
