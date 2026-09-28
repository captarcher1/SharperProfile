// B5 — Save/Export a draft (any step, once any progress exists).
//
// A plain GET that streams the export as a file download (Content-Disposition:
// attachment) rather than a JSON API response the client has to turn into a
// download itself — the browser's own download UI is what tells the user
// whether the save actually happened (failure case 2: never fabricate a
// "Saved!" message from the client side when the browser blocked or failed
// the download; there is no such message here to fabricate).
//
// Edge case 1: a session with no progress yet still produces a valid,
// non-corrupt (if mostly-null) export rather than erroring or refusing.
import { NextRequest, NextResponse } from "next/server";
import { getSession, readSessionId } from "@/lib/wizard-state";
import { buildExport, exportFileName } from "@/lib/wizard-export";

export async function GET(request: NextRequest) {
  const sessionId = readSessionId(request);
  const session = sessionId ? getSession(sessionId) : undefined;
  const exportFile = buildExport(session ?? { step1: null, step2: null, step3: null, publish: null });
  const body = JSON.stringify(exportFile, null, 2);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(exportFile.exportedAt)}"`,
    },
  });
}
