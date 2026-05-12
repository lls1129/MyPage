"use client";

import type { Album } from "@/lib/supabase/albums";
import { AlbumManager } from "../../components/AlbumManager";
import {
  createAstrophotoAlbum,
  renameAstrophotoAlbum,
  deleteAstrophotoAlbum,
} from "../admin-actions";

function normalize(p: Promise<{ ok: boolean; error?: string }>) {
  return p.then((r) =>
    r.ok ? ({ ok: true } as const) : ({ ok: false, error: r.error ?? "failed" } as const)
  );
}

export function AstrophotoAlbumAdmin({ existing }: { existing: Album[] }) {
  return (
    <AlbumManager
      existing={existing}
      noun="astrophoto album"
      placeholder="e.g., m31 attempts"
      onCreate={(name) => normalize(createAstrophotoAlbum(name))}
      onRename={(id, name) => normalize(renameAstrophotoAlbum(id, name))}
      onDelete={(id) => normalize(deleteAstrophotoAlbum(id))}
    />
  );
}
