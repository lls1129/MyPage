// Pull the bucket + object key out of a public Supabase Storage URL,
// regardless of which bucket the file actually lives in. Pattern:
// https://<project>.supabase.co/storage/v1/object/public/<bucket>/<key>
//
// Useful when the row's "home" bucket can change (e.g. converting a row
// between /photos and /astronomy without moving the file in storage).

export type StorageRef = { bucket: string; key: string };

export function storageRefFromUrl(url: string): StorageRef | null {
  const m = /\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(?:\?|$)/.exec(url);
  if (!m) return null;
  return { bucket: m[1], key: decodeURIComponent(m[2]) };
}
