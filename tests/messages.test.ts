import { describe, expect, it } from 'vitest';
import { LocalDataService, MemoryStore } from '@/services/database/localDataService';
import { unreadFor, urgency, validateMessage } from '@/services/analytics/messages';
import { DEMO_PATIENTS } from '@/services/database/demoSeed';

describe('patient ⇄ therapist messages', () => {
  it('demo patients have real-looking Indian names and profiles', () => {
    expect(DEMO_PATIENTS.map((p) => p.name)).toEqual(['Aarav Sharma', 'Priya Nair', 'Arjun Mehta', 'Kavya Reddy']);
    expect(DEMO_PATIENTS.every((p) => p.profile?.diagnosis && p.profile.goal)).toBe(true);
  });

  it('validates text and voice notes', () => {
    expect(validateMessage({ body: '  ', audio: null })).toMatch(/Write a message/);
    expect(validateMessage({ body: 'hello', audio: null })).toBeNull();
    expect(validateMessage({ body: '', audio: { dataUrl: 'data:audio/webm;base64,AAAA', durationSec: 5, mime: 'audio/webm' } })).toBeNull();
    expect(validateMessage({ body: '', audio: { dataUrl: 'data:text/html,hi', durationSec: 5, mime: 'text/html' } })).toMatch(/format/);
    expect(validateMessage({ body: '', audio: { dataUrl: 'data:audio/webm;base64,AAAA', durationSec: 120, mime: 'audio/webm' } })).toMatch(/60 seconds/);
  });

  it('sends, tracks unread and marks read per side', async () => {
    const db = new LocalDataService(new MemoryStore());
    const before = await db.listMessages('p003');
    expect(urgency(before)).toBe(2); // unread pain message from the demo seed
    await db.sendMessage({ patientId: 'p003', senderRole: 'PATIENT', senderId: 'p003', senderName: 'Arjun Mehta', category: 'question', body: 'Should I use a heat pack?',
      audio: { dataUrl: 'data:audio/webm;base64,AAAA', durationSec: 4, mime: 'audio/webm' } });
    let thread = await db.listMessages('p003');
    expect(unreadFor(thread, 'THERAPIST')).toHaveLength(2);
    expect(thread[thread.length - 1].audio?.durationSec).toBe(4);

    await db.markMessagesRead('p003', 'THERAPIST');
    thread = await db.listMessages('p003');
    expect(unreadFor(thread, 'THERAPIST')).toHaveLength(0);
    expect(urgency(thread)).toBe(0);

    await db.sendMessage({ patientId: 'p003', senderRole: 'THERAPIST', senderId: 't', senderName: 'Dr. Neha Kapoor (PT)', category: 'general', body: 'Yes, 10 minutes before exercise.', audio: null });
    expect(unreadFor(await db.listMessages('p003'), 'PATIENT')).toHaveLength(1);
    await expect(db.sendMessage({ patientId: 'p003', senderRole: 'PATIENT', senderId: 'p003', senderName: 'A', category: 'general', body: '', audio: null })).rejects.toThrow();
  });
});
