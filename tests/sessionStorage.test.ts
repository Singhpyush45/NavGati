import { describe, expect, it } from 'vitest';
import { LocalAuthService, LocalDataService, MemoryStore, DEMO_ACCOUNTS } from '@/services/database/localDataService';
import { buildSessionRecord } from '@/services/analytics/sessionBuilder';
import { MovementEngine } from '@/services/movement/movementEngine';
import { DemoSimulator } from '@/services/pose/demoSimulator';
import { getExercise } from '@/services/exercise/exercises';
import { adherence, consistency, slope, trendLabel } from '@/services/analytics/trends';

describe('session saving', () => {
  it('builds a session from engine state and persists it', async () => {
    const ex = getExercise('elbow_flexion')!;
    const sim = new DemoSimulator(ex);
    const engine = new MovementEngine(ex, 'auto', 5);
    for (let t = 0; t < 3400 * 5 + 500; t += 33) engine.analyze(sim.frameAt(t));
    const rec = buildSessionRecord(engine.getState(), ex, { id: 's1', patientId: 'p001', startedAt: 0, endedAt: 18000, targetReps: 5, mode: 'demo' });
    expect(rec.repetitions).toBeGreaterThanOrEqual(4);
    expect(rec.averageRom).toBeGreaterThan(40);
    expect(rec.isDemoData).toBe(true);

    const db = new LocalDataService(new MemoryStore());
    await db.saveSession(rec);
    expect(await db.getSession('s1')).toMatchObject({ id: 's1', exerciseId: 'elbow_flexion' });
    expect((await db.listSessions('p001')).some((s) => s.id === 's1')).toBe(true);
  });

  it('seeded demo data is clearly flagged', async () => {
    const db = new LocalDataService(new MemoryStore());
    const sessions = await db.listSessions('p001');
    expect(sessions.length).toBeGreaterThan(5);
    expect(sessions.every((s) => s.isDemoData)).toBe(true);
  });
});

describe('local auth & roles', () => {
  it('stores only password hashes and enforces role-based patient access', async () => {
    const store = new MemoryStore();
    const db = new LocalDataService(store);
    const auth = new LocalAuthService(store, db);
    const therapist = await auth.signIn(DEMO_ACCOUNTS[1].email, DEMO_ACCOUNTS[1].password);
    expect(therapist.role).toBe('THERAPIST');
    expect(store.getItem('navgati:users')).not.toContain('demo1234');
    await expect(auth.signIn(DEMO_ACCOUNTS[0].email, 'wrong-pass')).rejects.toThrow(/incorrect/);

    const patient = await auth.signIn(DEMO_ACCOUNTS[0].email, DEMO_ACCOUNTS[0].password);
    expect((await db.listPatients(patient)).map((p) => p.id)).toEqual(['p001']);
    expect((await db.listPatients(therapist)).length).toBe(4);
  });
});

describe('trend analytics', () => {
  it('computes slope and neutral trend labels', () => {
    expect(slope([1, 2, 3, 4])).toBeCloseTo(1);
    expect(trendLabel([55, 60, 65, 70], 0.5)).toBe('Improving');
    expect(trendLabel([70, 70.1, 69.9, 70], 0.5)).toBe('Stable');
    expect(trendLabel([70, 71], 0.5)).toBe('Not enough data');
  });
  it('adherence and consistency', async () => {
    const db = new LocalDataService(new MemoryStore());
    const s = await db.listSessions('p001');
    expect(adherence(s)).toBeGreaterThan(50);
    expect(consistency(s).days).toBe(7);
  });
});
