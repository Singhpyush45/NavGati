/** The RehabX mark: a limb bent at a joint, with the measured angle in amber. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-tide" />
      <path d="M8 24 L16 10 L24 20" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.2 15 A4 4 0 0 1 18.6 14.4" stroke="#E8B04B" strokeWidth="2" fill="none" />
      <circle cx="16" cy="10" r="2.2" fill="#E8B04B" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">RehabX</span>
    </span>
  );
}
