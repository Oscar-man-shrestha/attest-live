/** Client-side resize so PNG/JPG/WebP stay under the campus image cap (5 MB). */
const TARGET_BYTES = 4.2 * 1024 * 1024;

export async function resizeImage(file: File, maxEdge = 1600): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Use PNG, JPG, or WebP (phone HEIC photos need converting first)");
  }
  if (!["image/png", "image/jpeg", "image/webp", "image/jpg"].includes(file.type)) {
    throw new Error("Use PNG, JPG, or WebP (phone HEIC photos need converting first)");
  }
  if (file.size <= TARGET_BYTES) return file;

  const bitmap = await createImageBitmap(file);
  let edge = maxEdge;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);

    let quality = 0.85;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    while (blob && blob.size > TARGET_BYTES && quality > 0.45) {
      quality -= 0.1;
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    }
    if (blob && blob.size <= TARGET_BYTES) break;
    edge = Math.round(edge * 0.75);
  }

  bitmap.close();
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}
