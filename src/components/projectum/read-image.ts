"use client";

// Uploaded images, redrawn in the browser as JPEG data URLs small enough for
// localStorage. Transparent areas come out white. A file that cannot be
// decoded rejects, and so does a thumbnail too large even at its smallest.

import { MAX_THUMBNAIL } from "@/lib/projects";

async function withImage<T>(file: File, draw: (img: HTMLImageElement) => T): Promise<T> {
  const url = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    img.src = url;
    await img.decode();
    return draw(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function whiteCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

// A project thumbnail: no wider or taller than 800px, stepping down in size
// and quality until it fits, so a phone photo fits in browser storage.
export function readThumbnail(file: File): Promise<string> {
  return withImage(file, (img) => {
    const w = img.naturalWidth || 800;
    const h = img.naturalHeight || 450;
    for (const [edge, quality] of [
      [800, 0.82],
      [800, 0.65],
      [480, 0.6],
    ] as const) {
      const scale = Math.min(1, edge / Math.max(w, h));
      const { canvas, ctx } = whiteCanvas(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL("image/jpeg", quality);
      if (out.length <= MAX_THUMBNAIL) return out;
    }
    throw new Error("too large");
  });
}

// A profile picture: the centre square of the image, 256px across.
const AVATAR_SIZE = 256;

export function readAvatar(file: File): Promise<string> {
  return withImage(file, (img) => {
    const w = img.naturalWidth || AVATAR_SIZE;
    const h = img.naturalHeight || AVATAR_SIZE;
    const side = Math.min(w, h);
    const { canvas, ctx } = whiteCanvas(AVATAR_SIZE, AVATAR_SIZE);
    ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return canvas.toDataURL("image/jpeg", 0.85);
  });
}
