"use client";

import type { Album } from "@/lib/supabase/albums";
import { AlbumManager } from "../components/AlbumManager";
import {
  createPhotoAlbum,
  renamePhotoAlbum,
  deletePhotoAlbum,
  setPhotoAlbumHidden,
} from "./admin-actions";

// Server actions return { ok, error?: string } variants; the AlbumManager
// expects { ok: true } | { ok: false; error }. Normalize here so the
// generic component doesn't have to special-case.
function normalize(p: Promise<{ ok: boolean; error?: string }>) {
  return p.then((r) =>
    r.ok ? ({ ok: true } as const) : ({ ok: false, error: r.error ?? "failed" } as const)
  );
}

export function AlbumAdmin({ existing }: { existing: Album[] }) {
  return (
    <AlbumManager
      existing={existing}
      noun="album"
      placeholder="e.g., grand canyon trip"
      onCreate={(name) => normalize(createPhotoAlbum(name))}
      onRename={(id, name) => normalize(renamePhotoAlbum(id, name))}
      onDelete={(id) => normalize(deletePhotoAlbum(id))}
      onSetHidden={(id, hidden) => normalize(setPhotoAlbumHidden(id, hidden))}
    />
  );
}
