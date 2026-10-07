import type { AppUser, CarePlan, PatientSummary, Role, SessionFeedback, SessionRecord, TherapistNote } from '@/types';
import { validateCarePlan } from '@/services/analytics/carePlan';
import type { AuthService, DataService } from './types';
import { DataError } from './types';
import { DEMO_CARE_PLANS, DEMO_NOTES, DEMO_PATIENTS, DEMO_THERAPIST_ID, generateDemoSessions } from './demoSeed';
import { hashPassword, verifyPassword } from './passwords';

/** Minimal Storage interface so tests can inject an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const K = {
  sessions: 'navgati:sessions',
  patients: 'navgati:patients',
  users: 'navgati:users',
  current: 'navgati:current-user',
  notes: 'navgati:notes',
  plans: 'navgati:care-plans',
  seeded: 'navgati:seeded-v3',
};

function read<T>(store: KeyValueStore, key: string, fallback: T): T {
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(store: KeyValueStore, key: string, value: unknown) {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    throw new DataError('unknown', 'Could not save to this browser’s storage (it may be full or disabled).');
  }
}

/** Browser-local storage backend. Used when Supabase is not configured. */
export class LocalDataService implements DataService {
  readonly backend = 'local' as const;
  constructor(private store: KeyValueStore) {
    if (!store.getItem(K.seeded)) this.seed();
  }

  private seed() {
    write(this.store, K.patients, DEMO_PATIENTS);
    write(this.store, K.sessions, generateDemoSessions());
    write(this.store, K.notes, DEMO_NOTES);
    write(this.store, K.plans, DEMO_CARE_PLANS);
    this.store.setItem(K.seeded, '1');
  }

