"use client";

// 2026-09-27 — only rendered by Footer when `config.downloadEnabled` is
// true (Step 2's wizard-configurable toggle). Two independent downloads:
// Word is a real generated file (the /api/download/docx route); PDF uses
// the browser's own print-to-PDF via window.print(), driven by the
// `@media print` rules in globals.css — this button itself is hidden in
// print via `print:hidden` so it never ends up in the printed/PDF output.
export default function DownloadProfileButton() {
  return (
    <div className="flex items-center gap-3 print:hidden">
      <a
        href="/api/download/docx"
        download
        className="text-xs text-ink-muted hover:text-accent underline underline-offset-2"
      >
        Download as Word
      </a>
      <span className="text-ink-muted text-xs" aria-hidden="true">
        ·
      </span>
      <button
        type="button"
        onClick={() => window.print()}
        className="text-xs text-ink-muted hover:text-accent underline underline-offset-2"
      >
        Download as PDF
      </button>
    </div>
  );
}
