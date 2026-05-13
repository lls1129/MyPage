import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "../../../components/PageShell";
import {
  listAstrophotos,
  listAllAstrophotosAsAdmin,
} from "@/lib/supabase/astrophotos";
import { getAlbumBySlug, listAlbums } from "@/lib/supabase/albums";
import { getCurrentAdmin } from "@/lib/supabase/server";
import { AstrophotoGrid } from "../../components/AstrophotoGrid";
import { AstrophotoAlbumPageAdminWrapper } from "./AstrophotoAlbumPageAdminWrapper";

export const metadata: Metadata = {
  title: "album · astrophotos · my world",
};

export const dynamic = "force-dynamic";

export default async function AstrophotoAlbumPage(
  props: PageProps<"/astronomy/album/[slug]">
) {
  const params = await props.params;
  const slug = params.slug;
  const admin = await getCurrentAdmin();
  const isAdmin = Boolean(admin);
  // Admin still needs to load hidden albums so they can unhide them.
  const album = await getAlbumBySlug("astrophotos", slug, isAdmin);
  if (!album) notFound();

  const [result, allAlbums] = await Promise.all([
    isAdmin ? listAllAstrophotosAsAdmin() : listAstrophotos(),
    listAlbums("astrophotos", isAdmin),
  ]);
  const astrophotos =
    result.kind === "ok"
      ? result.astrophotos.filter((a) => a.album_id === album.id)
      : [];

  return (
    <PageShell>
      <header className="mt-2">
        <Link
          href="/astronomy"
          className="label text-lavender-600 hover:underline"
        >
          ← astronomy
        </Link>
        <h1 className="font-script text-pink-600 text-[40px] md:text-[48px] leading-none mt-2">
          {album.name}
        </h1>
        <p className="text-ink/80 text-sm mt-3 max-w-prose">
          {astrophotos.length} astrophoto
          {astrophotos.length === 1 ? "" : "s"} in this album.
        </p>
      </header>

      {isAdmin ? (
        <AstrophotoAlbumPageAdminWrapper
          album={album}
          coverCandidates={astrophotos.map((a) => ({
            id: a.id,
            image_url: a.image_url,
          }))}
          allAlbums={allAlbums}
        />
      ) : null}

      {astrophotos.length > 0 ? (
        <AstrophotoGrid
          astrophotos={astrophotos}
          isAdmin={isAdmin}
          albums={allAlbums}
          albumId={album.id}
        />
      ) : (
        <div className="mt-6 rounded-lg bg-white border border-pink-100 shadow-soft p-8 text-center">
          <p className="font-script text-pink-600 text-3xl">
            no astrophotos here yet ✦
          </p>
          {isAdmin ? (
            <p className="text-sm text-ink/80 mt-3">
              upload one directly into this album from{" "}
              <Link
                href={`/admin/astrophotos/upload?album=${encodeURIComponent(
                  album.id
                )}`}
                className="underline"
              >
                the upload page
              </Link>
              , or assign existing astrophotos from the edit modal on{" "}
              <Link href="/astronomy" className="underline">
                the astronomy page
              </Link>
              .
            </p>
          ) : (
            <p className="text-sm text-ink/80 mt-3">
              new captures arriving soon ✦
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}
