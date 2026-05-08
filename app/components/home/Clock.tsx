"use client";

import { useEffect, useState } from "react";

function format(now: Date) {
  const time = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const tz = new Intl.DateTimeFormat([], { timeZoneName: "short" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value ?? "";
  return { time, tz };
}

export function Clock() {
  // Render a placeholder on first paint so SSR + first-client-render match,
  // then upgrade to live time after hydration.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const display = now ? format(now) : { time: "--:--", tz: "" };

  return (
    <div className="lift bg-white border border-pink-100 rounded-lg p-5 shadow-soft">
      <div className="label text-pink-600">local time</div>
      <div className="font-script text-pink-800 text-[32px] leading-none mt-2">
        {display.time}
      </div>
      <div className="text-xs text-lavender-600 mt-1 font-medium">
        {display.tz || " "}
      </div>
    </div>
  );
}
