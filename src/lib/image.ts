/**
 * Preparing a picture to live inside an encrypted journal.
 *
 * The reflection is stored on the student's device and encrypted with
 * everything else, so an image has to travel with it as a data URL rather than
 * as a file reference — a photo kept outside the vault would be the one part of
 * their diary sitting in the clear.
 *
 * That makes size the whole problem. A phone photo is several megabytes of
 * base64 and localStorage is a few megabytes in total, so anything coming in is
 * downscaled and re-encoded first. JPEG for photographs; PNG only for images
 * that have transparency to lose.
 */

/** Longest edge, in pixels. Enough to fill the column on a retina screen. */
const MAX_EDGE = 1600;
const QUALITY = 0.82;

/** Past this a single picture would crowd out the journal it belongs to. */
const MAX_BYTES = 1_500_000;

export interface PreparedImage {
  src: string;
  width: number;
  height: number;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That is not an image.");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Transparency is the only reason to pay PNG's size; everything else is a
  // photograph, where JPEG is several times smaller at the same quality.
  const transparent = file.type === "image/png" || file.type === "image/webp";
  let src = canvas.toDataURL(transparent ? "image/png" : "image/jpeg", QUALITY);

  // A screenshot saved as PNG can still be large. Fall back to JPEG rather
  // than refuse it — losing transparency beats losing the picture.
  if (src.length > MAX_BYTES && transparent) {
    src = canvas.toDataURL("image/jpeg", QUALITY);
  }

  if (src.length > MAX_BYTES) {
    throw new Error("That image is too large even after shrinking. Try a smaller one.");
  }

  return { src, width, height };
}
