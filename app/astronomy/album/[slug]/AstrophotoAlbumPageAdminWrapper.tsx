"use client";

import type { Album } from "@/lib/supabase/albums";
import {
  renameAstrophotoAlbum,
  deleteAstrophotoAlbum,
  setAstrophotoAlbumCover,
  setAstrophotoAlbumCoverCrop,
  setAstrophotoAlbumCoverDecorations,
  setAstrophotoAlbumCoverHistory,
  setAstrophotoAlbumCoverOverlays,
  setAstrophotoAlbumHidden,
  setAstrophotoAlbumTitlePlacement,
  setAstrophotoAlbumTitleStyle,
  setAllAstrophotoAlbumsTitle,
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
  allAlbums,
}: {
  album: Album;
  coverCandidates: { id: string; image_url: string }[];
  allAlbums: Album[];
}) {
  return (
    <AlbumPageAdmin
      album={album}
      parentHref="/astronomy"
      libraryKind="astrophotos"
      coverCandidates={coverCandidates}
      allAlbums={allAlbums}
      onRename={(id, name) => normalize(renameAstrophotoAlbum(id, name))}
      onDelete={(id) => normalize(deleteAstrophotoAlbum(id))}
      onSetCover={(id, url) => normalize(setAstrophotoAlbumCover(id, url))}
      onSetCoverCrop={(id, crop) =>
        normalize(setAstrophotoAlbumCoverCrop(id, crop))
      }
      onSetCoverHistory={(id, entries) =>
        normalize(setAstrophotoAlbumCoverHistory(id, entries))
      }
      onSetCoverDecorations={(id, patch) =>
        normalize(setAstrophotoAlbumCoverDecorations(id, patch))
      }
      onSetCoverOverlays={(id, overlays) =>
        normalize(setAstrophotoAlbumCoverOverlays(id, overlays))
      }
      onSetTitlePlacement={(id, placement) =>
        normalize(setAstrophotoAlbumTitlePlacement(id, placement))
      }
      onSetTitleStyle={(id, style) =>
        normalize(setAstrophotoAlbumTitleStyle(id, style))
      }
      onSetAllTitle={(placement, style) =>
        normalize(setAllAstrophotoAlbumsTitle(placement, style))
      }
      onSetHidden={(id, hidden) =>
        normalize(setAstrophotoAlbumHidden(id, hidden))
      }
    />
  );
}
