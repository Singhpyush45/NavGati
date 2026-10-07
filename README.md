# NavGati

## 🏁 Built on-site at ReThink Hackathon 2026 (7 Oct, MAC Delhi) — Web Development vertical

**New today**
- **Weekly Care Plan (exercise prescription):** therapist sets exercises, reps, sessions/week, ROM goal and instructions per patient.
- **Patient "My care plan":** weekly progress, next exercise on the home screen, one-tap start with reps/side pre-filled.
- **Therapist view:** care-plan adherence column on the patient list + "Behind care plan" review flag.
- **Security:** new `care_plans` table with Row Level Security (patients read own plan; only assigned therapists can write). See `supabase/schema.sql` (v3).
- **Tests:** `tests/carePlan.test.ts` (weekly progress, validation, role check).
- **Patient ⇄ therapist messages:** patients send text or **voice notes** (mic, up to 60 s) tagged Pain / Question / Problem; therapist replies from the patient page. Unread/seen status, pain messages raise a review flag.
- **Therapist inbox + patient page:** "New messages from patients" on the dashboard (pain first); click a patient name to see full details (age, diagnosis, side, injury date, rehab week, goal, contacts), messages, care plan, charts and notes.
- New `patient_messages` table + `patients.profile` column with RLS (schema v4).
- **AI / ML additions (AI/ML vertical):**
  - **Recovery forecast:** least-squares linear regression of ROM over time → ROM trend (°/week), predicted ROM in 14 days, estimated date the therapist’s ROM goal is reached, with R² and a confidence level (`src/services/analytics/predict.ts`).
  - **Anomaly detection:** z-score of the latest session against the patient’s own baseline (ROM, form) + pain-spike check → “AI anomaly” review flag for the therapist.
  - **Live AI telemetry** on the exercise screen: frames/s, model inference time, GPU/CPU delegate, pose confidence, people in frame, exercise-match check.
  - Tests: `tests/predict.test.ts`.
- Renamed RehabX → **NavGati**. Demo patients: Aarav Sharma, Priya Nair, Arjun Mehta, Kavya Reddy (fictional).

**Built before the event (existing base):** camera pose tracking (MediaPipe), rep counting, ROM, form feedback, patient/therapist dashboards, notes.

**Demo logins (local mode):** patient `patient@navgati.demo` (Aarav Sharma) / therapist `therapist@navgati.demo` (Dr. Neha Kapoor), password `demo1234`.


**AI-powered rehabilitation & recovery platform — prototype**

> Turning every rehabilitation movement into measurable recovery.

> **Medical disclaimer.** NavGati is a rehabilitation monitoring and decision-support prototype. It does not replace professional medical diagnosis or clinical judgment. It has **not** been clinically validated.

---

## 1. What NavGati is

NavGati turns an ordinary laptop or phone camera into a contactless movement-measurement tool for rehabilitation exercises. The patient performs a prescribed exercise in front of the camera; NavGati detects body landmarks in the browser, measures the joint angle frame by frame, counts complete repetitions, computes range of motion (ROM), scores movement quality against configurable form rules, gives short real-time feedback, and stores **metrics only** (never video) so patients and therapists can see measured trends across sessions.

NavGati **measures**. It does not diagnose, it does not claim to heal, and it does not replace a physiotherapist.

## 2. Problem

Most rehabilitation happens at home, unsupervised. Therapists see a patient for a few minutes a week and have to rely on self-reports ("I did my exercises") that say nothing about how much the joint moved, how many repetitions were actually complete, or whether the patient compensated with another body part. Wearable sensors solve this but cost money and add friction.

## 3. Solution

Use the camera the patient already has. A pose-estimation model finds 33 body landmarks per frame; simple, transparent geometry turns those landmarks into joint angles; a state machine turns angles into repetitions; and dashboards turn sessions into trends that a therapist can review.

## 4. Architecture

