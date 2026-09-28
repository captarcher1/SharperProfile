// Used as a fallback avatar/logo when no image is configured, per the
// plan's graceful-fallback requirement — a fresh fork should never show a
// broken image.
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}
