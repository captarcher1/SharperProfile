import * as fs from "node:fs";
import * as path from "node:path";
import mammoth from "mammoth";
// pdf-parse's default export shape has changed across major versions —
// verify against the installed version's own README rather than trusting
// this import style to stay correct across an upgrade.
// @ts-ignore — pdf-parse ships no first-class types for this entry point
import pdfParse from "pdf-parse";

export type ParsedFile = {
  /** Raw HTML for .docx (preserves bold/italic/list structure the extractor depends on); plain text for .pdf. */
  html: string;
  /** True for .docx (structure-preserving); false for .pdf (text-only — PRD §4.2 assumption 1: scanned/image PDFs are out of scope, text-based PDFs are in scope but lose bold/italic). */
  hasStructure: boolean;
  sourceFormat: "docx" | "pdf";
};

/**
 * Parses a resume file into HTML (docx) or plain text wrapped as paragraphs (pdf).
 * Per PRD Failure case 3: a file that fails to parse must fail here, before any
 * model call — this function throwing is exactly that failure point.
 */
export async function parseResumeFile(filePath: string): Promise<ParsedFile> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".docx") {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.convertToHtml({ buffer });
    if (!result.value || result.value.trim().length === 0) {
      throw new Error(`EMPTY_DOCUMENT: ${filePath} produced no extractable text`);
    }
    return { html: result.value, hasStructure: true, sourceFormat: "docx" };
  }

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    const text = (result.text || "").trim();
    if (text.length === 0) {
      throw new Error(
        `EMPTY_DOCUMENT: ${filePath} produced no extractable text — likely a scanned/image PDF, which is out of scope per PRD §4.2 assumption 1`
      );
    }
    // Wrap plain-text lines as paragraphs so the downstream HTML parser has one
    // shape to work with, at the cost of losing bold/italic — a real accuracy
    // gap for PDF vs docx, named honestly in the README below, not hidden.
    const htmlWrapped = (text as string)
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => `<p>${escapeHtml(line)}</p>`)
      .join("");
    return { html: htmlWrapped, hasStructure: false, sourceFormat: "pdf" };
  }

  throw new Error(`UNSUPPORTED_FORMAT: ${filePath} — only .docx and .pdf are in scope per PRD §4.2`);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