```
Camera (getUserMedia, 640×480)                     ┐
  → requestAnimationFrame loop                     │  src/hooks/usePoseStream.ts
  → MediaPipe Pose Landmarker (WASM/GPU, in-browser)│  src/services/pose/poseService.ts
  → PoseFrame { landmarks[33], numPoses, t, aspect }┘
  → MovementEngine.analyze(frame)                     src/services/movement/movementEngine.ts
       ├─ landmark confidence gate                    src/algorithms/landmarkConfidence.ts
       ├─ joint angle (+ EMA smoothing, velocity)     src/algorithms/angleCalculation.ts
       ├─ exercise validation                         src/algorithms/exerciseRecognition.ts
       ├─ rep state machine                           src/algorithms/repetitionDetection.ts
       ├─ ROM                                         src/algorithms/romCalculation.ts
       ├─ form rules & rep score                      src/algorithms/formAssessment.ts
       └─ feedback messages                           src/algorithms/feedbackEngine.ts
  → canvas overlay (skeleton, target joint, angle)    src/services/pose/overlay.ts
  → React side panel refreshed ~8×/s (not per frame)  src/pages/LiveExercise.tsx
End session → buildSessionRecord → DataService.saveSession (Supabase or local)
```

Design rules:

* **Algorithms are pure TypeScript** with no React imports — they are unit-tested in Node.
* **Exercises are configuration**, not code (`src/services/exercise/exercises.ts`). Adding an exercise = adding one object.
* **The engine is generic**: `analyzeMovement({ exercise, frame, previousState })` returns `{ jointAngle, rom, movementState, repetitionCompleted, formScore, feedback, confidence, … }` and a new state. It knows nothing about knees or elbows.
* **Per-frame work never touches React state.** The analysis loop writes to refs and draws directly on a canvas; the UI polls those refs on a timer.
* **Backends are swappable** behind a `DataService` / `AuthService` interface.

### Project structure

```
src/
  algorithms/        angleCalculation, repetitionDetection, romCalculation, formAssessment,
                     exerciseRecognition, landmarkConfidence, feedbackEngine, landmarks
  services/
    pose/            poseService (MediaPipe), camera, overlay, demoSimulator
    exercise/        exercises (10 exercise configs)
    movement/        movementEngine (analyzeMovement + MovementEngine class)
    analytics/       sessionBuilder, trends, series
    database/        DataService interface, localDataService, supabaseDataService, demoSeed, passwords
  components/        Camera, PoseOverlay, Exercise, Feedback, Charts, Dashboard, UI
  pages/             Landing, Login, PatientDashboard, TherapistDashboard, ExerciseLibrary,
                     CameraSetup, LiveExercise, SessionSummary, Progress, PatientDetails,
                     SessionHistory, Settings
  context/ hooks/ types/ utils/
supabase/schema.sql  tables, roles, row-level security
tests/               Vitest unit tests
```

## 5. Tech stack

React 18 + TypeScript + Vite · Tailwind CSS · Recharts · MediaPipe Tasks Vision (Pose Landmarker lite) · Supabase (PostgreSQL + Auth + RLS) · Vitest.

## 6. Computer-vision pipeline

1. **Camera** — `getUserMedia` at 640×480. Small frames keep inference fast; angles do not need HD.
2. **Pose estimation** — MediaPipe Pose Landmarker in `VIDEO` mode, running in the browser via WebAssembly (GPU delegate with automatic CPU fallback). `numPoses: 2` so a second person can be *detected* and reported.
3. **Landmarks** — each landmark has normalized `x, y` (0–1), relative `z`, and `visibility` (0–1).
4. **Confidence gate** — if the three required landmarks are below the visibility threshold, the frame is **not analysed**. Messages: "Move your leg fully into view.", "Full body not detected.", "Please ensure only one person is visible."
5. **Side selection** — in *auto* mode the side with the more visible landmarks is chosen, then locked (with hysteresis) so the angle doesn't jump between legs.
6. **Angle → state machine → ROM → form → feedback** (below).

## 7. How the joint angle is computed

For three landmarks A–B–C (e.g. hip–knee–ankle) the angle is measured **at B**:

