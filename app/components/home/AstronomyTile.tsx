import Link from "next/link";

export function AstronomyTile() {
  return (
    <Link
      href="/astronomy"
      className="lift rounded-lg bg-white border border-pink-100 shadow-soft p-5 flex items-center gap-4 hover:border-pink-200"
    >
      <MoonDisk />
      <div className="min-w-0">
        <div className="label text-pink-600">tonight&apos;s sky</div>
        <div className="font-script text-pink-800 text-[24px] leading-tight">
          waxing gibbous
        </div>
        <div className="text-xs text-lavender-600 font-medium mt-1">
          mars rises 9:14pm · 12% clouds
        </div>
      </div>
    </Link>
  );
}

function MoonDisk() {
  return (
    <svg viewBox="0 0 64 64" className="w-14 h-14 shrink-0" aria-hidden>
      <defs>
        <linearGradient id="moonHalf" x1="0" x2="1" y1="0" y2="0">
          <stop offset="50%" stopColor="#FFFAF3" />
          <stop offset="50%" stopColor="#26215C" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#moonHalf)" stroke="#F4C0D1" strokeWidth="1.5" />
      <circle cx="22" cy="26" r="2" fill="#1A1740" opacity="0.2" />
      <circle cx="38" cy="40" r="3" fill="#FFFAF3" opacity="0.25" />
    </svg>
  );
}
