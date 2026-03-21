import { NextRequest, NextResponse } from "next/server";
import {
  buildGoogleOauthUrl,
  createGoogleOauthFlow,
  isGoogleOauthConfigured
} from "@/lib/server/google-oauth";

function buildFailureRedirect(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("authError", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!isGoogleOauthConfigured()) {
    return buildFailureRedirect(request, "Google sign-in is not configured.");
  }

  const { state, codeChallenge } = await createGoogleOauthFlow();
  return NextResponse.redirect(buildGoogleOauthUrl(request, state, codeChallenge));
}
