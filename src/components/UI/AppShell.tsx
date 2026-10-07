import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Aurora } from '@/components/FX/Aurora';
import { Logo } from './Logo';
import { Badge } from './primitives';
import { setPrefs, usePrefs } from '@/utils/prefs';

const PATIENT_NAV = [
  { to: '/app', label: 'Today', icon: 'M3 12l9-8 9 8M5 10v10h14V10' },
  { to: '/exercises', label: 'Exercises', icon: 'M6 20l6-14 6 10M4 20h16' },
  { to: '/progress', label: 'Progress', icon: 'M4 18l5-6 4 3 7-9' },
  { to: '/history', label: 'History', icon: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { to: '/settings', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12h2M3 12h2M12 3v2M12 19v2' },
];
const THERAPIST_NAV = [
  { to: '/therapist', label: 'Patients', icon: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21c1-4 4-6 8-6s7 2 8 6' },
  { to: '/exercises', label: 'Exercises', icon: 'M6 20l6-14 6 10M4 20h16' },
  { to: '/settings', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12h2M3 12h2M12 3v2M12 19v2' },
];

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

export function AppShell() {
  const { user, signOut, backend } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const nav = user?.role === 'PATIENT' ? PATIENT_NAV : THERAPIST_NAV;
  const immersive = loc.pathname === '/live';
  const prefs = usePrefs();
  const isDark = document.documentElement.classList.contains('dark');
  const toggleTheme = () => setPrefs({ theme: isDark ? 'light' : 'dark' });
  const themeBtn = (
    <button onClick={toggleTheme} className="grid h-8 w-8 place-items-center rounded-full border border-line/70 text-muted transition-all hover:rotate-12 hover:text-ink" aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'} data-theme={prefs.theme}>
      {isDark ? '☀' : '☾'}
    </button>
  );
  const initials = (user?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <Aurora />
      <aside className="hidden p-3 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="panel flex h-full flex-col">
          <div className="flex items-center justify-between px-5 py-5"><Logo />{themeBtn}</div>
          <nav className="flex-1 space-y-1 px-3" aria-label="Main">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/app' || n.to === '/therapist'}
                className={({ isActive }) => `group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ${isActive ? 'font-medium text-white shadow-lg shadow-tide/30 dark:text-[#04181b]' : 'text-muted hover:translate-x-1 hover:text-ink'}`}>
                {({ isActive }) => (
                  <>
                    <span className={`absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-tide to-tide2 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-10'}`} />
                    <Icon d={n.icon} />{n.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="m-3 rounded-xl border border-line/70 bg-sunken/50 p-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-tide to-violet text-xs font-semibold text-white">{initials}</span>
              <div className="min-w-0">
                <div className="truncate font-medium">{user?.name}</div>
                <div className="text-xs text-muted">{user?.role === 'PATIENT' ? `Patient ${user.patientCode ?? ''}` : user?.role === 'THERAPIST' ? 'Therapist' : 'Admin'}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              {backend === 'local' ? <Badge>Local mode</Badge> : <Badge tone="tide">Cloud</Badge>}
              <button className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline" onClick={async () => { await signOut(); navigate('/'); }}>Sign out</button>
            </div>
          </div>
        </div>
      </aside>

      <div className={`flex min-h-screen flex-col ${immersive ? 'pb-4' : 'pb-28'} lg:pb-0`}>
        <header className="app-header sticky top-0 z-20 flex items-center justify-between border-b border-line/60 px-4 py-3 backdrop-blur-xl lg:hidden"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', background: 'rgb(var(--glass) / .7)' }}>
          <Logo />
          <span className="flex items-center gap-2">{themeBtn}
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-tide to-violet text-[11px] font-semibold text-white" title={user?.name}>{initials}</span></span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {/* key → replays the entrance animation on every route change */}
          <div key={loc.pathname} className="page-enter"><Outlet /></div>
        </main>
      </div>

      {!immersive && (
        <nav aria-label="Main" className="fixed inset-x-3 z-30 lg:hidden" style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="panel flex justify-around !rounded-2xl p-1.5">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/app' || n.to === '/therapist'}
                className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] transition-all duration-300 ${isActive ? 'bg-gradient-to-br from-tide to-tide2 font-medium text-white shadow-md shadow-tide/30 dark:text-[#04181b]' : 'text-muted active:scale-95'}`}>
                <Icon d={n.icon} size={20} />{n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
