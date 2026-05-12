"use client";

import type { Album } from "@/lib/supabase/albums";
import {
  renameAstrophotoAlbum,
  deleteAstrophotoAlbum,
} from "../../admin-actions";
import { AlbumPageAdmin } from "../../../components/AlbumPageAdmin";

function normalize(p: Promise<{ ok: boolean; error?: string }>) {
  return p.then((r) =>
    r.ok
      ? ({ ok: true } as const)
      : ({ ok: false, error: r.error ?? "failed" } as const)
  );
}

export function AstrophotoAlbumPageAdminWrapper({
  album,
}: {
  album: Album;
}) {
  return (
    <AlbumPageAdmin
      album={album}
      parentHref="/astronomy"
      onRename={(id, name) => normalize(renameAstrophotoAlbum(id, name))}
      onDelete={(id) => normalize(deleteAstrophotoAlbum(id))}
    />
  );
}
