// Netlify Function: POST /api/gemini  (see netlify.toml). Keeps GEMINI_API_KEY server-side.
import { handleGemini } from '../../src/services/ai/geminiHandler';

declare const process: { env: Record<string, string | undefined> };

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });
  const body = await req.json().catch(() => null);
  const out = await handleGemini(body, { GEMINI_API_KEY: process.env.GEMINI_API_KEY, GEMINI_MODEL: process.env.GEMINI_MODEL });
  return new Response(JSON.stringify(out.body), { status: out.status, headers: { 'Content-Type': 'application/json' } });
};
