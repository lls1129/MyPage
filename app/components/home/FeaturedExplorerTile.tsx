import Link from "next/link";

export function FeaturedExplorerTile() {
  return (
    <Link
      href="/explore"
      className="lift relative col-span-1 row-span-2 md:col-span-2 md:row-span-2 aspect-[4/3] md:aspect-auto rounded-lg overflow-hidden border-2 border-white shadow-soft bg-skynavy-700 text-cream block"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 30% 20%, #26215C 0%, #1A1740 55%, #0F0D2E 100%)",
      }}
    >
      {/* starfield */}
      <Stars />

      {/* corner deco */}
      <span className="absolute top-4 left-5 font-script text-cream/70 text-lg">✦</span>
      <span className="absolute top-4 right-5 font-script text-cream/70 text-xl">✿</span>

      <div className="relative h-full flex items-center justify-center p-6">
        <Planet />
      </div>

      <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between gap-4">
        <div>
          <div className="label text-pink-200">3d explorer</div>
          <div className="font-script text-cream text-[28px] md:text-[32px] leading-tight mt-1">
            earth + moon, drop a pin ✦
          </div>
        </div>
        <span className="hidden sm:inline text-cream/80 text-sm font-semibold whitespace-nowrap">
          enter →
        </span>
      </div>
    </Link>
  );
}

function Planet() {
  return (
    <svg
      viewBox="0 0 240 240"
      className="w-[55%] max-w-[260px] aspect-square drop-shadow-[0_10px_40px_rgba(126,109,209,0.45)]"
      aria-hidden
    >
      <defs>
        <radialGradient id="earthGrad" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#AFA9EC" />
          <stop offset="40%" stopColor="#7F77DD" />
          <stop offset="100%" stopColor="#3C3489" />
        </radialGradient>
        <radialGradient id="atmoGrad" cx="50%" cy="50%" r="55%">
          <stop offset="80%" stopColor="rgba(244,192,209,0)" />
          <stop offset="100%" stopColor="rgba(244,192,209,0.45)" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="120" r="92" fill="url(#earthGrad)" />
      {/* stylized continents */}
      <g fill="#FBEAF0" opacity="0.85">
        <path d="M65 100 q12 -18 30 -10 q15 6 8 22 q-6 14 -22 12 q-18 -2 -16 -24z" />
        <path d="M118 78 q14 -6 22 6 q5 10 -3 16 q-10 8 -22 4 q-10 -3 -8 -14 q1 -8 11 -12z" />
        <path d="M150 142 q18 -8 26 8 q5 14 -10 22 q-18 8 -26 -6 q-6 -14 10 -24z" />
        <path d="M85 152 q14 -6 22 6 q4 10 -8 18 q-12 8 -22 -2 q-8 -10 8 -22z" />
      </g>
      {/* atmosphere ring */}
      <circle cx="120" cy="120" r="100" fill="url(#atmoGrad)" />
      {/* moon */}
      <g transform="translate(186 60)">
        <circle r="20" fill="#FFFAF3" opacity="0.95" />
        <circle r="20" fill="#1A1740" opacity="0.18" />
        <circle cx="-5" cy="-3" r="3" fill="#1A1740" opacity="0.18" />
        <circle cx="6" cy="5" r="2" fill="#1A1740" opacity="0.18" />
      </g>
    </svg>
  );
}

function Stars() {
  // deterministic so SSR + client render match
  const stars = [
    [12, 18, 1.2], [80, 12, 0.8], [22, 70, 0.9], [55, 88, 1.1],
    [88, 60, 1.0], [40, 34, 0.7], [70, 42, 0.6], [16, 50, 0.8],
    [62, 22, 0.9], [92, 80, 1.1], [50, 14, 0.7], [33, 92, 1.0],
    [78, 76, 0.8], [8, 86, 0.9], [96, 30, 0.7], [30, 56, 0.6],
  ];
  return (
    <div className="absolute inset-0" aria-hidden>
      {stars.map(([x, y, r], i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white/70"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${r}px`,
            height: `${r}px`,
          }}
        />
      ))}
    </div>
  );
}
