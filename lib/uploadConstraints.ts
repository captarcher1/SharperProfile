// Résumé-upload constraints for wizard Step 1 (B4).
// Grounded in wizard-phase1-spec-by-example.md:
//   - Accepted formats: .docx / .pdf only — matches src/parseFile.ts's own
//     UNSUPPORTED_FORMAT throw condition exactly (D5). Not a wizard-level
//     opinion; the pipeline itself only knows how to handle these two.
//   - Max size: 5MB (A10, confirmed 2026-09-06) — deliberately matches B3's
//     headshot cap, so the wizard has one consistent upload-size rule
//     instead of two different numbers to remember.
export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5MB

export const ACCEPTED_RESUME_EXTENSIONS = [".docx", ".pdf"] as const;

export type AcceptedResumeExtension = (typeof ACCEPTED_RESUME_EXTENSIONS)[number];

export function isAcceptedResumeExtension(ext: string): ext is AcceptedResumeExtension {
  return (ACCEPTED_RESUME_EXTENSIONS as readonly string[]).includes(ext.toLowerCase());
}

// Headshot upload constraints for wizard Step 2 (B3).
// A7 (confirmed 2026-09-05): JPEG/PNG/WebP only, max 5MB, no cropping UI.
export const MAX_HEADSHOT_BYTES = 5 * 1024 * 1024; // 5MB

export const ACCEPTED_HEADSHOT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

