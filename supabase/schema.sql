-- ═══════════════════════════════════════════════════════════════
-- NavGati database schema (Supabase / PostgreSQL)
-- Run in the Supabase SQL editor. Passwords are handled by Supabase Auth
-- (bcrypt) — no password column exists in these tables.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- Roles ----------------------------------------------------------
do $$ begin
  create type user_role as enum ('PATIENT', 'THERAPIST', 'ADMIN');
exception when duplicate_object then null; end $$;

-- users → profiles (1:1 with auth.users) --------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  role        user_role not null default 'PATIENT',
  created_at  timestamptz not null default now()
);

create table if not exists public.therapists (
  id            uuid primary key references public.profiles(id) on delete cascade,
  clinic        text,
  created_at    timestamptz not null default now()
);

create table if not exists public.patients (
  id            uuid primary key references public.profiles(id) on delete cascade,
  patient_code  text unique not null,
  condition     text,
  therapist_id  uuid references public.therapists(id) on delete set null,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Exercise catalogue (mirrors src/services/exercise/exercises.ts) --
create table if not exists public.exercises (
  id          text primary key,              -- e.g. 'knee_extension'
  name        text not null,
  joint       text not null,
  movement    text not null,
  supported   boolean not null default true,
  difficulty  text not null default 'Beginner',
  config      jsonb not null                 -- full ExerciseConfig
);

-- Per-patient overrides set by a therapist (thresholds, target reps)
create table if not exists public.exercise_rules (
  id           uuid primary key default gen_random_uuid(),
  exercise_id  text not null references public.exercises(id) on delete cascade,
  patient_id   uuid references public.patients(id) on delete cascade,
  therapist_id uuid references public.therapists(id) on delete set null,
  target_reps  int not null default 12,
  overrides    jsonb not null default '{}'::jsonb,  -- e.g. {"repLogic":{"peakThreshold":145}}
  created_at   timestamptz not null default now()
);

-- Sessions: metrics only (no raw video) -----------------------------
create table if not exists public.sessions (
  id                text primary key,
  patient_id        uuid not null references public.patients(id) on delete cascade,
  exercise_id       text not null,
  exercise_name     text not null,
  side              text,
  started_at        timestamptz not null,
  ended_at          timestamptz not null,
  duration_sec      int not null,
  target_reps       int not null,
  repetitions       int not null,
  average_rom       numeric(6,1) not null,
  max_rom           numeric(6,1) not null,
  min_angle         numeric(6,1),
  max_angle         numeric(6,1),
  form_score        int not null,
  movement_quality  text not null,
  deviations        jsonb not null default '[]'::jsonb,
  status            text not null check (status in ('completed','partial')),
  mode              text not null check (mode in ('camera','demo')),
  is_demo_data      boolean not null default false,
  reps              jsonb not null default '[]'::jsonb,
  events            jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists sessions_patient_started on public.sessions(patient_id, started_at);

create table if not exists public.session_metrics (
  id               uuid primary key default gen_random_uuid(),
  session_id       text not null references public.sessions(id) on delete cascade,
  joint            text not null,
  minimum_angle    numeric(6,1),
  maximum_angle    numeric(6,1),
  rom              numeric(6,1),
  average_rom      numeric(6,1),
  average_angle    numeric(6,1),
  form_score       int,
  deviation_count  int not null default 0
);

create table if not exists public.movement_events (
  id          bigint generated always as identity primary key,
  session_id  text not null references public.sessions(id) on delete cascade,
  t_ms        bigint not null,
  type        text not null,
  detail      text
);

create table if not exists public.progress_metrics (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients(id) on delete cascade,
  exercise_id   text not null,
  period_start  date not null,
  period_end    date not null,
  sessions      int not null,
  avg_rom       numeric(6,1),
  avg_form      int,
  adherence_pct int,
  rom_trend     text,
  form_trend    text,
  unique (patient_id, exercise_id, period_start)
);

-- Helper functions ------------------------------------------------
create or replace function public.app_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.can_access_patient(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    pid = auth.uid()
    or exists (select 1 from public.patients p where p.id = pid and p.therapist_id = auth.uid())
    or public.app_role() = 'ADMIN'
$$;

-- New auth user → profile (+ patient/therapist row) -----------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r user_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'PATIENT');
begin
  if r = 'ADMIN' then r := 'PATIENT'; end if; -- admins are promoted manually, never self-assigned
  insert into public.profiles(id, name, role)
    values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), r);
  if r = 'THERAPIST' then
    insert into public.therapists(id) values (new.id);
  else
    insert into public.patients(id, patient_code)
      values (new.id, 'P' || lpad((select count(*) + 1 from public.patients)::text, 3, '0'));
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row-Level Security ---------------------------------------------
alter table public.profiles         enable row level security;
alter table public.therapists       enable row level security;
alter table public.patients         enable row level security;
alter table public.exercises        enable row level security;
alter table public.exercise_rules   enable row level security;
alter table public.sessions         enable row level security;
alter table public.session_metrics  enable row level security;
alter table public.movement_events  enable row level security;
alter table public.progress_metrics enable row level security;

