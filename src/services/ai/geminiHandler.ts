/**
 * Server-side Gemini handler (runs in the Netlify Function and in the Vite dev server — never in the browser).
 * The API key stays on the server. The client sends only structured, anonymised session data for one of
 * two fixed tasks; the prompt is built here, so the endpoint can't be used as a general chatbot.
 * Built on-site at ReThink Hackathon 2026.
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export type GeminiTask = 'therapist_summary' | 'patient_coach';

export interface GeminiRequest {
  task: GeminiTask;
  /** Structured, anonymised data (no names / phone numbers). */
  data: Record<string, unknown>;
  language?: 'en' | 'hi';
}

export interface GeminiEnv { GEMINI_API_KEY?: string; GEMINI_MODEL?: string }

export interface GeminiResult { status: number; body: { text?: string; model?: string; error?: string } }

const SAFETY = 'You are a decision-support assistant inside NavGati, a rehabilitation movement-monitoring app. '
  + 'Measurements come from 2D camera pose estimation and are NOT clinically validated. Never diagnose, never prescribe medication, '
  + 'never claim certainty. Base every statement only on the data given. If pain is high or rising, recommend contacting the physiotherapist / doctor.';

const TASKS: Record<GeminiTask, (lang: 'en' | 'hi') => string> = {
  therapist_summary: () => `${SAFETY}
Write for a physiotherapist reviewing one patient. Output plain text, max 140 words:
1) "Summary:" 2–3 sentences on ROM, form, adherence and pain trends with the actual numbers.
2) "Watch:" up to 3 short bullet points ("- ") on concerns (anomalies, pain, missed plan sessions, messages).
3) "Consider:" up to 3 short bullet points of options for the therapist to consider (e.g. adjust reps, check in with patient). Phrase as suggestions, not orders.`,
  patient_coach: (lang) => `${SAFETY}
Write directly to the patient about their latest exercise session, in ${lang === 'hi' ? 'simple Hindi (Devanagari script), friendly tone' : 'simple, friendly English'}.
Max 90 words. Plain text. Structure: one line of encouragement with a real number from the data, then up to 3 short bullet points ("- ") on what to focus on next time based on the deviations/feedback, then one line reminding them to stop and tell their therapist if pain increases.`,
};

const MAX_DATA_CHARS = 8000;

export function buildPrompt(req: GeminiRequest): { system: string; user: string } {
  const lang = req.language === 'hi' ? 'hi' : 'en';
  return {
    system: TASKS[req.task](lang),
    user: `Data (JSON):\n${JSON.stringify(req.data).slice(0, MAX_DATA_CHARS)}`,
  };
}

export function validateRequest(x: unknown): GeminiRequest | string {
  if (!x || typeof x !== 'object') return 'Invalid request.';
  const r = x as Partial<GeminiRequest>;
  if (r.task !== 'therapist_summary' && r.task !== 'patient_coach') return 'Unknown task.';
  if (!r.data || typeof r.data !== 'object') return 'Missing data.';
  if (JSON.stringify(r.data).length > MAX_DATA_CHARS * 2) return 'Data too large.';
  return { task: r.task, data: r.data, language: r.language === 'hi' ? 'hi' : 'en' };
}

export async function handleGemini(raw: unknown, env: GeminiEnv, fetchImpl: typeof fetch = fetch): Promise<GeminiResult> {
  const req = validateRequest(raw);
  if (typeof req === 'string') return { status: 400, body: { error: req } };
  if (!env.GEMINI_API_KEY) return { status: 503, body: { error: 'Gemini is not configured on the server (set GEMINI_API_KEY).' } };
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const { system, user } = buildPrompt(req);
  try {
    const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } };
    if (!res.ok) return { status: 502, body: { error: `Gemini error: ${json.error?.message ?? res.status}` } };
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
    if (!text) return { status: 502, body: { error: 'Gemini returned an empty answer.' } };
    return { status: 200, body: { text, model } };
  } catch {
    return { status: 502, body: { error: 'Could not reach Gemini.' } };
  }
}
