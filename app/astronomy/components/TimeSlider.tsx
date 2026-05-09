"use client";

import { useState } from "react";
import type { SkyObject, SkySnapshot } from "@/lib/astronomy/sky";
import { SkyChart } from "./SkyChart";

const brightnessRank = { bright: 0, moderate: 1, dim: 2 } as const;

function sortVisible(objects: SkyObject[]): SkyObject[] {
  return objects
    .filter((o) => o.visible)
    .sort((a, b) => {
      if (a.kind === "sun" || a.kind === "moon") return -1;
      if (b.kind === "sun" || b.kind === "moon") return 1;
      const r = brightnessRank[a.brightness] - brightnessRank[b.brightness];
      if (r !== 0) return r;
      return a.name.localeCompare(b.name);
    });
}

function relativeLabel(minutes: number): string {
  if (Math.abs(minutes) < 15) return "now";
  const abs = Math.abs(minutes);
  const hours = Math.round((abs / 60) * 10) / 10;
  const unit = abs < 90 ? `${abs} min` : `${hours} hr`;
  return minutes < 0 ? `${unit} ago` : `in ${unit}`;
}

export function TimeSlider({
  snapshots,
  initialIndex,
}: {
  snapshots: SkySnapshot[];
  initialIndex: number;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const current = snapshots[idx];
  if (!current) return null;
  const visible = sortVisible(current.objects);
  const max = snapshots.length - 1;

  const startLabel = snapshots[0]?.label ?? "";
  const endLabel = snapshots[max]?.label ?? "";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <p className="label text-pink-200">at</p>
          <p className="font-script text-cream text-3xl leading-none mt-1">
            {current.label}
          </p>
          <p className="text-[11px] text-cream/60 font-semibold mt-0.5">
            {relativeLabel(current.minutesFromNow)}
          </p>
        </div>
        <p className="text-xs text-cream/60 font-semibold">
          ✦ {visible.length} object{visible.length === 1 ? "" : "s"} above the horizon
        </p>
      </div>

      <SkyChart objects={current.objects} />

      <div className="flex flex-col gap-2">
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={idx}
          onChange={(e) => setIdx(parseInt(e.target.value, 10))}
          aria-label="time of night"
          className="w-full accent-pink-200"
        />
        <div className="flex items-center justify-between text-[11px] text-cream/55 font-semibold">
          <span>{startLabel}</span>
          <button
            type="button"
            onClick={() => {
              // Snap to whichever snapshot is closest to "now" (smallest |minutesFromNow|).
              let best = 0;
              let bestDiff = Number.POSITIVE_INFINITY;
              snapshots.forEach((s, i) => {
                const d = Math.abs(s.minutesFromNow);
                if (d < bestDiff) {
                  bestDiff = d;
                  best = i;
                }
              });
              setIdx(best);
            }}
            className="rounded-pill px-2 py-0.5 text-[10px] uppercase tracking-wider bg-cream/10 border border-cream/20 hover:bg-cream/20 text-cream"
          >
            ↺ now
          </button>
          <span>{endLabel}</span>
        </div>
      </div>

      <div>
        <p className="label text-pink-200 mb-3">visible at this time</p>
        {visible.length === 0 ? (
          <p className="text-sm text-cream/70">nothing above the horizon — patience.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {visible.map((obj) => (
              <li key={obj.id}>
                <ObjectChip obj={obj} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ObjectChip({ obj }: { obj: SkyObject }) {
  const brightnessClasses: Record<SkyObject["brightness"], string> = {
    bright: "bg-amber-100/20 text-amber-100 border-amber-100/40",
    moderate: "bg-cream/10 text-cream border-cream/25",
    dim: "bg-cream/5 text-cream/60 border-cream/15",
  };
  const altLabel = `${Math.round(obj.altDeg)}° up`;
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-semibold border " +
        brightnessClasses[obj.brightness]
      }
    >
      <span className="capitalize">{obj.name}</span>
      <span className="text-[10px] opacity-70">· {altLabel}</span>
      <span className="text-[10px] opacity-60">{obj.brightness}</span>
    </span>
  );
}
