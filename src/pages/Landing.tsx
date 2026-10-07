import { Link } from 'react-router-dom';
import { Logo } from '@/components/UI/Logo';
import { Disclaimer } from '@/components/UI/primitives';
import { HeroDemo } from '@/components/PoseOverlay/HeroDemo';
import { Aurora } from '@/components/FX/Aurora';
import { CountUp, useScrollReveal } from '@/components/FX/motion';
import { EXERCISES } from '@/services/exercise/exercises';

const STEPS = [
  ['See', 'Your phone or laptop camera watches the exercise. No sensors, no uploads.', 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z'],
  ['Understand', 'A pose model finds 33 body landmarks in every frame, in the browser.', 'M12 3v4M12 17v4M3 12h4M17 12h4M12 12h.01'],
  ['Measure', 'Joint angles, range of motion and repetitions are calculated from those landmarks.', 'M4 20L12 6l8 14M8.5 14a4 4 0 017 0'],
  ['Assess', 'Each rep is checked against exercise-specific form rules.', 'M9 12l2 2 4-4M12 21a9 9 0 110-18 9 9 0 010 18z'],
  ['Track', 'Results, pain and effort are saved as numbers, building a history over weeks.', 'M4 18l5-6 4 3 7-9'],
  ['Improve', 'Short, safe cues during exercise; trends, streaks and notes after it.', 'M13 2L4 14h7l-1 8 9-12h-7l1-8z'],
];

const FEATURES = [
  ['Live pose tracking', 'Skeleton, measured joint and angle arc drawn on the camera feed at video frame rate.', 'from-tide to-tide2'],
  ['Honest rep counting', 'A four-state machine with hysteresis — jitter and half-reps don’t count.', 'from-tide2 to-violet'],
  ['Pain & effort diary', 'Patients rate pain (0–10) and difficulty after each session. Rising pain is flagged for the therapist.', 'from-violet to-signal'],
  ['Streaks & calendar', 'A 12-week activity heatmap and daily streak make consistency visible.', 'from-signal to-tide'],
  ['Therapist notes', 'Short notes from the therapist appear on the patient’s home screen.', 'from-tide to-violet'],
  ['Printable reports', 'One click turns progress into a clean report for the next clinic visit.', 'from-tide2 to-tide'],
];

export default function Landing() {
  useScrollReveal();
  const names = EXERCISES.filter((e) => e.supported).map((e) => e.name);

  return (
    <div className="relative min-h-screen">
      <Aurora spotlight />

      <header className="sticky top-0 z-30 border-b border-line/40 backdrop-blur-xl" style={{ background: 'rgb(var(--glass) / .55)', paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Logo />
          <nav className="flex items-center gap-1 text-sm">
            <a href="#how" className="hidden rounded-lg px-3 py-2 text-muted transition-colors hover:text-ink md:inline">How it works</a>
            <a href="#features" className="hidden rounded-lg px-3 py-2 text-muted transition-colors hover:text-ink md:inline">Features</a>
            <a href="#tech" className="hidden rounded-lg px-3 py-2 text-muted transition-colors hover:text-ink md:inline">Technology</a>
            <Link to="/login" className="btn-secondary ml-2 !py-2">Sign in</Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:pb-24 lg:pt-16">
        <div className="stagger">
          <span className="chip">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-ok" /></span>
            On-device AI · video never leaves the browser
          </span>
          <h1 className="mt-6 font-display text-[44px] font-normal leading-[1.02] tracking-tight sm:text-[64px]">
            Turning every rehabilitation movement into <span className="text-gradient italic">measurable recovery.</span>
          </h1>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-muted">
            RehabX uses an ordinary camera to measure joint angles, range of motion, repetitions and form while a patient exercises at home — and gives their therapist the numbers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login?role=patient" className="btn-primary !px-6 !py-3.5 text-[15px]">
              Start rehabilitation
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
            <Link to="/login?role=therapist" className="btn-secondary !px-6 !py-3.5 text-[15px]">For therapists</Link>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
            {[[33, 'body landmarks per frame', ''], [10, 'configurable exercises', ''], [0, 'video frames uploaded', '']].map(([v, l]) => (
              <div key={l as string}>
                <dt className="sr-only">{l}</dt>
                <dd className="text-3xl font-semibold tracking-tight text-gradient"><CountUp value={v as number} duration={1600} /></dd>
                <p className="mt-1 text-xs leading-snug text-muted">{l}</p>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-tr from-tide/30 via-tide2/20 to-violet/30 blur-3xl" aria-hidden="true" />
          <div className="glow-border rounded-[26px] p-1.5 shadow-2xl shadow-tide/20">
            <div className="overflow-hidden rounded-[22px]"><HeroDemo /></div>
          </div>
          <div className="float panel absolute -left-4 top-10 hidden px-4 py-3 sm:block" aria-hidden="true">
            <div className="text-[11px] text-muted">Form quality</div>
            <div className="text-xl font-semibold text-ok">92%</div>
          </div>
          <div className="float-slow panel absolute -right-3 bottom-24 hidden px-4 py-3 sm:block" style={{ animationDelay: '1.2s' }} aria-hidden="true">
            <div className="text-[11px] text-muted">Rep counted</div>
            <div className="flex items-center gap-2 text-xl font-semibold"><span className="grid h-6 w-6 place-items-center rounded-full bg-ok/15 text-sm text-ok">✓</span>Full cycle</div>
          </div>
        </div>
      </section>

      {/* ── Exercise marquee ── */}
      <div className="relative overflow-hidden border-y border-line/50 py-4" style={{ background: 'rgb(var(--glass) / .45)' }} aria-label="Supported exercises">
        <div className="marquee gap-3">
          {[...names, ...names].map((n, i) => (
            <span key={i} className="chip whitespace-nowrap !text-sm"><span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-tide to-tide2" />{n}</span>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-bg to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-bg to-transparent" />
      </div>

      {/* ── Problem ── */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div data-reveal className="max-w-2xl">
          <p className="text-sm font-medium text-tide">The problem</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Most rehab happens where nobody can see it.</h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            ['Unobserved at home', 'Patients do prescribed exercises at home, where nobody sees how far the joint actually moves.', '01'],
            ['Progress judged by feel', 'Between clinic visits, “it feels a bit better” is often the only data point.', '02'],
            ['Sensors are a barrier', 'Wearables and motion-capture labs are expensive and rarely leave the clinic.', '03'],
          ].map(([t, b, n], i) => (
            <div key={t} data-reveal={i * 120} className="panel panel-hover p-6">
              <div className="font-display text-4xl text-gradient">{n}</div>
              <h3 className="mt-4 font-semibold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8">
        <div data-reveal className="text-center">
          <p className="text-sm font-medium text-tide">How RehabX works</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Six steps, running live while the patient moves.</h2>
        </div>
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(([t, b, icon], i) => (
            <li key={t} data-reveal={i * 90} className="panel panel-hover group relative overflow-hidden p-6">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-tide/20 to-tide2/10 blur-2xl transition-transform duration-500 group-hover:scale-150" aria-hidden="true" />
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-tide to-tide2 text-white shadow-lg shadow-tide/30 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 dark:text-[#04181b]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
                </span>
                <span className="tabular font-display text-3xl text-muted/40">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Features ── */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8">
        <div data-reveal className="max-w-2xl">
          <p className="text-sm font-medium text-tide">Features</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Built around what keeps patients doing their exercises.</h2>
          <p className="mt-3 text-muted">Home programmes fail when patients forget, lose motivation, or nobody sees what happened between visits.</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([t, b, g], i) => (
            <div key={t} data-reveal={i * 80} className="panel panel-hover p-6">
              <div className={`h-1.5 w-12 rounded-full bg-gradient-to-r ${g}`} />
              <h3 className="mt-5 font-semibold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Measurement + feedback ── */}
      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-2">
        <div data-reveal>
          <h2 className="text-3xl font-semibold tracking-tight">Movement analysis you can check</h2>
          <p className="mt-3 leading-relaxed text-muted">
            Every number is traceable to geometry. The knee angle is the angle at the knee between hip and ankle landmarks. A repetition only counts when the joint passes through a full cycle — rest, move, peak, return — with a dead-band that stops camera jitter from double-counting.
          </p>
          <dl className="mt-6 space-y-3 text-sm">
            {[
              ['Range of motion', 'Largest minus smallest angle observed in each repetition.'],
              ['Form quality', 'Share of frames that meet the exercise’s rules, plus whether the target angle was reached.'],
              ['Validation', 'If a different joint is moving than the one prescribed, RehabX says so instead of counting.'],
            ].map(([k, v]) => (
              <div key={k} className="panel grid grid-cols-[130px_1fr] gap-4 px-4 py-3">
                <dt className="font-medium">{k}</dt><dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div data-reveal={150} className="panel glow-border p-6 sm:p-8">
          <h3 className="text-lg font-semibold">Real-time feedback, kept short and safe</h3>
          <ul className="stagger mt-5 space-y-3 text-sm">
            {[['✓', 'text-ok bg-ok/10', 'Controlled movement'], ['✓', 'text-ok bg-ok/10', 'Knee alignment detected'], ['!', 'text-signal bg-signal/15', 'Try slightly greater extension'], ['×', 'text-alert bg-alert/10', 'Move your leg fully into view']].map(([i, c, t]) => (
              <li key={t} className="flex items-center gap-3 rounded-xl border border-line/60 bg-sunken/40 px-3 py-2.5">
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${c}`}>{i}</span>{t}
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
            RehabX never tells a patient to push harder. It reports whether the prescribed target was reached and reminds them to stop and contact their therapist if anything hurts.
          </p>
        </div>
      </section>

      {/* ── Tech ── */}
      <section id="tech" className="mx-auto grid max-w-6xl scroll-mt-20 gap-5 px-5 py-16 sm:px-8 md:grid-cols-2">
        <div data-reveal className="panel p-7">
          <h2 className="text-2xl font-semibold tracking-tight">Technology</h2>
          <p className="mt-3 leading-relaxed text-muted">
            MediaPipe Pose Landmarker runs on-device through WebAssembly and WebGL. Video frames never leave the browser; only session metrics are stored. The movement engine is configuration-driven, so a new exercise is a new configuration — not new code.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['React', 'TypeScript', 'MediaPipe', 'Supabase', 'Postgres RLS', 'Recharts', 'PWA'].map((t) => <span key={t} className="chip">{t}</span>)}
          </div>
        </div>
        <div data-reveal={120} className="panel p-7">
          <h2 className="text-2xl font-semibold tracking-tight">What comes next</h2>
          <ul className="mt-4 space-y-3 text-muted">
            {['Automatic exercise recognition with a trained sequence classifier', 'Therapist-set thresholds and targets per patient', 'Push reminders and two-way messaging', 'Clinical validation studies against goniometer measurements'].map((t) => (
              <li key={t} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-tide to-violet" />{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-6 sm:px-8">
        <div data-reveal className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-tide via-tide2 to-violet p-10 text-white shadow-2xl shadow-tide/30 sm:p-14">
          <div className="spin-slow absolute -right-24 -top-24 h-72 w-72 rounded-full border-[28px] border-white/10" aria-hidden="true" />
          <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <h2 className="relative max-w-xl font-display text-4xl leading-tight sm:text-5xl">Try it in 30 seconds — no camera needed.</h2>
          <p className="relative mt-3 max-w-lg text-white/85">Sign in with a demo account and pick “Demo simulation” to watch the full pipeline run on a synthetic patient.</p>
          <div className="relative mt-7 flex flex-wrap gap-3">
            <Link to="/login?role=patient" className="btn !bg-white !px-6 !py-3.5 font-semibold !text-[#0b3b3d] shadow-lg hover:!-translate-y-0.5">Open patient demo</Link>
            <Link to="/login?role=therapist" className="btn border border-white/40 !px-6 !py-3.5 text-white hover:bg-white/10">Open therapist demo</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line/50" style={{ background: 'rgb(var(--glass) / .5)' }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          <Logo />
          <div className="max-w-xl"><Disclaimer compact /></div>
        </div>
      </footer>
    </div>
  );
}
