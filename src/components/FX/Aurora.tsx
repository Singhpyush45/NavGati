import { useEffect } from 'react';

/** Animated aurora background: drifting colour blobs, a fading grid and film grain. */
export function Aurora({ spotlight = false }: { spotlight?: boolean }) {
  useEffect(() => {
    if (!spotlight || window.matchMedia('(pointer: coarse)').matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--mx', `${e.clientX}px`);
        document.documentElement.style.setProperty('--my', `${e.clientY}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  }, [spotlight]);

  return (
    <>
      <div className="aurora" aria-hidden="true">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" /><div className="blob b4" />
        <div className="grid" /><div className="noise" />
      </div>
      {spotlight && <div className="spotlight" aria-hidden="true" />}
    </>
  );
}
