export function Weather() {
  // Phase 1 placeholder — Open-Meteo wiring lands when we add astronomy hub.
  return (
    <div className="lift bg-white border border-pink-100 rounded-lg p-5 shadow-soft">
      <div className="label text-pink-600">weather</div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="font-script text-pink-800 text-[32px] leading-none">
          68°
        </span>
        <span className="text-sm text-lavender-600 font-medium">/ partly cloudy</span>
      </div>
      <div className="text-xs text-lavender-600 mt-1 font-medium">santa clara, ca</div>
    </div>
  );
}
