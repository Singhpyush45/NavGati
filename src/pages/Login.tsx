import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { homeFor, useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/UI/Logo';
import { Disclaimer, ErrorBox, Segmented } from '@/components/UI/primitives';
import { DEMO_ACCOUNTS } from '@/services/database/localDataService';
import { Aurora } from '@/components/FX/Aurora';
import { HeroDemo } from '@/components/PoseOverlay/HeroDemo';

export default function Login() {
  const { signIn, signUp, backend } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialRole = params.get('role') === 'therapist' ? 'THERAPIST' : 'PATIENT';
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [role, setRole] = useState<'PATIENT' | 'THERAPIST'>(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = mode === 'signin' ? await signIn(email, password) : await signUp({ name, email, password, role });
      navigate(params.get('next') ?? homeFor(u.role), { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (r: 'PATIENT' | 'THERAPIST') => {
    const acc = DEMO_ACCOUNTS.find((a) => a.role === r)!;
    setMode('signin');
    setEmail(acc.email);
    setPassword(acc.password);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <Aurora spotlight />
      <div className="flex flex-col justify-between px-5 py-8 sm:px-12" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))' }}>
        <Link to="/" aria-label="RehabX home"><Logo /></Link>
        <div className="panel page-enter mx-auto my-10 w-full max-w-md p-6 sm:p-8">
          <h1 className="text-3xl font-semibold tracking-tight">{mode === 'signin' ? 'Sign in' : 'Create an account'}</h1>
          <p className="mt-1 text-sm text-muted">{mode === 'signin' ? 'Patients and therapists use the same sign-in.' : 'Choose whether you are a patient or a therapist.'}</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <>
                <Segmented label="Account type" value={role} onChange={setRole}
                  options={[{ value: 'PATIENT', label: 'Patient' }, { value: 'THERAPIST', label: 'Therapist' }]} />
                <div>
                  <label className="label" htmlFor="name">Full name</label>
                  <input id="name" className="field" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </div>
              </>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" className="field" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" className="field" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
            </div>
            {error && <ErrorBox message={error} />}
            <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
          </form>

          <button className="mt-4 text-sm text-tide hover:underline" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}>
            {mode === 'signin' ? 'New to RehabX? Create an account' : 'Already have an account? Sign in'}
          </button>

          {backend === 'local' && (
            <div className="mt-6 rounded-xl border border-line/70 bg-sunken/50 p-4 text-sm">
              <p className="font-medium">Local demo accounts</p>
              <p className="mt-1 text-muted">Supabase isn’t configured, so accounts live in this browser (passwords are stored hashed).</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary !py-1.5" onClick={() => fillDemo('PATIENT')}>Fill demo patient</button>
                <button type="button" className="btn-secondary !py-1.5" onClick={() => fillDemo('THERAPIST')}>Fill demo therapist</button>
              </div>
            </div>
          )}
        </div>
        <Disclaimer compact />
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#062326] via-[#0a3a3e] to-[#1c1c4a] p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="absolute inset-0 opacity-70" aria-hidden="true"><div className="spin-slow absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full border-[40px] border-white/5" /></div>
        <div className="float relative mb-10 max-w-md overflow-hidden rounded-3xl shadow-2xl shadow-black/40 ring-1 ring-white/10"><HeroDemo /></div>
        <blockquote className="relative max-w-md font-display text-3xl leading-snug">
          Numbers from every session, not just the ones in the clinic.
        </blockquote>
        <p className="relative mt-4 max-w-md text-sm text-white/65">Measured with a normal camera. Video stays on your device — only the metrics are saved.</p>
      </div>
    </div>
  );
}
