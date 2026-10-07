import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '@/types';
import { activityCalendar, painSummary, streak } from '@/services/analytics/trends';
import { LocalDataService, MemoryStore } from '@/services/database/localDataService';

const NOW = new Date(2026, 8, 30, 18, 0, 0); // local time, Wed 30 Sep 2026

function s(daysAgo: number, extra: Partial<SessionRecord> = {}): SessionRecord {
  const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(10);
  return {
    id: `x${daysAgo}-${Math.random()}`, patientId: 'p', exerciseId: 'knee_extension', exerciseName: 'Knee Extension', side: 'left',
    startedAt: d.toISOString(), endedAt: d.toISOString(), durationSec: 200, targetReps: 10, repetitions: 10, averageRom: 60, maxRom: 65,
    minAngle: null, maxAngle: null, formScore: 80, movementQuality: 'Good', deviations: [], status: 'completed', mode: 'demo',
    isDemoData: true, reps: [], events: [], ...extra,
  };
}

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    expect(streak([s(0), s(1), s(2), s(4)], NOW)).toBe(3);
  });
  it('keeps yesterday’s streak alive before today’s session', () => {
    expect(streak([s(1), s(2)], NOW)).toBe(2);
  });
  it('is zero after a missed day', () => {
    expect(streak([s(2), s(3)], NOW)).toBe(0);
  });
  it('counts multiple sessions on one day once', () => {
    expect(streak([s(0), s(0), s(1)], NOW)).toBe(2);
  });
});

describe('activity calendar', () => {
  it('returns whole weeks starting on Monday and marks future days', () => {
    const cal = activityCalendar([s(0), s(0), s(3)], 4, NOW);
    expect(cal).toHaveLength(28);
    expect(new Date(cal[0].key + 'T12:00:00').getDay()).toBe(1); // Monday
    expect(cal.find((d) => d.count === 2)).toBeTruthy();
    expect(cal.filter((d) => d.future).length).toBe(4); // Thu–Sun after Wednesday
  });
});

describe('pain summary', () => {
  it('reports no data when nothing was rated', () => {
    expect(painSummary([s(1), s(0)])).toMatchObject({ latest: null, trend: 'Not enough data', alert: null });
  });
  it('detects decreasing pain without an alert', () => {
    const list = [6, 6, 5, 4, 4, 3, 2].map((p, i) => s(7 - i, { painAfter: p }));
    expect(painSummary(list)).toMatchObject({ latest: 2, trend: 'Decreasing', alert: null });
  });
  it('flags increasing pain for therapist review', () => {
    const list = [2, 3, 3, 4, 5, 5].map((p, i) => s(6 - i, { painAfter: p }));
    expect(painSummary(list)).toMatchObject({ trend: 'Increasing', alert: 'Reported pain increasing' });
  });
  it('flags high pain regardless of trend', () => {
    expect(painSummary([s(0, { painAfter: 8 })]).alert).toBe('High reported pain');
  });
});

describe('local notes and session feedback', () => {
  it('stores pain/difficulty on an existing session', async () => {
    const db = new LocalDataService(new MemoryStore());
    const rec = s(0, { id: 'fb1' });
    await db.saveSession(rec);
    await db.updateSessionFeedback('fb1', { painBefore: 4, painAfter: 3, difficulty: 2, patientNote: 'ok' });
    expect(await db.getSession('fb1')).toMatchObject({ painBefore: 4, painAfter: 3, difficulty: 2, patientNote: 'ok' });
    await expect(db.updateSessionFeedback('missing', { painAfter: 1 })).rejects.toThrow();
  });
  it('adds notes newest-first and rejects empty notes', async () => {
    const db = new LocalDataService(new MemoryStore());
    const seeded = await db.listNotes('p001');
    const n = await db.addNote({ patientId: 'p001', authorId: 't', authorName: 'T', body: '  Keep going  ' });
    expect(n.body).toBe('Keep going');
    const list = await db.listNotes('p001');
    expect(list[0].id).toBe(n.id);
    expect(list).toHaveLength(seeded.length + 1);
    await expect(db.addNote({ patientId: 'p001', authorId: 't', authorName: 'T', body: '   ' })).rejects.toThrow();
  });
});