```
BA = A − B,   BC = C − B          (x first multiplied by width/height, see below)
θ  = atan2(|BA × BC|, BA · BC)    → degrees, 0°..180°
```

`atan2(cross, dot)` is used instead of `acos(dot / (|BA||BC|))` because `acos` loses precision near 0° and 180° — exactly where "fully straight" knees live.

Landmark `x` and `y` are both normalized to 0–1, but a 4:3 image is wider than it is tall, so one unit of `x` is longer than one unit of `y`. Multiplying `x` by the aspect ratio restores real geometry; without it a 90° knee could read as ~80°.

The raw angle is smoothed with an exponential moving average (`s = α·new + (1−α)·s`) to remove landmark jitter, and angular velocity (deg/s) is derived from successive smoothed angles.

## 8. How ROM works

ROM for a repetition = `maxAngle − minAngle` observed during that repetition. Session ROM statistics:

* **Average ROM** — mean of per-rep ROM,
* **Best ROM** — largest per-rep ROM,
* **Session min / max angle** — extremes seen across the whole session.

Example: min 80°, max 150° → ROM 70°. NavGati does **not** claim any ROM is "normal". Each exercise may carry an optional `referenceRom` which is shown only if enabled in Settings and is always labelled *reference*.

## 9. How repetition counting works

Counting "any movement" would count jitter, so every exercise uses a four-state machine:

```
REST ──(angle passes startThreshold + hysteresis)──▶ MOVING
MOVING ──(passes peakThreshold)──▶ PEAK
PEAK ──(moves back past peakThreshold − hysteresis)──▶ RETURNING
RETURNING ──(back past startThreshold − hysteresis)──▶ REST   ⇒ rep++ (if valid)
MOVING ──(returns to rest without reaching peak)──▶ REST       ⇒ "partial rep", not counted
```

* **Direction** — each exercise says whether the working phase *increases* (knee extension: bent → straight) or *decreases* (elbow flexion: straight → bent) the angle. Internally angles are mapped to "progress" so one state machine serves both.
* **Hysteresis** — thresholds differ going up vs. down (e.g. ±6°), so an angle wobbling around 150° cannot flip states back and forth.
* **Minimum duration** — a "rep" completed faster than `minRepDurationMs` is rejected as noise (and flagged "too fast").
* **Cooldown** — reps closer together than `cooldownMs` are debounced.
* **Confidence** — the machine does not advance on frames that failed the confidence gate.

Knee extension defaults: start 115°, peak 150°, hysteresis 6°, min duration 700 ms. All values live in the exercise config.

## 10. How form assessment works

Each exercise lists declarative **form rules**:

| Rule type | Checks |
|---|---|
| `targetReached` | did the rep reach the target angle (stricter than the counting peak)? |
| `controlledSpeed` | angular speed stays under a limit (deg/s) |
| `segmentOrientation` | a body segment stays near vertical/horizontal (e.g. thigh supported, upper arm still, trunk upright) |
| `jointAngleRange` | a secondary joint stays in range (e.g. elbow straight during shoulder flexion) |
| `cameraView` | patient is side-on / facing the camera as required |

Per frame, each rule passes or fails. When a rep ends:

```
rep form score = 100 × Σ(weight × passRate) / Σ(weight)
```

where `passRate` is the fraction of frames that passed (targetReached is 0 or 1). A rule passing in < 70 % of frames is recorded as an **observed deviation** with a neutral label (e.g. "Reduced extension", "Upper-arm compensation") for the therapist, while the patient sees a coaching message ("Try slightly greater extension"). Session form = mean rep score; quality label = Good (≥ 80), Fair (≥ 60), otherwise Needs review.

**Exercise validation:** over a ~3 s window the engine compares how much the target joint moved with how much other joints moved. If other joints are clearly doing the work, the patient sees "Please position yourself correctly or perform the selected exercise." The `ExerciseClassifier` interface in `exerciseRecognition.ts` is where a trained ML classifier can later replace this rule-based check.

## 11. Supported exercises

