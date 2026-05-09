import type { SkyObject } from "@/lib/astronomy/sky";

// Stereographic-ish projection: zenith at center, horizon at edge.
// North up, East left (looking up at the dome convention).
function project(altDeg: number, azDeg: number, radius: number) {
  const r = ((90 - altDeg) / 90) * radius;
  const azRad = (azDeg * Math.PI) / 180;
  // X is mirrored so East ends up on the LEFT (planisphere convention).
  return {
    x: -r * Math.sin(azRad),
    y: -r * Math.cos(azRad),
  };
}

function dotFor(kind: SkyObject["kind"]) {
  switch (kind) {
    case "sun":
      return { fill: "#FAC775", stroke: "#EF9F27", r: 6 };
    case "moon":
      return { fill: "#FFFAF3", stroke: "#CECBF6", r: 5 };
    case "planet":
      return { fill: "#F4C0D1", stroke: "#993556", r: 4 };
    case "star":
      return { fill: "#FFFFFF", stroke: "#AFA9EC", r: 2.5 };
  }
}

export function SkyChart({ objects }: { objects: SkyObject[] }) {
  const SIZE = 360;
  const RADIUS = 160;
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const visible = objects.filter((o) => o.visible);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full max-w-[440px] mx-auto block"
      role="img"
      aria-label="sky chart"
    >
      {/* Outer horizon ring */}
      <circle cx={cx} cy={cy} r={RADIUS} fill="#0F0D2E" stroke="#534AB7" strokeWidth="1" />

      {/* Altitude rings (60° / 30°) */}
      <circle
        cx={cx}
        cy={cy}
        r={(RADIUS * 60) / 90}
        fill="none"
        stroke="#26215C"
        strokeWidth="0.5"
        strokeDasharray="2 4"
      />
      <circle
        cx={cx}
        cy={cy}
        r={(RADIUS * 30) / 90}
        fill="none"
        stroke="#26215C"
        strokeWidth="0.5"
        strokeDasharray="2 4"
      />

      {/* Cardinal direction labels (N up, E left, S down, W right) */}
      <text x={cx} y={cy - RADIUS - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#CECBF6" letterSpacing="0.1em">
        N
      </text>
      <text x={cx - RADIUS - 6} y={cy + 4} textAnchor="end" fontSize="11" fontWeight="700" fill="#CECBF6" letterSpacing="0.1em">
        E
      </text>
      <text x={cx} y={cy + RADIUS + 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#CECBF6" letterSpacing="0.1em">
        S
      </text>
      <text x={cx + RADIUS + 6} y={cy + 4} textAnchor="start" fontSize="11" fontWeight="700" fill="#CECBF6" letterSpacing="0.1em">
        W
      </text>

      {/* Decorative star sparkles for atmosphere */}
      {[
        [22, 30],
        [78, 34],
        [40, 70],
        [62, 75],
        [50, 18],
        [30, 88],
      ].map(([px, py], i) => (
        <circle
          key={`bg-${i}`}
          cx={(px / 100) * SIZE}
          cy={(py / 100) * SIZE}
          r={0.7}
          fill="#FFFFFF"
          opacity={0.45}
        />
      ))}

      {/* Plot objects above horizon */}
      {visible.map((obj) => {
        const { x, y } = project(obj.altDeg, obj.azDeg, RADIUS);
        const style = dotFor(obj.kind);
        // Star labels only for stars/planets; sun/moon use larger glyphs.
        const showLabel = obj.kind !== "star" || obj.brightness === "bright";
        return (
          <g key={obj.id} transform={`translate(${cx + x} ${cy + y})`}>
            <circle r={style.r + 2} fill={style.fill} opacity="0.18" />
            <circle r={style.r} fill={style.fill} stroke={style.stroke} strokeWidth="0.8" />
            {showLabel ? (
              <text
                x={style.r + 4}
                y={3}
                fontSize="9"
                fontWeight="600"
                fill="#FFFAF3"
                opacity="0.85"
              >
                {obj.name}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
