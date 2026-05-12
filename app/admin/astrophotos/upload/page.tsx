import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../../../components/PageShell";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { listAlbums } from "@/lib/supabase/albums";
import { UploadForm } from "./UploadForm";

export const metadata: Metadata = {
  title: "upload astrophoto · my world",
};

export const dynamic = "force-dynamic";

export default async function UploadAstrophotoPage(
  props: PageProps<"/admin/astrophotos/upload">
) {
  const params = await props.searchParams;
  const error = typeof params?.error === "string" ? params.error : undefined;
  const status = typeof params?.status === "string" ? params.status : undefined;

  const albumParam =
    typeof params?.album === "string" ? params.album : undefined;

  const adminReady = isAdminConfigured();
  const albums = adminReady ? await listAlbums("astrophotos") : [];
  const initialAlbumId = albums.some((a) => a.id === albumParam)
    ? albumParam!
    : "";

  return (
    <PageShell>
      <section className="max-w-[680px] mx-auto w-full">
        <Link
          href="/admin"
          className="text-xs font-semibold text-pink-600 hover:text-pink-800"
        >
          ← admin home
        </Link>

        <header className="mt-3">
          <p className="label text-lavender-600">admin · astronomy ✦</p>
          <h1 className="font-script text-pink-600 text-[40px] md:text-[48px] leading-none mt-1">
            upload an astrophoto
          </h1>
          <p className="text-sm text-ink/80 mt-3">
            with the technical metadata so the detail view actually means
            something. capture date is read from EXIF when present.
          </p>
        </header>

        {adminReady ? (
          status === "ok" ? (
            <UploadSuccess />
          ) : (
            <UploadForm
              initialError={error}
              albums={albums}
              initialAlbumId={initialAlbumId}
            />
          )
        ) : (
          <div className="mt-6 rounded-lg bg-white border border-pink-100 shadow-soft p-6">
            <p className="label text-lavender-600">setup ✦</p>
            <h2 className="font-script text-pink-600 text-3xl mt-1">
              one more env var
            </h2>
            <p className="text-sm text-ink/80 mt-3">
              set{" "}
              <code className="font-mono bg-pink-50 px-1.5 rounded text-xs">
                SUPABASE_SERVICE_ROLE_KEY
              </code>{" "}
              on this server, then reload.
            </p>
          </div>
        )}
      </section>
    </PageShell>
  );
}

function UploadSuccess() {
  return (
    <div className="mt-6 rounded-lg bg-white border border-pink-100 shadow-soft p-8 text-center flex flex-col items-center gap-4">
      <p className="font-script text-pink-600 text-[40px] leading-none">
        uploaded ✦
      </p>
      <p className="text-sm text-ink/80 max-w-prose">
        your astrophoto is live in{" "}
        <Link
          href="/astronomy"
          className="text-pink-600 underline decoration-pink-200 underline-offset-2 hover:decoration-pink-400 font-semibold"
        >
          /astronomy
        </Link>
        .
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
        <Link
          href="/admin/astrophotos/upload"
          className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-4 py-2 text-sm font-semibold"
        >
          upload another →
        </Link>
        <Link
          href="/astronomy"
          className="lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-4 py-2 text-sm font-semibold"
        >
          view album
        </Link>
      </div>
    </div>
  );
}
