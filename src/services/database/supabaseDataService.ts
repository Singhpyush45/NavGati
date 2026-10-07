import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppUser, PatientSummary, Role, SessionFeedback, SessionRecord, TherapistNote } from '@/types';
import type { AuthService, DataService } from './types';
import { DataError } from './types';

/**
 * Supabase backend. Row-Level Security (see supabase/schema.sql) enforces:
 *  - patients read/write only their own rows
 *  - therapists read only assigned patients
 * The browser only ever holds the public anon key.
 */
export function createSupabase(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
}

function toDataError(e: unknown): DataError {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/fetch|network|Failed to fetch/i.test(msg)) return new DataError('network', 'Could not reach the server. Check your connection and try again.');
  if (/permission|rls|denied/i.test(msg)) return new DataError('permission', 'You do not have access to this data.');
  return new DataError('unknown', msg);
}

type SessionRow = {
  id: string; patient_id: string; exercise_id: string; exercise_name: string; side: string | null;
  started_at: string; ended_at: string; duration_sec: number; target_reps: number; repetitions: number;
  average_rom: number; max_rom: number; min_angle: number | null; max_angle: number | null; form_score: number;
  movement_quality: SessionRecord['movementQuality']; deviations: SessionRecord['deviations'];
  status: SessionRecord['status']; mode: SessionRecord['mode']; is_demo_data: boolean;
  reps: SessionRecord['reps']; events: SessionRecord['events'];
  pain_before?: number | null; pain_after?: number | null; difficulty?: number | null; patient_note?: string | null;
};

const fromRow = (r: SessionRow): SessionRecord => ({
  id: r.id, patientId: r.patient_id, exerciseId: r.exercise_id, exerciseName: r.exercise_name,
  side: (r.side as SessionRecord['side']) ?? null, startedAt: r.started_at, endedAt: r.ended_at,
  durationSec: r.duration_sec, targetReps: r.target_reps, repetitions: r.repetitions,
  averageRom: Number(r.average_rom), maxRom: Number(r.max_rom), minAngle: r.min_angle, maxAngle: r.max_angle,
  formScore: r.form_score, movementQuality: r.movement_quality, deviations: r.deviations ?? [],
  status: r.status, mode: r.mode, isDemoData: r.is_demo_data, reps: r.reps ?? [], events: r.events ?? [],
  painBefore: r.pain_before ?? null, painAfter: r.pain_after ?? null, difficulty: r.difficulty ?? null, patientNote: r.patient_note ?? null,
});

export class SupabaseDataService implements DataService {
  readonly backend = 'supabase' as const;
  constructor(private sb: SupabaseClient) {}

  async saveSession(s: SessionRecord) {
    const row: SessionRow = {
      id: s.id, patient_id: s.patientId, exercise_id: s.exerciseId, exercise_name: s.exerciseName, side: s.side,
      started_at: s.startedAt, ended_at: s.endedAt, duration_sec: s.durationSec, target_reps: s.targetReps,
      repetitions: s.repetitions, average_rom: s.averageRom, max_rom: s.maxRom, min_angle: s.minAngle,
      max_angle: s.maxAngle, form_score: s.formScore, movement_quality: s.movementQuality, deviations: s.deviations,
      status: s.status, mode: s.mode, is_demo_data: s.isDemoData, reps: s.reps, events: s.events,
      pain_before: s.painBefore ?? null, pain_after: s.painAfter ?? null, difficulty: s.difficulty ?? null, patient_note: s.patientNote ?? null,
    };
    const { error } = await this.sb.from('sessions').insert(row);
    if (error) throw toDataError(error);

    const { error: mErr } = await this.sb.from('session_metrics').insert({
      session_id: s.id,
      joint: s.exerciseId.split('_')[0],
      minimum_angle: s.minAngle,
      maximum_angle: s.maxAngle,
      rom: s.maxRom,
      average_rom: s.averageRom,
      form_score: s.formScore,
      deviation_count: s.deviations.reduce((n, d) => n + d.count, 0),
    });
    if (mErr) throw toDataError(mErr);

    if (s.events.length) {
      const { error: eErr } = await this.sb.from('movement_events').insert(
        s.events.map((e) => ({ session_id: s.id, t_ms: Math.round(e.t), type: e.type, detail: e.detail })),
      );
      if (eErr) throw toDataError(eErr);
    }
  }

  async updateSessionFeedback(id: string, fb: SessionFeedback) {
    const { error } = await this.sb.from('sessions').update({
      pain_before: fb.painBefore ?? null, pain_after: fb.painAfter ?? null,
      difficulty: fb.difficulty ?? null, patient_note: fb.patientNote ?? null,
    }).eq('id', id);
    if (error) throw toDataError(error);
  }

