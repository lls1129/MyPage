"use client";

import type { Album } from "@/lib/supabase/albums";
import {
  renamePhotoAlbum,
  deletePhotoAlbum,
  setPhotoAlbumCover,
  setPhotoAlbumCoverCrop,
  setPhotoAlbumCoverDecorations,
  setPhotoAlbumCoverHistory,
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
  allAlbums,
}: {
  album: Album;
  coverCandidates: { id: string; image_url: string }[];
  allAlbums: Album[];
}) {
  return (
    <AlbumPageAdmin
      album={album}
      parentHref="/photos"
      libraryKind="photos"
      coverCandidates={coverCandidates}
      allAlbums={allAlbums}
      onRename={(id, name) => normalize(renamePhotoAlbum(id, name))}
      onDelete={(id) => normalize(deletePhotoAlbum(id))}
      onSetCover={(id, url) => normalize(setPhotoAlbumCover(id, url))}
      onSetCoverCrop={(id, crop) =>
        normalize(setPhotoAlbumCoverCrop(id, crop))
      }
      onSetCoverHistory={(id, entries) =>
        normalize(setPhotoAlbumCoverHistory(id, entries))
      }
      onSetCoverDecorations={(id, patch) =>
        normalize(setPhotoAlbumCoverDecorations(id, patch))
      }
      onSetHidden={(id, hidden) => normalize(setPhotoAlbumHidden(id, hidden))}
    />
  );
}
