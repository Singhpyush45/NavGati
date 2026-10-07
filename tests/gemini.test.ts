import { describe, expect, it } from 'vitest';
import { buildPrompt, DEFAULT_GEMINI_MODEL, handleGemini, validateRequest } from '@/services/ai/geminiHandler';
import { therapistPayload } from '@/services/ai/gemini';
import { DEMO_CARE_PLANS, DEMO_MESSAGES, DEMO_PATIENTS, generateDemoSessions } from '@/services/database/demoSeed';

describe('Gemini integration (server handler)', () => {
  it('rejects unknown tasks and missing key', async () => {
    expect(validateRequest({ task: 'chat', data: {} })).toBe('Unknown task.');
    const r = await handleGemini({ task: 'patient_coach', data: { reps: '10/12' } }, {});
    expect(r.status).toBe(503);
  });

  it('calls Gemini with the key in a header and returns the text', async () => {
    let url = ''; let headers: Record<string, string> = {}; let body: { systemInstruction: { parts: { text: string }[] } } | null = null;
    const fake = (async (u: string, init: RequestInit) => {
      url = u; headers = init.headers as Record<string, string>; body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Great work! ' }, { text: 'Keep it slow.' }] } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await handleGemini({ task: 'patient_coach', language: 'hi', data: { reps: '12/12' } }, { GEMINI_API_KEY: 'k' }, fake);
    expect(r.status).toBe(200);
    expect(r.body.text).toBe('Great work! Keep it slow.');
    expect(url).toContain(`/models/${DEFAULT_GEMINI_MODEL}:generateContent`);
    expect(url).not.toContain('k'.repeat(2));
    expect(headers['x-goog-api-key']).toBe('k');
    expect(body!.systemInstruction.parts[0].text).toMatch(/Hindi/);
  });

  it('surfaces API errors', async () => {
    const fake = (async () => new Response(JSON.stringify({ error: { message: 'API key not valid' } }), { status: 400 })) as unknown as typeof fetch;
    const r = await handleGemini({ task: 'therapist_summary', data: {} }, { GEMINI_API_KEY: 'bad' }, fake);
    expect(r.status).toBe(502);
    expect(r.body.error).toMatch(/API key not valid/);
  });

  it('therapist payload is anonymised', () => {
    const p = DEMO_PATIENTS[0];
    const all = generateDemoSessions().filter((s) => s.patientId === p.id);
    const payload = therapistPayload(p, all, all, DEMO_CARE_PLANS[p.id], DEMO_MESSAGES.filter((m) => m.patientId === p.id), 90);
    const text = JSON.stringify(payload);
    expect(text).toContain('P001');
    expect(text).not.toContain(p.name);
    expect(text).not.toContain(p.profile!.phone!);
    expect(buildPrompt({ task: 'therapist_summary', data: payload }).system).toMatch(/Never diagnose/);
  });
});
