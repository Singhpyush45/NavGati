import { useSyncExternalStore } from 'react';
import type { SidePreference } from '@/types';

export interface Prefs {
  theme: 'light' | 'dark' | 'system';
  defaultSide: SidePreference;
  defaultTargetReps: number;
  showReferenceValues: boolean;
  voiceFeedback: boolean;
}

const KEY = 'rehabx:prefs';
const DEFAULTS: Prefs = { theme: 'system', defaultSide: 'auto', defaultTargetReps: 12, showReferenceValues: false, voiceFeedback: false };
const listeners = new Set<() => void>();

let cache: Prefs = load();
function load(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function getPrefs(): Prefs { return cache; }

export function setPrefs(patch: Partial<Prefs>) {
  cache = { ...cache, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage disabled */ }
  applyTheme();
  listeners.forEach((l) => l());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, getPrefs);
}

export function applyTheme() {
  const dark = cache.theme === 'dark' || (cache.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  window.dispatchEvent(new Event('rehabx-theme'));
}
