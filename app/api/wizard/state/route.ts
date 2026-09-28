// Read-only session snapshot. Each wizard step is its own page/route (real
// navigation, not client-only state), so a page loaded directly — including
// a browser refresh — needs a way to rehydrate what earlier steps already
// produced. Never creates a session (a GET must not have a side effect of
// minting a new session id); a request with no/unknown session simply gets
// nulls back, which every page must treat as "nothing done yet," not an error.
import { NextRequest, NextResponse } from "next/server";
import { getSession, readSessionId } from "@/lib/wizard-state";

export async function GET(request: NextRequest) {
  const sessionId = readSessionId(request);
  const session = sessionId ? getSession(sessionId) : undefined;
  return NextResponse.json({
    ok: true,
    step1: session?.step1 ?? null,
    step2: session?.step2 ?? null,
    step3: session?.step3 ?? null,
    publish: session?.publish ?? null,
  });
}
