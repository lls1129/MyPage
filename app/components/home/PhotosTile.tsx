import Link from "next/link";

const SWATCHES = [
  "bg-pink-100",
  "bg-lavender-100",
  "bg-amber-100",
  "bg-pink-200",
];

export function PhotosTile() {
  return (
    <Link
      href="/photos"
      className="lift col-span-3 row-span-1 md:col-span-1 md:row-span-2 rounded-lg bg-white border border-pink-100 shadow-soft p-6 flex flex-col gap-4 hover:border-pink-200"
    >
      <div className="flex items-baseline justify-between">
        <span className="label text-pink-600">photos</span>
        <span className="text-xs text-lavender-600 font-semibold">128</span>
      </div>
      <div className="font-script text-pink-800 text-[28px] leading-none">
        little moments ❤
      </div>
      <div className="grid grid-cols-2 gap-2 mt-auto">
        {SWATCHES.map((c, i) => (
          <div
            key={i}
            className={`${c} aspect-square rounded-sm border border-white/60`}
          />
        ))}
      </div>
      <div className="text-xs text-pink-600 font-semibold">browse the album →</div>
    </Link>
  );
}
