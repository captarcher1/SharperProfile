// B9 (first publish) / B10 (republish) — the actual "go live" action.
//
// GET returns whether this session is even eligible to publish yet (a
// Vercel token configured, AND a draft with at least one validated section)
// plus the current `publish` record if one exists, so the client can render
// "Publish" vs "Republish" and show the existing live URL without a second
// round trip. POST performs the real, live, side-effecting call — the
// two-click confirm in the UI is what stands between a page load and this
// route actually firing.
//
// Failure case 3 (must route to B8, not attempt and fail generically): if
// there's no Vercel token, this returns a specific NO_TOKEN code rather than
// attempting the Vercel call at all — same pattern B1 uses for a missing
// provider key (routes into B2). The client is responsible for the actual
// routing, same separation of concerns as every other route in this wizard.
import { NextRequest, NextResponse } from "next/server";
import { envVarIsPersisted } from "@/lib/envFile";
import { getOrCreateSessionId, getSession, setPublishResult, SESSION_COOKIE_NAME } from "@/lib/wizard-state";
import { assembleDeploymentFiles, publishToVercel, toPublishResult } from "@/lib/vercelDeploy";

const VERCEL_TOKEN_ENV_VAR = "VERCEL_TOKEN";

function withSessionCookie(response: NextResponse, sessionId: string, isNew: boolean): NextResponse {
  if (isNew) {
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, { httpOnly: true, sameSite: "lax", path: "/" });
  }
  return response;
}

function hasValidatedContent(session: ReturnType<typeof getSession>): boolean {
  if (!session?.step3) return false;
  return Object.values(session.step3.sections).some((s) => s?.status === "ok");
}

export async function GET(request: NextRequest) {
  const { sessionId, isNew } = getOrCreateSessionId(request);
  const session = getSession(sessionId);
  const tokenConfigured = envVarIsPersisted(VERCEL_TOKEN_ENV_VAR);
  const hasDraft = Boolean(session?.step1 && session?.step2 && session?.step3);

  return withSessionCookie(
    NextResponse.json({
      ok: true,
      tokenConfigured,
      hasDraft,
      hasValidatedContent: hasValidatedContent(session),
      publish: session?.publish ?? null,
    }),
    sessionId,
    isNew
  );
}

export async function POST(request: NextRequest) {
  const { sessionId, isNew } = getOrCreateSessionId(request);
  const session = getSession(sessionId);

  const token = process.env[VERCEL_TOKEN_ENV_VAR];
  if (!envVarIsPersisted(VERCEL_TOKEN_ENV_VAR) || !token) {
    return withSessionCookie(
      NextResponse.json(
        { ok: false, code: "NO_TOKEN", message: "Connect a Vercel account first." },
        { status: 400 }
      ),
      sessionId,
      isNew
    );
  }

  if (!session?.step1 || !session?.step2 || !session?.step3) {
    return withSessionCookie(
      NextResponse.json(
        { ok: false, code: "NO_DRAFT", message: "There's no draft to publish yet — finish Steps 1-3 first." },
        { status: 400 }
      ),
      sessionId,
      isNew
    );
  }

  if (!hasValidatedContent(session)) {
    return withSessionCookie(
      NextResponse.json(
        {
          ok: false,
          code: "NO_CONTENT",
          message: "None of your sections have validated content yet — go back to Step 3 and generate a draft.",
        },
        { status: 400 }
      ),
      sessionId,
      isNew
    );
  }

  const assembled = assembleDeploymentFiles(session);
  if (!assembled.ok) {
    const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
    return withSessionCookie(
      NextResponse.json(
        {
          ok: false,
          code: "PAYLOAD_TOO_LARGE",
          message: `This draft (${mb(assembled.totalBytes)}MB) is larger than this wizard sends in one deployment (${mb(
            assembled.limitBytes
          )}MB) — try a smaller headshot image.`,
        },
        { status: 400 }
      ),
      sessionId,
      isNew
    );
  }

  const existingProjectId = session.publish?.projectId ?? null;
  const outcome = await publishToVercel({
    token,
    projectSlugSeed: session.step1.facts.name ?? "portfolio-site",
    files: assembled.files,
    existingProjectId,
  });

  if (outcome.status !== "ok") {
    const statusCode = outcome.status === "rejected" ? 502 : 202;
    return withSessionCookie(
      NextResponse.json({ ok: false, code: outcome.status.toUpperCase(), message: outcome.message }, { status: statusCode }),
      sessionId,
      isNew
    );
  }

  const publishResult = toPublishResult(outcome);
  setPublishResult(sessionId, publishResult);

  return withSessionCookie(
    NextResponse.json({ ok: true, publish: publishResult, republished: Boolean(existingProjectId) }),
    sessionId,
    isNew
  );
}