  async listNotes(patientId: string) {
    const { data, error } = await this.sb.from('therapist_notes').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    if (error) throw toDataError(error);
    return (data as { id: string; patient_id: string; author_id: string; author_name: string; body: string; created_at: string }[])
      .map((n): TherapistNote => ({ id: n.id, patientId: n.patient_id, authorId: n.author_id, authorName: n.author_name, body: n.body, createdAt: n.created_at }));
  }

  async addNote(n: Omit<TherapistNote, 'id' | 'createdAt'>) {
    const { data, error } = await this.sb.from('therapist_notes')
      .insert({ patient_id: n.patientId, author_id: n.authorId, author_name: n.authorName, body: n.body.trim().slice(0, 1000) })
      .select().single();
    if (error) throw toDataError(error);
    const r = data as { id: string; created_at: string };
    return { ...n, id: r.id, createdAt: r.created_at };
  }

  async getSession(id: string) {
    const { data, error } = await this.sb.from('sessions').select('*').eq('id', id).maybeSingle();
    if (error) throw toDataError(error);
    return data ? fromRow(data as SessionRow) : null;
  }

  async listSessions(patientId: string) {
    const { data, error } = await this.sb.from('sessions').select('*').eq('patient_id', patientId).order('started_at');
    if (error) throw toDataError(error);
    return (data as SessionRow[]).map(fromRow);
  }

  async listPatients(_user: AppUser) {
    void _user; // RLS already restricts rows to what this user may see
    const { data, error } = await this.sb.from('patients').select('id, patient_code, condition, therapist_id, is_demo, profiles(name)');
    if (error) throw toDataError(error);
    return (data as unknown as { id: string; patient_code: string; condition: string | null; therapist_id: string | null; is_demo: boolean; profiles: { name: string } | null }[])
      .map((p): PatientSummary => ({
        id: p.id, patientCode: p.patient_code, condition: p.condition ?? undefined,
        therapistId: p.therapist_id ?? undefined, isDemo: p.is_demo, name: p.profiles?.name ?? p.patient_code,
      }));
  }

  async getPatient(id: string) {
    const { data, error } = await this.sb.from('patients').select('id, patient_code, condition, therapist_id, is_demo, profiles(name)').eq('id', id).maybeSingle();
    if (error) throw toDataError(error);
    if (!data) return null;
    const p = data as unknown as { id: string; patient_code: string; condition: string | null; therapist_id: string | null; is_demo: boolean; profiles: { name: string } | null };
    return { id: p.id, patientCode: p.patient_code, condition: p.condition ?? undefined, therapistId: p.therapist_id ?? undefined, isDemo: p.is_demo, name: p.profiles?.name ?? p.patient_code };
  }

  async resetDemoData() {
    throw new DataError('permission', 'Demo data reset is only available in local mode.');
  }
}

export class SupabaseAuthService implements AuthService {
  readonly backend = 'supabase' as const;
  constructor(private sb: SupabaseClient) {}

  private async profile(id: string, email: string): Promise<AppUser> {
    const { data, error } = await this.sb.from('profiles').select('id, name, role').eq('id', id).single();
    if (error) throw toDataError(error);
    const p = data as { id: string; name: string; role: Role };
    let patientCode: string | undefined;
    if (p.role === 'PATIENT') {
      const { data: pt } = await this.sb.from('patients').select('patient_code').eq('id', id).maybeSingle();
      patientCode = (pt as { patient_code: string } | null)?.patient_code;
    }
    return { id: p.id, email, name: p.name, role: p.role, patientCode };
  }

  async currentUser() {
    const { data } = await this.sb.auth.getUser();
    if (!data.user) return null;
    return this.profile(data.user.id, data.user.email ?? '');
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new DataError('auth', error?.message ?? 'Sign-in failed.');
    return this.profile(data.user.id, data.user.email ?? email);
  }

  async signUp({ name, email, password, role }: { name: string; email: string; password: string; role: 'PATIENT' | 'THERAPIST' }) {
    // The profile row is created by the on_auth_user_created trigger from this metadata.
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { data: { name, role } } });
    if (error || !data.user) throw new DataError('auth', error?.message ?? 'Sign-up failed.');
    if (!data.session) throw new DataError('auth', 'Check your email to confirm your account, then sign in.');
    return this.profile(data.user.id, email);
  }

  async signOut() {
    await this.sb.auth.signOut();
  }
}
