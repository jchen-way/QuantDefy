import { NextRequest, NextResponse } from "next/server";
import { runExpiredUploadCleanup } from "@/lib/server/upload-workflow";

const cleanupRouteHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff"
};

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET?.trim();

  if (!expectedSecret) {
    throw new Error("CRON_SECRET must be configured for cleanup cron access.");
  }

  return request.headers.get("authorization") === `Bearer ${expectedSecret}`;
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cleanupRouteHeaders });
    }

    const prunedCount = await runExpiredUploadCleanup();
    return NextResponse.json(
      {
        success: true,
        prunedCount
      },
      { headers: cleanupRouteHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run upload cleanup.";
    return NextResponse.json({ error: message }, { status: 500, headers: cleanupRouteHeaders });
  }
}
