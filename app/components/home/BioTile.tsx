import Link from "next/link";

const TAGS = ["coffee ☕", "skies ✦", "soft things"];

export function BioTile() {
  return (
    <Link
      href="/bio"
      className="lift rounded-lg bg-white border border-pink-100 shadow-soft p-5 flex items-center gap-4 hover:border-pink-200"
    >
      <div className="w-14 h-14 shrink-0 rounded-full bg-pink-100 border border-pink-200 flex items-center justify-center font-script text-pink-800 text-2xl">
        ✿
      </div>
      <div className="min-w-0">
        <div className="label text-pink-600">about</div>
        <div className="font-script text-pink-800 text-[24px] leading-tight">
          hi, i&apos;m here
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {TAGS.map((t) => (
            <span
              key={t}
              className="text-[11px] text-lavender-600 bg-lavender-50 border border-lavender-100 rounded-pill px-2 py-[2px] font-semibold"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
