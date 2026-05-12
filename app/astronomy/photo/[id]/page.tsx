import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "../../../components/PageShell";
import { getAstrophoto, type Astrophoto } from "@/lib/supabase/astrophotos";
import { listAlbums } from "@/lib/supabase/albums";
import { getCurrentAdmin } from "@/lib/supabase/server";
import { AdminBar } from "./AdminBar";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/astronomy/photo/[id]">
): Promise<Metadata> {
  const { id } = await props.params;
  const result = await getAstrophoto(id);
  if (result.kind !== "ok") return { title: "astrophoto · my world" };
  const name = result.astrophoto.object_name || "astrophoto";
  return {
    title: `${name} · my world`,
    description: result.astrophoto.caption || `astrophoto of ${name}`,
  };
}

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

const TECH_FIELDS: { key: keyof Astrophoto; label: string }[] = [
  { key: "telescope", label: "telescope" },
  { key: "mount", label: "mount" },
  { key: "camera", label: "camera" },
  { key: "exposure_stack", label: "exposure" },
  { key: "processing", label: "processing" },
  { key: "location", label: "location" },
];

export default async function AstrophotoDetailPage(
  props: PageProps<"/astronomy/photo/[id]">
) {
  const { id } = await props.params;
  const result = await getAstrophoto(id);

  if (result.kind === "not-found") notFound();
  if (result.kind === "schema-missing" || result.kind === "unconfigured") {
    return (
      <PageShell>
        <section className="max-w-[640px] mx-auto w-full mt-6">
          <p className="text-sm text-ink/80">astrophoto storage isn&apos;t set up yet.</p>
        </section>
      </PageShell>
    );
  }
  if (result.kind === "error") {
    return (
      <PageShell>
        <section className="max-w-[640px] mx-auto w-full mt-6">
          <p className="font-mono text-sm text-pink-600">{result.message}</p>
        </section>
      </PageShell>
    );
  }

  const photo = result.astrophoto;
  const date = formatDate(photo.taken_at) ?? formatDate(photo.created_at);
  const techRows = TECH_FIELDS.filter((f) => Boolean(photo[f.key]));
  const admin = await getCurrentAdmin();
  const albums = admin ? await listAlbums("astrophotos") : [];

  return (
    <PageShell>
      <article className="max-w-[960px] mx-auto w-full">
        <Link
          href="/astronomy"
          className="text-xs font-semibold text-pink-600 hover:text-pink-800"
        >
          ← back to astronomy
        </Link>

        {admin ? (
          <div className="mt-3">
            <AdminBar photo={photo} albums={albums} />
          </div>
        ) : null}

        <div className="rounded-lg overflow-hidden border border-skynavy-500 shadow-soft mt-3 bg-skynavy-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.image_url}
            alt={photo.object_name || photo.caption || "astrophoto"}
            style={
              photo.rotation
                ? { transform: `rotate(${photo.rotation}deg)` }
                : undefined
            }
            className="w-full h-auto block transition-transform"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
          <header>
            <p className="label text-lavender-600">astrophoto ✦</p>
            <h1 className="font-script text-pink-600 text-[40px] md:text-[52px] leading-none mt-2">
              {photo.object_name || "untitled"}
            </h1>
            {date ? (
              <p className="text-xs text-lavender-600 font-semibold mt-3 tracking-wide">
                captured {date}
              </p>
            ) : null}
            {photo.caption ? (
              <p className="font-serif text-ink/85 text-[16px] leading-[1.7] mt-4">
                {photo.caption}
              </p>
            ) : null}
          </header>

          {techRows.length > 0 ? (
            <aside className="rounded-lg bg-white border border-pink-100 shadow-soft p-5 self-start">
              <p className="label text-pink-600 mb-3">capture details</p>
              <dl className="text-sm flex flex-col gap-3">
                {techRows.map((f) => (
                  <div key={f.key} className="flex flex-col gap-0.5">
                    <dt className="text-[11px] uppercase tracking-wider text-lavender-600 font-semibold">
                      {f.label}
                    </dt>
                    <dd className="text-ink/90 font-mono text-[13px] break-words">
                      {photo[f.key] as string}
                    </dd>
                  </div>
                ))}
              </dl>
            </aside>
          ) : null}
        </div>
      </article>
    </PageShell>
  );
}