  async saveSession(session: SessionRecord) {
    const all = read<SessionRecord[]>(this.store, K.sessions, []);
    write(this.store, K.sessions, [...all.filter((s) => s.id !== session.id), session]);
  }
  async getSession(id: string) {
    return read<SessionRecord[]>(this.store, K.sessions, []).find((s) => s.id === id) ?? null;
  }
  async listSessions(patientId: string) {
    return read<SessionRecord[]>(this.store, K.sessions, [])
      .filter((s) => s.patientId === patientId)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }
  async listPatients(user: AppUser) {
    const all = read<PatientSummary[]>(this.store, K.patients, []);
    if (user.role === 'ADMIN') return all;
    if (user.role === 'THERAPIST') return all.filter((p) => p.therapistId === user.id);
    return all.filter((p) => p.id === user.id);
  }
  async getPatient(id: string) {
    return read<PatientSummary[]>(this.store, K.patients, []).find((p) => p.id === id) ?? null;
  }
  async resetDemoData() {
    this.seed();
  }
  async updateSessionFeedback(id: string, fb: SessionFeedback) {
    const all = read<SessionRecord[]>(this.store, K.sessions, []);
    const i = all.findIndex((s) => s.id === id);
    if (i < 0) throw new DataError('not_found', 'Session not found.');
    all[i] = { ...all[i], ...fb };
    write(this.store, K.sessions, all);
  }
  async listNotes(patientId: string) {
    return read<TherapistNote[]>(this.store, K.notes, [])
      .filter((n) => n.patientId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async addNote(n: Omit<TherapistNote, 'id' | 'createdAt'>) {
    const body = n.body.trim();
    if (!body) throw new DataError('unknown', 'The note is empty.');
    const note: TherapistNote = { ...n, body: body.slice(0, 1000), id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    write(this.store, K.notes, [...read<TherapistNote[]>(this.store, K.notes, []), note]);
    return note;
  }
  async getCarePlan(patientId: string) {
    // Older local data (before care plans existed) gets the demo plans on first read.
    if (this.store.getItem(K.plans) === null) write(this.store, K.plans, DEMO_CARE_PLANS);
    return read<Record<string, CarePlan>>(this.store, K.plans, {})[patientId] ?? null;
  }
  async saveCarePlan(plan: Omit<CarePlan, 'updatedAt'>, role: Role) {
    if (role !== 'THERAPIST' && role !== 'ADMIN') throw new DataError('permission', 'Only a therapist can change the care plan.');
    const errors = validateCarePlan(plan.items);
    if (errors.length) throw new DataError('unknown', errors[0]);
    const saved: CarePlan = { ...plan, updatedAt: new Date().toISOString() };
    const all = read<Record<string, CarePlan>>(this.store, K.plans, {});
    write(this.store, K.plans, { ...all, [plan.patientId]: saved });
    return saved;
  }
  /** Used by local auth when a new patient registers. */
  addPatient(p: PatientSummary) {
    const all = read<PatientSummary[]>(this.store, K.patients, []);
    write(this.store, K.patients, [...all, p]);
  }
  countPatients() { return read<PatientSummary[]>(this.store, K.patients, []).length; }
}

interface StoredUser extends AppUser { passwordHash: string }

export const DEMO_ACCOUNTS = [
  { email: 'patient@navgati.demo', password: 'demo1234', role: 'PATIENT' as Role },
  { email: 'therapist@navgati.demo', password: 'demo1234', role: 'THERAPIST' as Role },
];

/** Local demo authentication: salted PBKDF2 hashes, role-based users. */
export class LocalAuthService implements AuthService {
  readonly backend = 'local' as const;
  private ready: Promise<void>;
  constructor(private store: KeyValueStore, private data: LocalDataService) {
    this.ready = this.seedUsers();
  }

  private async seedUsers() {
    const users = read<StoredUser[]>(this.store, K.users, []);
    if (users.some((u) => u.email === DEMO_ACCOUNTS[0].email)) return;
    const seeded: StoredUser[] = [
      { id: 'p001', email: DEMO_ACCOUNTS[0].email, name: 'Demo Patient A', role: 'PATIENT', patientCode: 'P001', passwordHash: await hashPassword(DEMO_ACCOUNTS[0].password) },
      { id: DEMO_THERAPIST_ID, email: DEMO_ACCOUNTS[1].email, name: 'Demo Therapist', role: 'THERAPIST', passwordHash: await hashPassword(DEMO_ACCOUNTS[1].password) },
    ];
    write(this.store, K.users, [...users, ...seeded]);
  }

  async currentUser() {
    await this.ready;
    return read<AppUser | null>(this.store, K.current, null);
  }

  async signIn(email: string, password: string) {
    await this.ready;
    const u = read<StoredUser[]>(this.store, K.users, []).find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || !(await verifyPassword(password, u.passwordHash))) {
      throw new DataError('auth', 'Email or password is incorrect.');
    }
    const { passwordHash: _omit, ...user } = u;
    void _omit;
    write(this.store, K.current, user);
    return user;
  }

  async signUp({ name, email, password, role }: { name: string; email: string; password: string; role: 'PATIENT' | 'THERAPIST' }) {
    await this.ready;
    if (password.length < 8) throw new DataError('auth', 'Use at least 8 characters for the password.');
    const users = read<StoredUser[]>(this.store, K.users, []);
    if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
      throw new DataError('auth', 'An account with this email already exists.');
    }
    const id = `${role === 'PATIENT' ? 'p' : 't'}-${crypto.randomUUID()}`;
    const code = role === 'PATIENT' ? `P${String(this.data.countPatients() + 1).padStart(3, '0')}` : undefined;
    const user: AppUser = { id, email: email.trim(), name: name.trim(), role, patientCode: code };
    write(this.store, K.users, [...users, { ...user, passwordHash: await hashPassword(password) }]);
    if (role === 'PATIENT') {
      // New local patients are assigned to the demo therapist so the therapist view is testable.
      this.data.addPatient({ id, name: user.name, patientCode: code!, therapistId: DEMO_THERAPIST_ID, isDemo: false });
    }
    write(this.store, K.current, user);
    return user;
  }

  async signOut() {
    this.store.removeItem(K.current);
  }
}
