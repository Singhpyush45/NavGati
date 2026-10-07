import type { MessageCategory, PatientMessage } from '@/types';

/** Message helpers (pure). Built on-site at ReThink Hackathon 2026. */

export const MESSAGE_LIMITS = { body: 1000, voiceSec: 60, voiceBytes: 1_500_000 } as const;

export const CATEGORY_LABEL: Record<MessageCategory, string> = {
  general: 'General',
  pain: 'Pain / discomfort',
  question: 'Question',
  problem: 'Problem with app / exercise',
};

/** Messages the given role has not read yet (i.e. sent by the other side, no readAt). */
export function unreadFor(messages: PatientMessage[], role: 'PATIENT' | 'THERAPIST'): PatientMessage[] {
  return messages.filter((m) => m.senderRole !== role && !m.readAt);
}

export function validateMessage(m: Pick<PatientMessage, 'body' | 'audio'>): string | null {
  const body = m.body.trim();
  if (!body && !m.audio) return 'Write a message or record a voice note.';
  if (body.length > MESSAGE_LIMITS.body) return `Keep the message under ${MESSAGE_LIMITS.body} characters.`;
  if (m.audio) {
    if (!m.audio.dataUrl.startsWith('data:audio/')) return 'Voice note format not recognised.';
    if (m.audio.durationSec > MESSAGE_LIMITS.voiceSec + 1) return `Voice notes can be up to ${MESSAGE_LIMITS.voiceSec} seconds.`;
    if (m.audio.dataUrl.length > MESSAGE_LIMITS.voiceBytes * 1.4) return 'Voice note is too large.';
  }
  return null;
}

/** Sort key so patients with unread pain messages come first, then any unread, then the rest. */
export function urgency(messages: PatientMessage[]): number {
  const unread = unreadFor(messages, 'THERAPIST');
  if (unread.some((m) => m.category === 'pain')) return 2;
  return unread.length ? 1 : 0;
}

export function latest(messages: PatientMessage[]): PatientMessage | null {
  return messages.length ? messages[messages.length - 1] : null;
}
