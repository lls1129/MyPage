"use client";

import type { Album } from "@/lib/supabase/albums";
import {
  renamePhotoAlbum,
  deletePhotoAlbum,
  setPhotoAlbumCover,
  setPhotoAlbumCoverCrop,
  setPhotoAlbumHidden,
} from "../../admin-actions";
import { AlbumPageAdmin } from "../../../components/AlbumPageAdmin";

function normalize(p: Promise<{ ok: boolean; error?: string }>) {
  return p.then((r) =>
    r.ok
      ? ({ ok: true } as const)
      : ({ ok: false, error: r.error ?? "failed" } as const)
  );
}

export function PhotoAlbumPageAdminWrapper({
  album,
  coverCandidates,
}: {
  album: Album;
  coverCandidates: { id: string; image_url: string }[];
}) {
  return (
    <AlbumPageAdmin
      album={album}
      parentHref="/photos"
      libraryKind="photos"
      coverCandidates={coverCandidates}
      onRename={(id, name) => normalize(renamePhotoAlbum(id, name))}
      onDelete={(id) => normalize(deletePhotoAlbum(id))}
      onSetCover={(id, url) => normalize(setPhotoAlbumCover(id, url))}
      onSetCoverCrop={(id, crop) =>
        normalize(setPhotoAlbumCoverCrop(id, crop))
      }
      onSetHidden={(id, hidden) => normalize(setPhotoAlbumHidden(id, hidden))}
    />
  );
}
