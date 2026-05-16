"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { extension } from "@/lib/upload-utils";
import { signPhotoUpload } from "@/app/admin/photos/upload/actions";
import type { Pet } from "@/lib/supabase/pets";
import {
  createPet,
  updatePet,
  deletePet,
  setPetHidden,
  setPetImage,
} from "./actions";

// Grid of pet cards — admin gets add / edit / hide / delete chips
// per card, visitors get a read-only view. Single photo per pet for
// the MVP; a per-pet photo gallery is a future extension.
export function PetsGrid({
  pets,
  isAdmin,
}: {
  pets: Pet[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addingOpen, setAddingOpen] = useState(false);

  function runAction(
    fn: () => Promise<{ ok: boolean; error?: string }>
  ) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? "action failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 mt-6">
      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAddingOpen((v) => !v)}
            className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-3.5 py-1.5 text-sm font-semibold"
          >
            {addingOpen ? "× close" : "+ add a pet"}
          </button>
          {error ? (
            <span className="text-xs text-pink-600 font-semibold">
              {error}
            </span>
          ) : null}
        </div>
      ) : null}

      {addingOpen && isAdmin ? (
        <NewPetForm
          onCancel={() => setAddingOpen(false)}
          onCreated={() => {
            setAddingOpen(false);
            router.refresh();
          }}
        />
      ) : null}

      {pets.length === 0 && !addingOpen ? (
        <p className="text-sm text-lavender-600 text-center mt-4">
          {isAdmin
            ? "no pets yet ♡ tap + add a pet to get started."
            : "no pets to show yet ♡"}
        </p>
      ) : null}

      <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {pets.map((pet) => (
          <PetCard
            key={pet.id}
            pet={pet}
            isAdmin={isAdmin}
            busy={pending}
            onHideToggle={() =>
              runAction(() => setPetHidden(pet.id, !pet.hidden))
            }
            onDelete={() => {
              if (!window.confirm(`Delete ${pet.name}? This can be undone in the database.`))
                return;
              runAction(() => deletePet(pet.id));
            }}
            onUpdate={(patch) => runAction(() => updatePet({ id: pet.id, ...patch }))}
            onImage={(url) =>
              runAction(() => setPetImage({ id: pet.id, imageUrl: url }))
            }
          />
        ))}
      </ul>
    </div>
  );
}

function NewPetForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("name is required");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const r = await createPet({ name, breed, notes });
      if (!r.ok) {
        setError(r.error ?? "couldn't create");
        return;
      }
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-md bg-white border border-pink-100 shadow-soft p-3"
    >
      <p className="label text-pink-600">new pet</p>
      <input
        type="text"
        placeholder="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={pending}
        autoFocus
        className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200"
      />
      <input
        type="text"
        placeholder="breed (optional)"
        value={breed}
        onChange={(e) => setBreed(e.target.value)}
        disabled={pending}
        className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200"
      />
      <textarea
        placeholder="notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={pending}
        rows={3}
        className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200 resize-y"
      />
      {error ? (
        <p className="text-xs text-pink-600 font-semibold">{error}</p>
      ) : null}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-pink-300 text-white border border-pink-300 hover:bg-pink-400 hover:border-pink-400 px-3 py-1 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "saving…" : "add pet"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-3 py-1 text-sm font-semibold disabled:opacity-60"
        >
          cancel
        </button>
      </div>
    </form>
  );
}

