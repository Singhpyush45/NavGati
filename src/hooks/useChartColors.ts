import { useEffect, useState } from 'react';

const read = () => {
  const s = getComputedStyle(document.documentElement);
  const c = (v: string) => `rgb(${s.getPropertyValue(v).trim().split(/\s+/).join(',')})`;
  return { tide: c('--tide'), tide2: c('--tide-2'), violet: c('--violet'), signal: c('--signal'), muted: c('--muted'), line: c('--line'), ink: c('--ink'), surface: c('--surface'), ok: c('--ok'), alert: c('--alert') };
};

/** Resolves CSS theme tokens into concrete colors for SVG charts (re-reads on theme change). */
export function useChartColors() {
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const h = () => setColors(read());
    window.addEventListener('navgati-theme', h);
    return () => window.removeEventListener('navgati-theme', h);
  }, []);
  return colors;
}
