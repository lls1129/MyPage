import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "../../../components/PageShell";
import {
  listPhotos,
  listAllPhotosAsAdmin,
} from "@/lib/supabase/photos";
import { getAlbumBySlug, listAlbums } from "@/lib/supabase/albums";
import { getCurrentAdmin } from "@/lib/supabase/server";
import { PhotoGrid } from "../../PhotoGrid";
import { PhotoAlbumPageAdminWrapper } from "./PhotoAlbumPageAdminWrapper";

export const metadata: Metadata = {
  title: "album · photos · my world",
};

export const dynamic = "force-dynamic";

export default async function PhotoAlbumPage(
  props: PageProps<"/photos/album/[slug]">
) {
  const params = await props.params;
  const slug = params.slug;
  const admin = await getCurrentAdmin();
  const isAdmin = Boolean(admin);
  // Admin still needs to load hidden albums so they can unhide them.
  const album = await getAlbumBySlug("photos", slug, isAdmin);
  if (!album) notFound();

  const [result, allAlbums] = await Promise.all([
    isAdmin ? listAllPhotosAsAdmin() : listPhotos(),
    listAlbums("photos", isAdmin),
  ]);
  const photos =
    result.kind === "ok"
      ? result.photos.filter((p) => p.album_id === album.id)
      : [];

  return (
    <PageShell>
      <header className="mt-2">
        <Link
          href="/photos"
          className="label text-lavender-600 hover:underline"
        >
          ← all photos
        </Link>
        <h1 className="font-script text-pink-600 text-[40px] md:text-[48px] leading-none mt-2">
          {album.name}
        </h1>
        <p className="text-ink/80 text-sm mt-3 max-w-prose">
          {photos.length} photo{photos.length === 1 ? "" : "s"} in this album.
        </p>
      </header>

      {isAdmin ? (
        <PhotoAlbumPageAdminWrapper
          album={album}
          coverCandidates={photos.map((p) => ({
            id: p.id,
            image_url: p.image_url,
          }))}
          allAlbums={allAlbums}
        />
      ) : null}

      {photos.length > 0 ? (
        <PhotoGrid
          photos={photos}
          isAdmin={isAdmin}
          albums={allAlbums}
          albumId={album.id}
        />
      ) : (
        <div className="mt-6 rounded-lg bg-white border border-pink-100 shadow-soft p-8 text-center">
          <p className="font-script text-pink-600 text-3xl">
            no photos here yet ✿
          </p>
          {isAdmin ? (
            <p className="text-sm text-ink/80 mt-3">
              upload one directly into this album from{" "}
              <Link
                href={`/admin/photos/upload?album=${encodeURIComponent(
                  album.id
                )}`}
                className="underline"
              >
                the upload page
              </Link>
              , or assign existing photos from the edit modal on{" "}
              <Link href="/photos" className="underline">
                the main photo page
              </Link>
              .
            </p>
          ) : (
            <p className="text-sm text-ink/80 mt-3">
              new photos land here soon ✦
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}