create policy "profiles: self, assigned therapist, admin" on public.profiles for select
  using (id = auth.uid() or public.can_access_patient(id) or public.app_role() = 'ADMIN');
create policy "profiles: update self" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "therapists: self or admin" on public.therapists for select
  using (id = auth.uid() or public.app_role() = 'ADMIN');

create policy "patients: visible to self / therapist / admin" on public.patients for select
  using (public.can_access_patient(id));
create policy "patients: admin assigns therapist" on public.patients for update
  using (public.app_role() = 'ADMIN');

create policy "exercises: readable by signed-in users" on public.exercises for select
  using (auth.role() = 'authenticated');

create policy "exercise_rules: read" on public.exercise_rules for select
  using (patient_id is null or public.can_access_patient(patient_id));
create policy "exercise_rules: therapist writes for assigned" on public.exercise_rules for all
  using (public.app_role() in ('THERAPIST','ADMIN') and (patient_id is null or public.can_access_patient(patient_id)))
  with check (public.app_role() in ('THERAPIST','ADMIN') and (patient_id is null or public.can_access_patient(patient_id)));

create policy "sessions: read" on public.sessions for select using (public.can_access_patient(patient_id));
create policy "sessions: patient inserts own" on public.sessions for insert with check (patient_id = auth.uid());

create policy "session_metrics: read" on public.session_metrics for select
  using (exists (select 1 from public.sessions s where s.id = session_id and public.can_access_patient(s.patient_id)));
create policy "session_metrics: insert own" on public.session_metrics for insert
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.patient_id = auth.uid()));

create policy "movement_events: read" on public.movement_events for select
  using (exists (select 1 from public.sessions s where s.id = session_id and public.can_access_patient(s.patient_id)));
create policy "movement_events: insert own" on public.movement_events for insert
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.patient_id = auth.uid()));

create policy "progress_metrics: read" on public.progress_metrics for select using (public.can_access_patient(patient_id));

-- Seed exercise catalogue (names only; full config lives in the app for the MVP)
insert into public.exercises(id, name, joint, movement, supported, difficulty, config) values
  ('knee_extension','Knee Extension','knee','Extension',true,'Beginner','{}'),
  ('knee_flexion','Standing Knee Flexion','knee','Flexion',true,'Intermediate','{}'),
  ('elbow_flexion','Elbow Flexion','elbow','Flexion',true,'Beginner','{}'),
  ('elbow_extension','Elbow Extension','elbow','Extension',true,'Beginner','{}'),
  ('shoulder_flexion','Shoulder Flexion','shoulder','Flexion',true,'Intermediate','{}'),
  ('shoulder_abduction','Shoulder Abduction','shoulder','Abduction',true,'Intermediate','{}'),
  ('shoulder_extension','Shoulder Extension','shoulder','Extension',true,'Intermediate','{}'),
  ('shoulder_adduction','Shoulder Horizontal Adduction','shoulder','Adduction',false,'Intermediate','{}'),
  ('ankle_dorsiflexion','Ankle Dorsiflexion','ankle','Dorsiflexion',true,'Advanced','{}'),
  ('ankle_plantarflexion','Ankle Plantarflexion','ankle','Plantarflexion',true,'Advanced','{}')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- v2: patient-reported outcomes + therapist notes
