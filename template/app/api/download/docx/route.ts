// 2026-09-27 — serves the profile as a .docx, built fresh on every request
// from `config/site.ts` (never cached/pre-generated, so it always reflects
// whatever's currently published). Only reachable in practice via the
// Footer's download button, which itself only renders when
// `config.downloadEnabled` is true — but this route doesn't gate on that
// flag itself, since serving the same public profile content that's already
// on the page isn't something that needs hiding behind the toggle too.
import { NextResponse } from "next/server";
import { config } from "@/config/site";
import { buildProfileDocx } from "@/lib/buildProfileDocx";

function fileSafeName(name: string): string {
  const slug = name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "profile";
}

export async function GET() {
  const buffer = await buildProfileDocx(config);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileSafeName(config.name)}.docx"`,
    },
  });
}
