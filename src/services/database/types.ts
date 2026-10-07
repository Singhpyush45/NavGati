import type { AppUser, CarePlan, PatientSummary, Role, SessionFeedback, SessionRecord, TherapistNote } from '@/types';

export interface DataService {
  readonly backend: 'supabase' | 'local';
  saveSession(session: SessionRecord): Promise<void>;
  getSession(id: string): Promise<SessionRecord | null>;
  listSessions(patientId: string): Promise<SessionRecord[]>;
  /** Therapists: assigned patients only. Admin: all. */
  listPatients(user: AppUser): Promise<PatientSummary[]>;
  getPatient(id: string): Promise<PatientSummary | null>;
  resetDemoData(): Promise<void>;
  /** Patient-reported pain / difficulty after a session. */
  updateSessionFeedback(id: string, fb: SessionFeedback): Promise<void>;
  listNotes(patientId: string): Promise<TherapistNote[]>;
  addNote(note: Omit<TherapistNote, 'id' | 'createdAt'>): Promise<TherapistNote>;
  /** Weekly care plan prescribed by the therapist (null when none yet). */
  getCarePlan(patientId: string): Promise<CarePlan | null>;
  /** Therapists/admins only. Validated before saving; also enforced by RLS on Supabase. */
  saveCarePlan(plan: Omit<CarePlan, 'updatedAt'>, role: Role): Promise<CarePlan>;
}

export interface AuthService {
  readonly backend: 'supabase' | 'local';
  currentUser(): Promise<AppUser | null>;
  signIn(email: string, password: string): Promise<AppUser>;
  signUp(input: { name: string; email: string; password: string; role: Exclude<Role, 'ADMIN'> }): Promise<AppUser>;
  signOut(): Promise<void>;
}

export class DataError extends Error {
  constructor(public kind: 'network' | 'auth' | 'permission' | 'not_found' | 'unknown', message: string) {
    super(message);
  }
}
