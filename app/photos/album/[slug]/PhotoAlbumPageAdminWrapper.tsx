"use client";

import type { Album } from "@/lib/supabase/albums";
import {
  renamePhotoAlbum,
  deletePhotoAlbum,
} from "../../admin-actions";
import { AlbumPageAdmin } from "../../../components/AlbumPageAdmin";

function normalize(p: Promise<{ ok: boolean; error?: string }>) {
  return p.then((r) =>
    r.ok
      ? ({ ok: true } as const)
      : ({ ok: false, error: r.error ?? "failed" } as const)
  );
}

export function PhotoAlbumPageAdminWrapper({ album }: { album: Album }) {
  return (
    <AlbumPageAdmin
      album={album}
      uploadHref={`/admin/photos/upload?album=${encodeURIComponent(album.id)}`}
      parentHref="/photos"
      onRename={(id, name) => normalize(renamePhotoAlbum(id, name))}
      onDelete={(id) => normalize(deletePhotoAlbum(id))}
    />
  );
}
