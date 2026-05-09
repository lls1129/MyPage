import Link from "next/link";
import type { Astrophoto } from "@/lib/supabase/astrophotos";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function quickDetail(p: Astrophoto): string {
  const parts: string[] = [];
  if (p.exposure_stack) parts.push(p.exposure_stack);
  else if (p.telescope) parts.push(p.telescope);
  if (p.camera && parts.length < 1) parts.push(p.camera);
  return parts.join(" · ");
}

export function AstrophotoGrid({ astrophotos }: { astrophotos: Astrophoto[] }) {
  if (astrophotos.length === 0) {
    return (
      <div className="rounded-lg bg-white border border-pink-100 shadow-soft p-8 text-center">
        <p className="font-script text-pink-600 text-3xl">no astrophotos yet ✦</p>
        <p className="text-sm text-ink/80 mt-3">
          upload your first one from{" "}
          <Link
            href="/admin/astrophotos/upload"
            className="text-pink-600 underline decoration-pink-200 underline-offset-2 hover:decoration-pink-400 font-semibold"
          >
            admin
          </Link>{" "}
          and it&apos;ll show up here with full equipment metadata.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {astrophotos.map((p) => {
        const date = formatDate(p.taken_at) ?? formatDate(p.created_at);
        const detail = quickDetail(p);
        return (
          <li key={p.id}>
            <Link
              href={`/astronomy/photo/${p.id}`}
              className="lift block rounded-lg overflow-hidden border border-skynavy-500 shadow-soft hover:border-pink-200 bg-white"
            >
              <div className="aspect-[4/3] bg-skynavy-900 relative overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image_url}
                  alt={p.object_name || p.caption || "astrophoto"}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <p className="font-script text-pink-800 text-xl leading-tight">
                  {p.object_name || "untitled"}
                </p>
                <p className="text-xs text-lavender-600 font-semibold mt-1">
                  {date ?? "—"}
                </p>
                {detail ? (
                  <p className="text-[11px] text-ink/70 font-mono mt-2 truncate">
                    {detail}
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