-- ─────────────────────────────────────────────────────────────
alter table public.sessions
  add column if not exists pain_before smallint check (pain_before between 0 and 10),
  add column if not exists pain_after smallint check (pain_after between 0 and 10),
  add column if not exists difficulty smallint check (difficulty between 1 and 5),
  add column if not exists patient_note text check (char_length(patient_note) <= 500);

create table if not exists public.therapist_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  author_name text not null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.therapist_notes enable row level security;

-- Patients read notes about themselves; assigned therapists / admins read and write.
create policy notes_read on public.therapist_notes for select
  using (patient_id = auth.uid() or public.can_access_patient(patient_id));
create policy notes_write on public.therapist_notes for insert
  with check (author_id = auth.uid() and public.app_role() in ('THERAPIST','ADMIN') and public.can_access_patient(patient_id));
-- Patients may add their own pain / difficulty rating to their own sessions.
create policy "sessions: patient updates own feedback" on public.sessions for update
  using (patient_id = auth.uid()) with check (patient_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- v3 (ReThink Hackathon 2026, built on-site): weekly care plans
-- One plan per patient. items = [{exerciseId, side, targetReps, sessionsPerWeek, targetRom, instructions}]
-- ─────────────────────────────────────────────────────────────
create table if not exists public.care_plans (
  patient_id       uuid primary key references public.patients(id) on delete cascade,
  items            jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 6),
  updated_by_id    uuid not null references public.profiles(id),
  updated_by_name  text not null,
  updated_at       timestamptz not null default now()
);
alter table public.care_plans enable row level security;

-- Patients read their own plan; assigned therapists / admins read and write.
create policy care_plans_read on public.care_plans for select
  using (public.can_access_patient(patient_id));
create policy care_plans_insert on public.care_plans for insert
  with check (updated_by_id = auth.uid() and public.app_role() in ('THERAPIST','ADMIN') and public.can_access_patient(patient_id));
create policy care_plans_update on public.care_plans for update
  using (public.app_role() in ('THERAPIST','ADMIN') and public.can_access_patient(patient_id))
  with check (updated_by_id = auth.uid() and public.app_role() in ('THERAPIST','ADMIN') and public.can_access_patient(patient_id));

-- ─────────────────────────────────────────────────────────────
-- v4 (ReThink Hackathon 2026, built on-site): patient profile + patient ⇄ therapist messages
-- ─────────────────────────────────────────────────────────────
alter table public.patients add column if not exists profile jsonb not null default '{}'::jsonb;
-- Therapists may edit profile details of their own patients.
create policy "patients: therapist updates profile" on public.patients for update
  using (public.app_role() in ('THERAPIST','ADMIN') and public.can_access_patient(id))
  with check (public.app_role() in ('THERAPIST','ADMIN') and public.can_access_patient(id));

create table if not exists public.patient_messages (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients(id) on delete cascade,
  sender_role  text not null check (sender_role in ('PATIENT','THERAPIST')),
  sender_id    uuid not null references public.profiles(id),
  sender_name  text not null,
  category     text not null default 'general' check (category in ('general','pain','question','problem')),
  body         text not null default '' check (char_length(body) <= 1000),
  -- MVP: voice note stored inline as {dataUrl, durationSec, mime} (≤ ~2 MB). Production: move to Supabase Storage.
  audio        jsonb,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  check (char_length(body) > 0 or audio is not null)
);
create index if not exists patient_messages_patient on public.patient_messages(patient_id, created_at);
alter table public.patient_messages enable row level security;

create policy messages_read on public.patient_messages for select
  using (public.can_access_patient(patient_id));
-- Patients write only into their own thread as PATIENT; therapists only to assigned patients as THERAPIST.
create policy messages_insert on public.patient_messages for insert with check (
  sender_id = auth.uid() and (
    (sender_role = 'PATIENT' and patient_id = auth.uid()) or
    (sender_role = 'THERAPIST' and public.app_role() in ('THERAPIST','ADMIN') and public.can_access_patient(patient_id))
  ));
-- Either side can mark the thread as read (only read_at changes in the app).
create policy messages_mark_read on public.patient_messages for update
  using (public.can_access_patient(patient_id)) with check (public.can_access_patient(patient_id));