| Joint | Exercise | Status |
|---|---|---|
| Knee | Extension (seated), Flexion (standing) | supported |
| Elbow | Flexion, Extension | supported |
| Shoulder | Flexion, Abduction, Extension | supported |
| Shoulder | Adduction | **Exercise not supported yet** (not measurable reliably in 2D) |
| Ankle | Dorsiflexion, Plantarflexion | supported (sensitive to camera angle) |

Adding one: copy an object in `exercises.ts`, set landmarks, rep thresholds and form rules. No engine changes.

## 12. Database schema (Supabase)

`supabase/schema.sql` creates:

| Table | Purpose |
|---|---|
| `profiles` | one row per auth user: name, role (`PATIENT` / `THERAPIST` / `ADMIN`). Plays the role of the `users` table; credentials live in Supabase `auth.users` (hashed, never plaintext). |
| `therapists`, `patients` | role-specific details; `patients.therapist_id` = assignment |
| `exercises`, `exercise_rules` | exercise catalogue + JSON rep logic / form rules |
| `sessions` | patient, exercise, started/ended, duration, reps, target, average/max ROM, form score, quality, status, mode (camera/demo), `is_demo_data` |
| `session_metrics` | per-joint min/max/average angle, ROM, form score, deviation count |
| `movement_events` | rep completed, partial rep, too fast, deviation, low confidence… |
| `progress_metrics` | per-patient per-exercise aggregates for dashboards |

**Row-level security:** patients can read/write only their own rows; therapists can read patients assigned to them; admins can read everything. Helper SQL functions `app_role()` and `can_access_patient()` keep the policies short. A trigger creates the `profiles` row on sign-up.

## 13. Installation

Requirements: Node.js 18+ (tested with 22) and a modern Chromium, Edge, Firefox or Safari.

```bash
npm install
cp .env.example .env      # optional — works without editing
npm run dev               # http://localhost:5173
```

The camera only works on `localhost` or `https://` (browser security rule).

Other scripts: `npm test` (unit tests), `npm run typecheck`, `npm run build`, `npm run preview`.

## 14. Environment variables

| Variable | Meaning |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | If both are set, NavGati uses Supabase Auth + Postgres. If empty, it runs in **local mode**: data in the browser's `localStorage`, passwords stored as salted PBKDF2 hashes, demo accounts pre-created. |
| `VITE_MEDIAPIPE_WASM_PATH` | Where the MediaPipe WASM runtime is loaded from (default: jsDelivr CDN). |
| `VITE_POSE_MODEL_URL` | Pose Landmarker `.task` model (default: Google storage, ~5 MB, downloaded once and cached). |

**Offline use:** copy `node_modules/@mediapipe/tasks-vision/wasm` to `public/mediapipe/wasm`, download `pose_landmarker_lite.task` to `public/mediapipe/`, and set the two variables as shown in `.env.example`.

**Using Supabase:** create a project → SQL editor → run `supabase/schema.sql` → copy the URL and anon key into `.env` → restart `npm run dev`. Assign a patient to a therapist by setting `patients.therapist_id`.

## 15. Running locally & demo accounts (local mode)

| Role | Email | Password |
|---|---|---|
| Patient (P001) | `patient@navgati.demo` | `demo1234` |
| Therapist | `therapist@navgati.demo` | `demo1234` |

The key flow: sign in as the patient → *Start today's exercise* → Camera setup (Knee Extension, *Live camera*) → allow camera → sit side-on to the camera with the whole leg visible → *Start exercise* → straighten and bend the knee → reps, angle, ROM, form and feedback update live → *End session* → summary is saved → dashboard and Progress show it. Sign in as the therapist to see the patient list and patient P001's detail page.

## 16. Demo mode

Choose **Demo simulation** on the camera-setup screen (or `?mode=demo`). A deterministic simulator generates synthetic landmarks for the selected exercise — including an occasional partial repetition — and feeds them through **the exact same engine** as the camera. The screen is permanently labelled **DEMO MODE · simulated landmarks**, sessions are saved with `mode: demo` / `isDemoData: true` and shown with a *Demo* badge. Demo mode also has switches to simulate *person leaves frame* and *second person appears* so error handling can be shown on stage.

