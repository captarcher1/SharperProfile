// Headshot content validation for wizard Step 2 (B3). Per B3 edge case 3:
// "Validate actual file content, not just the extension/MIME the browser
// reports" — a file can claim to be a .png and not actually be a decodable
// image (corrupted, renamed, or a non-image binary). This checks real magic
// bytes rather than trusting `file.type` or the filename extension.
export type AcceptedImageMime = "image/jpeg" | "image/png" | "image/webp";

/**
 * Returns the detected mime type if `buffer` starts with a recognized
 * JPEG/PNG/WebP signature, or null if it doesn't match any of the three
 * accepted formats (A7) — including a file with a matching extension but
 * corrupted/non-image content.
 */
export function detectImageMime(buffer: Buffer): AcceptedImageMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= pngSignature.length && pngSignature.every((byte, i) => buffer[i] === byte)) {
    return "image/png";
  }

  // WebP: "RIFF" (bytes 0-3), 4 bytes of chunk size, then "WEBP" (bytes 8-11).
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}
