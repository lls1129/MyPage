// Browser-side helpers for the direct-to-Storage upload flow.

import exifr from "exifr";

export async function readImageDimensions(
  file: File
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export type ParsedExif = {
  takenAt: string | null;
  width: number | null;
  height: number | null;
};

export async function parseExifInBrowser(file: File): Promise<ParsedExif> {
  try {
    const buffer = await file.arrayBuffer();
    const exif = await exifr.parse(buffer, {
      pick: [
        "DateTimeOriginal",
        "CreateDate",
        "ImageWidth",
        "ImageHeight",
        "ExifImageWidth",
        "ExifImageHeight",
        "PixelXDimension",
        "PixelYDimension",
      ],
    });
    const captureDate = exif?.DateTimeOriginal ?? exif?.CreateDate;
    const takenAt =
      captureDate instanceof Date ? captureDate.toISOString() : null;
    const width =
      exif?.ImageWidth ?? exif?.ExifImageWidth ?? exif?.PixelXDimension ?? null;
    const height =
      exif?.ImageHeight ?? exif?.ExifImageHeight ?? exif?.PixelYDimension ?? null;
    return { takenAt, width, height };
  } catch {
    return { takenAt: null, width: null, height: null };
  }
}

export function extension(name: string, fallback = "jpg"): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return (m?.[1] || fallback).toLowerCase();
}