The seeded patients P001–P003 are **synthetic demo data**, labelled as such everywhere. They are not real patients.

## 17. Tests

```bash
npm test
```

51 Vitest tests cover angle calculation (right angles, straight lines, aspect correction, degenerate input), ROM, the repetition state machine (full reps, partial reps, jitter around thresholds, very fast movement, no movement, decreasing-direction exercises), the full movement engine on simulated sessions, exercise validation (match vs. wrong joint), form scoring, landmark confidence (missing landmark, person leaves frame, multiple people), and session building/saving.

## 18. Privacy

Video frames are processed in the browser and discarded; they are never recorded or uploaded. Only derived metrics are stored. Raw-video storage is not implemented and would require explicit, separate consent.

## 19. Limitations (honest list)

* **2D camera.** Angles are measured in the image plane. If the limb moves toward/away from the camera, the measured angle is smaller than the real one. That is why most exercises require a side view.
* **Shoulder extension** cannot tell forward from backward arm movement in 2D; shoulder **adduction** is marked unsupported.
* **Ankle angles** depend on the small heel/foot-index landmarks and are sensitive to camera angle and footwear.
* Pose models are less accurate with loose clothing, poor light, occlusion, wheelchairs/walkers, and body types under-represented in training data.
* Thresholds are sensible starting values, **not clinically validated norms**; therapists should tune them per patient.
* No accuracy study against a goniometer or motion-capture system has been done.
* The Supabase path is implemented against the schema but has been exercised less than the local backend.

## 20. Future roadmap

Therapist-configurable thresholds per patient · exercise prescription & scheduling · trained temporal classifier for automatic exercise recognition (plugs into `ExerciseClassifier`) · 3D/world landmarks and multi-camera setups · accuracy validation study vs. goniometry · pain/effort self-report after sessions · clinician reports (PDF/FHIR export) · offline-first sync · accessibility testing with patients.

## 21. Medical disclaimer

NavGati is a rehabilitation monitoring and decision-support prototype. It does not replace professional medical diagnosis or clinical judgment. It does not diagnose injuries, does not guarantee recovery, and is not a medical device. Always follow the exercises prescribed by your therapist, and stop and consult them if you experience pain.

## 22. Engagement & phone features (v2)

Added after reviewing what established home-exercise apps (e.g. Physitrack/PhysiApp, HealHabit) offer:

* **Patient-reported outcomes** — after each session the patient rates pain before/after (0–10 numeric scale) and perceived difficulty (1–5), with an optional note. Pain trends appear in Progress and on the therapist's patient page; rising or high pain adds a *Requires therapist review* flag. NavGati never interprets pain clinically.
* **Animated exercise demonstrations** — every exercise card and the setup screen show a looping skeleton generated by the same simulator used in demo mode, so the demonstration always matches the exercise configuration.
* **Streak + 12-week activity heatmap** on the patient dashboard and progress pages.
* **Therapist → patient notes** (table `therapist_notes`, RLS-protected); the newest note is shown on the patient's home screen.
* **Printable report** — "Report / PDF" uses a print stylesheet (browser *Save as PDF*).
* **Live session UX** — 3-2-1 countdown, large HUD readable from 2–3 m, rep "pop" animation, confetti when the prescribed reps are reached, optional voice count.

Phone support:

* Portrait camera streams are displayed at their real aspect ratio; front/back camera selector (back camera is not mirrored).
* Screen Wake Lock keeps the display on during a session (Android Chrome, iOS 16.4+).
* Haptic feedback on each rep (Android; iOS Safari does not support vibration).
* Full-screen button where the browser supports it (hidden on iPhone, which doesn't allow element full-screen).
* Installable PWA: `manifest.webmanifest`, icons, and `sw.js` (network-first app shell, cached assets and pose model for faster repeat visits). *Settings → Install on your phone.*
* Card layouts replace wide tables on small screens; safe-area insets respected.

Database migration: re-run the bottom "v2" block of `supabase/schema.sql` on an existing project.
