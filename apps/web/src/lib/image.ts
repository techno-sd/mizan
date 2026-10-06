// Shrink a screenshot in the browser before upload: text stays readable at 1,800 px, and the request stays small.
const MAX_SIDE = 1800;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function shrinkImage(file: File): Promise<{ media_type: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.fillStyle = "#fff"; // transparent PNGs: keep dark text readable
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.88);
  return { media_type: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}

// The first image in a paste or drop, if any.
export function imageFrom(items: DataTransferItemList | null | undefined): File | null {
  for (const item of Array.from(items ?? [])) {
    if (item.kind === "file" && IMAGE_TYPES.includes(item.type)) return item.getAsFile();
  }
  return null;
}
