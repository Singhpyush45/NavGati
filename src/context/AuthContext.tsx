import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppUser, Role } from '@/types';
import { backends } from '@/services/database';

interface AuthCtx {
  user: AppUser | null;
  loading: boolean;
  backend: 'supabase' | 'local';
  signIn(email: string, password: string): Promise<AppUser>;
  signUp(i: { name: string; email: string; password: string; role: Exclude<Role, 'ADMIN'> }): Promise<AppUser>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    backends.auth.currentUser().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await backends.auth.signIn(email, password);
    setUser(u);
    return u;
  }, []);
  const signUp = useCallback(async (i: Parameters<AuthCtx['signUp']>[0]) => {
    const u = await backends.auth.signUp(i);
    setUser(u);
    return u;
  }, []);
  const signOut = useCallback(async () => {
    await backends.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, backend: backends.auth.backend, signIn, signUp, signOut }), [user, loading, signIn, signUp, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}

export const homeFor = (role: Role) => (role === 'PATIENT' ? '/app' : '/therapist');
