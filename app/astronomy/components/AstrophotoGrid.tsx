"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Astrophoto } from "@/lib/supabase/astrophotos";
import { AstrophotoEditModal } from "./AstrophotoEditModal";
import {
  toggleAstrophotoHidden,
  rotateAstrophoto,
  deleteAstrophoto,
} from "../admin-actions";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function quickDetail(p: Astrophoto): string {
  const parts: string[] = [];
  if (p.exposure_stack) parts.push(p.exposure_stack);
  else if (p.telescope) parts.push(p.telescope);
  if (p.camera && parts.length < 1) parts.push(p.camera);
  return parts.join(" · ");
}

function rotationStyle(rotation: number | null | undefined) {
  if (!rotation) return undefined;
  return { transform: `rotate(${rotation}deg)` };
}

export function AstrophotoGrid({
  astrophotos,
  isAdmin,
}: {
  astrophotos: Astrophoto[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<Astrophoto | null>(null);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const visible = useMemo(
    () => (isAdmin && showHidden ? astrophotos : astrophotos.filter((p) => !p.hidden)),
    [astrophotos, isAdmin, showHidden]
  );

  const hiddenCount = useMemo(
    () => astrophotos.filter((p) => p.hidden).length,
    [astrophotos]
  );

  function runAction(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setActionError(null);
      const result = await fn();
      if (!result.ok) {
        setActionError(result.error ?? "Action failed.");
        return;
      }
      router.refresh();
    });
  }

  function onToggleHidden(p: Astrophoto) {
    runAction(() => toggleAstrophotoHidden(p.id, !p.hidden));
  }
  function onRotateLeft(p: Astrophoto) {
    runAction(() => rotateAstrophoto(p.id, "left"));
  }
  function onRotateRight(p: Astrophoto) {
    runAction(() => rotateAstrophoto(p.id, "right"));
  }
  function onDelete(p: Astrophoto) {
    if (!confirm(`Delete this astrophoto? "${p.object_name || "untitled"}"`)) return;
    runAction(() => deleteAstrophoto(p.id));
  }

  if (astrophotos.length === 0) {
    return (
      <div className="rounded-lg bg-white border border-pink-100 shadow-soft p-8 text-center">
        <p className="font-script text-pink-600 text-3xl">no astrophotos yet ✦</p>
        <p className="text-sm text-ink/80 mt-3">
          {isAdmin ? (
            <>
              upload your first one from{" "}
              <Link
                href="/admin/astrophotos/upload"
                className="text-pink-600 underline decoration-pink-200 underline-offset-2 hover:decoration-pink-400 font-semibold"
              >
                admin
              </Link>
              .
            </>
          ) : (
            <>check back when there&apos;s something to look at.</>
          )}
        </p>
      </div>
    );
  }

  return (
    <>
      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Link
            href="/admin/astrophotos/upload"
            className="lift inline-flex items-center rounded-pill px-3.5 py-1.5 text-sm font-semibold bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400"
          >
            + upload astrophoto
          </Link>
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              aria-pressed={showHidden}
              className={
                "lift inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm font-semibold border " +
                (showHidden
                  ? "bg-lavender-100 text-lavender-800 border-lavender-200"
                  : "bg-white text-lavender-600 border-pink-100 hover:border-pink-200")
              }
            >
              {showHidden ? "✓ showing hidden" : "show hidden"}
              <span className="text-[11px] bg-lavender-50 text-lavender-600 rounded-full px-1.5">
                {hiddenCount}
              </span>
            </button>
          ) : null}
          {actionError ? (
            <span className="text-xs text-pink-600 font-semibold">{actionError}</span>
          ) : null}
        </div>
      ) : null}

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visible.map((p) => {
          const date = formatDate(p.taken_at) ?? formatDate(p.created_at);
          const detail = quickDetail(p);
          return (
            <li key={p.id}>
              <div
                className={
                  "group relative rounded-lg overflow-hidden border shadow-soft lift bg-white " +
                  (p.hidden
                    ? "border-lavender-200 ring-2 ring-lavender-100"
                    : "border-skynavy-500 hover:border-pink-200")
                }
              >
                <Link
                  href={`/astronomy/photo/${p.id}`}
                  className="block"
                  aria-label={`open ${p.object_name || "astrophoto"}`}
                >
                  <div className="aspect-[4/3] bg-skynavy-900 relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image_url}
                      alt={p.object_name || p.caption || "astrophoto"}
                      loading="lazy"
                      style={rotationStyle(p.rotation)}
                      className={
                        "absolute inset-0 w-full h-full object-cover transition-transform " +
                        (p.hidden ? "opacity-60" : "")
                      }
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-script text-pink-800 text-xl leading-tight">
                      {p.object_name || "untitled"}
                    </p>
                    <p className="text-xs text-lavender-600 font-semibold mt-1">
                      {date ?? "—"}
                    </p>
                    {detail ? (
                      <p className="text-[11px] text-ink/70 font-mono mt-2 truncate">
                        {detail}
                      </p>
                    ) : null}
                  </div>
                </Link>

                {p.hidden ? (
                  <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide font-bold rounded-pill bg-lavender-100 text-lavender-800 px-2 py-0.5 border border-lavender-200">
                    hidden
                  </span>
                ) : null}

                {isAdmin ? (
                  <div className="absolute top-2 right-2 flex flex-wrap items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <IconBtn label="rotate left" onClick={() => onRotateLeft(p)} disabled={pending}>
                      ↶
                    </IconBtn>
                    <IconBtn label="rotate right" onClick={() => onRotateRight(p)} disabled={pending}>
                      ↷
                    </IconBtn>
                    <IconBtn label="edit" onClick={() => setEditing(p)} disabled={pending}>
                      ✎
                    </IconBtn>
                    <IconBtn
                      label={p.hidden ? "show" : "hide"}
                      onClick={() => onToggleHidden(p)}
                      disabled={pending}
                    >
                      {p.hidden ? "○" : "◐"}
                    </IconBtn>
                    <IconBtn label="delete" onClick={() => onDelete(p)} disabled={pending} danger>
                      ✕
                    </IconBtn>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {editing ? (
        <AstrophotoEditModal photo={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        "w-7 h-7 rounded-full text-sm font-semibold backdrop-blur bg-cream/85 border shadow-soft hover:bg-cream flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-wait " +
        (danger
          ? "text-pink-800 border-pink-200 hover:border-pink-400"
          : "text-pink-700 border-pink-100 hover:border-pink-200")
      }
    >
      {children}
    </button>
  );
}
