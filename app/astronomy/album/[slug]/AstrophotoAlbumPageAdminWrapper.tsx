"use client";

import type { Album } from "@/lib/supabase/albums";
import {
  renameAstrophotoAlbum,
  deleteAstrophotoAlbum,
  setAstrophotoAlbumCover,
  setAstrophotoAlbumCoverCrop,
  setAstrophotoAlbumHidden,
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
  coverCandidates,
}: {
  album: Album;
  coverCandidates: { id: string; image_url: string }[];
}) {
  return (
    <AlbumPageAdmin
      album={album}
      parentHref="/astronomy"
      coverCandidates={coverCandidates}
      onRename={(id, name) => normalize(renameAstrophotoAlbum(id, name))}
      onDelete={(id) => normalize(deleteAstrophotoAlbum(id))}
      onSetCover={(id, url) => normalize(setAstrophotoAlbumCover(id, url))}
      onSetCoverCrop={(id, crop) =>
        normalize(setAstrophotoAlbumCoverCrop(id, crop))
      }
      onSetHidden={(id, hidden) =>
        normalize(setAstrophotoAlbumHidden(id, hidden))
      }
    />
  );
}
