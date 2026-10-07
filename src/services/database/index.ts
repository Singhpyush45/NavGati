import type { AuthService, DataService } from './types';
import { LocalAuthService, LocalDataService } from './localDataService';
import { createSupabase, SupabaseAuthService, SupabaseDataService } from './supabaseDataService';

export * from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Picks Supabase when configured; otherwise a local, browser-only backend. */
function createBackends(): { data: DataService; auth: AuthService } {
  if (url && key) {
    const sb = createSupabase(url, key);
    return { data: new SupabaseDataService(sb), auth: new SupabaseAuthService(sb) };
  }
  const data = new LocalDataService(window.localStorage);
  return { data, auth: new LocalAuthService(window.localStorage, data) };
}

export const backends = createBackends();
