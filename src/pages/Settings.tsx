import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { backends } from '@/services/database';
import { setPrefs, usePrefs } from '@/utils/prefs';
import { Badge, Disclaimer, PageHeader, Panel, Segmented } from '@/components/UI/primitives';

function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="text-sm"><span className="font-medium">{label}</span><span className="block text-muted">{hint}</span></label>
      <button id={id} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-tide' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

export default function Settings() {
  const prefs = usePrefs();
  const { user, signOut, backend } = useAuth();
  const navigate = useNavigate();
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  type InstallEvt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
  const getEvt = () => (window as unknown as { __navgatiInstall?: InstallEvt }).__navgatiInstall ?? null;
  const [installEvt, setInstallEvt] = useState<InstallEvt | null>(getEvt);
  useEffect(() => {
    const h = () => setInstallEvt(getEvt());
    window.addEventListener('navgati-installable', h);
    return () => window.removeEventListener('navgati-installable', h);
  }, []);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const install = async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    await installEvt.userChoice.catch(() => null);
    (window as unknown as { __navgatiInstall?: Event }).__navgatiInstall = undefined;
    setInstallEvt(null);
  };

  const reset = async () => {
    if (!window.confirm('Restore the synthetic demo data? Sessions you recorded in this browser will be removed.')) return;
    try {
      await backends.data.resetDemoData();
      setResetMsg('Demo data restored.');
    } catch (e) {
      setResetMsg((e as Error).message);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle={`${user?.name} · ${user?.email}`} />
      <div className="stagger space-y-6">

      <Panel className="space-y-5 p-6">
        <h2 className="font-semibold">Display</h2>
        <div>
          <span className="label">Theme</span>
          <Segmented label="Theme" value={prefs.theme} onChange={(theme) => setPrefs({ theme })}
            options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </div>
        <Toggle id="ref" checked={prefs.showReferenceValues} onChange={(v) => setPrefs({ showReferenceValues: v })}
          label="Show reference ROM values on charts" hint="Illustrative reference lines only. They are not personal targets — your therapist sets those." />
      </Panel>

      {user?.role === 'PATIENT' && (
        <Panel className="space-y-5 p-6">
          <h2 className="font-semibold">Exercise defaults</h2>
          <div className="flex flex-wrap gap-6">
            <div>
              <span className="label">Default side</span>
              <Segmented label="Default side" value={prefs.defaultSide} onChange={(defaultSide) => setPrefs({ defaultSide })}
                options={[{ value: 'auto', label: 'Auto' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />
            </div>
            <div>
              <label className="label" htmlFor="reps">Default prescribed reps</label>
              <input id="reps" type="number" min={1} max={50} className="field !w-24" value={prefs.defaultTargetReps}
                onChange={(e) => setPrefs({ defaultTargetReps: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} />
            </div>
          </div>
          <Toggle id="voice" checked={prefs.voiceFeedback} onChange={(v) => setPrefs({ voiceFeedback: v })}
            label="Speak repetition count" hint="Uses your browser’s built-in speech. Nothing is sent anywhere." />
        </Panel>
      )}

      <Panel className="space-y-3 p-6">
        <h2 className="font-semibold">Install on your phone</h2>
        {standalone ? (
          <p className="text-sm text-muted">NavGati is installed and running as an app. ✓</p>
        ) : installEvt ? (
          <>
            <p className="text-sm text-muted">Add NavGati to your home screen — it opens full-screen like a normal app and loads faster.</p>
            <button className="btn-primary" onClick={install}>Install NavGati</button>
          </>
        ) : ios ? (
          <p className="text-sm text-muted">In Safari, tap the <span className="font-medium text-ink">Share</span> button, then <span className="font-medium text-ink">Add to Home Screen</span>.</p>
        ) : (
          <p className="text-sm text-muted">Open your browser menu and choose <span className="font-medium text-ink">Install app</span> or <span className="font-medium text-ink">Add to Home screen</span>.</p>
        )}
      </Panel>

      <Panel className="space-y-3 p-6">
        <h2 className="font-semibold">Privacy</h2>
        <p className="text-sm text-muted">
          Camera video is processed in your browser by the pose model and is never recorded or uploaded. Only session metrics
          (angles, range of motion, repetition counts, form scores and observed deviations) are stored. Raw video storage is not
          implemented in this prototype and would require explicit, separate consent.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Data storage:</span>
          {backend === 'supabase' ? <Badge tone="tide">Supabase (secure cloud database)</Badge> : <Badge tone="signal">This browser only (local demo backend)</Badge>}
        </div>
      </Panel>

      <Panel className="space-y-4 p-6">
        <h2 className="font-semibold">Account</h2>
        <div className="flex flex-wrap gap-2">
          {backend === 'local' && <button className="btn-secondary" onClick={reset}>Restore demo data</button>}
          <button className="btn-secondary" onClick={async () => { await signOut(); navigate('/'); }}>Sign out</button>
        </div>
        {resetMsg && <p className="text-sm text-muted" role="status">{resetMsg}</p>}
      </Panel>
      </div>
      <Disclaimer compact />
    </div>
  );
}