function PetCard({
  pet,
  isAdmin,
  busy,
  onHideToggle,
  onDelete,
  onUpdate,
  onImage,
}: {
  pet: Pet;
  isAdmin: boolean;
  busy: boolean;
  onHideToggle: () => void;
  onDelete: () => void;
  onUpdate: (patch: {
    name?: string;
    breed?: string | null;
    notes?: string | null;
  }) => void;
  onImage: (url: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pet.name);
  const [breed, setBreed] = useState(pet.breed ?? "");
  const [notes, setNotes] = useState(pet.notes ?? "");

  function saveEdits() {
    onUpdate({ name, breed, notes });
    setEditing(false);
  }

  return (
    <li
      className={
        "flex flex-col rounded-lg bg-white border shadow-soft overflow-hidden lift " +
        (pet.hidden
          ? "border-lavender-200 ring-2 ring-lavender-100"
          : "border-pink-100")
      }
    >
      <div className="aspect-[4/3] relative bg-gradient-to-br from-pink-50 to-lavender-100 overflow-hidden">
        {pet.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pet.image_url}
            alt={pet.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-script text-pink-400/85 text-6xl drop-shadow-sm">
            ♡
          </span>
        )}
        {pet.hidden ? (
          <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide font-bold rounded-pill bg-lavender-100 text-lavender-800 px-2 py-0.5 border border-lavender-200">
            hidden
          </span>
        ) : null}
        {isAdmin ? (
          <div className="absolute bottom-2 right-2">
            <PetImageButton
              petId={pet.id}
              hasImage={!!pet.image_url}
              onUploaded={(url) => onImage(url)}
              onCleared={() => onImage(null)}
              disabled={busy}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 p-4 flex-1">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-pink-50 border border-pink-100 rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-pink-200"
            />
            <input
              type="text"
              placeholder="breed"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              className="bg-pink-50 border border-pink-100 rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-pink-200"
            />
            <textarea
              placeholder="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="bg-pink-50 border border-pink-100 rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-pink-200 resize-y"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={saveEdits}
                disabled={busy || !name.trim()}
                className="rounded-pill bg-pink-300 text-white border border-pink-300 hover:bg-pink-400 hover:border-pink-400 px-3 py-0.5 text-[11px] font-semibold disabled:opacity-60"
              >
                save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(pet.name);
                  setBreed(pet.breed ?? "");
                  setNotes(pet.notes ?? "");
                }}
                className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-3 py-0.5 text-[11px] font-semibold"
              >
                cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="font-script text-pink-800 text-2xl leading-tight">
              {pet.name}
            </p>
            {pet.breed ? (
              <p className="text-[12px] text-lavender-600 font-semibold">
                {pet.breed}
              </p>
            ) : null}
            {pet.notes ? (
              <p className="text-sm text-ink/80 whitespace-pre-wrap leading-snug">
                {pet.notes}
              </p>
            ) : null}
          </>
        )}

        {isAdmin && !editing ? (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={busy}
              className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
            >
              ✎ edit
            </button>
            <button
              type="button"
              onClick={onHideToggle}
              disabled={busy}
              className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
            >
              {pet.hidden ? "○ show" : "◐ hide"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="rounded-pill bg-pink-100/70 text-pink-700 border border-pink-200 hover:bg-pink-200 hover:text-pink-800 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
            >
              ✕ delete
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function PetImageButton({
  petId,
  hasImage,
  onUploaded,
  onCleared,
  disabled,
}: {
  petId: string;
  hasImage: boolean;
  onUploaded: (url: string) => void;
  onCleared: () => void;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("file must be an image.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const sign = await signPhotoUpload(extension(file.name));
      if (!sign.ok) throw new Error(sign.error);
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("photos")
        .uploadToSignedUrl(sign.path, sign.token, file, {
          contentType: file.type,
        });
      if (upErr) throw new Error(upErr.message);
      onUploaded(sign.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <label
        className={
          "cursor-pointer rounded-pill bg-cream/90 text-pink-800 border border-pink-200 hover:border-pink-400 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm " +
          (disabled || pending ? "opacity-60 cursor-wait" : "")
        }
      >
        {pending ? "uploading…" : hasImage ? "✎ replace" : "+ photo"}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          disabled={disabled || pending}
          className="sr-only"
        />
      </label>
      {hasImage ? (
        <button
          type="button"
          onClick={onCleared}
          disabled={disabled || pending}
          title="clear photo"
          aria-label="clear photo"
          className="rounded-pill bg-cream/90 text-pink-700 border border-pink-200 hover:border-pink-400 px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm disabled:opacity-60"
        >
          ✕
        </button>
      ) : null}
      {error ? (
        <span
          role="alert"
          className="absolute -top-7 right-0 rounded-pill bg-pink-400 text-white px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
